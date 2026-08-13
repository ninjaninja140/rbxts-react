/**
 * Bridge between the reconciler and the React Developer Tools global hook.
 *
 * React DevTools registers a global hook object (read from the
 * `react-globals` package) and this module drives it: injecting the renderer
 * internals once, then forwarding schedule/commit/unmount notifications. Every
 * call into the hook is wrapped in `pcall` because instrumentation must never
 * be able to crash the renderer it is observing.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberDevToolsHook.new.lua`.
 *
 * @module ReactFiberDevToolsHook
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__, __REACT_DEVTOOLS_GLOBAL_HOOK__ } from '@nrbx/react-globals';
import { console, ReactFeatureFlags } from '@nrbx/react-shared';
import type { ReactNodeList } from '@nrbx/react-shared';

import { DidCapture } from './ReactFiberFlags';
import type { Fiber, FiberRoot, Object, ReactPriorityLevel } from './types';

// ROBLOX deviation: subset copied here from devtools-shared/backend/types, to
// have stronger enforcement than `Object` without a circular dependency.
interface DevToolsHook {
	inject: (internals: Object) => number;
	supportsFiber: boolean;
	isDisabled: boolean;
	// The remaining members are only checked for callability, and their exact
	// signatures live in the devtools backend rather than in this module.
	onScheduleFiberRoot?: (...args: Array<unknown>) => void;
	onCommitFiberRoot?: (...args: Array<unknown>) => void;
	onCommitFiberUnmount?: (...args: Array<unknown>) => void;
}

// ROBLOX deviation: we use callable tables instead of functions sometimes, so
// `typeOf(value) === "function"` isn't enough to detect a callable.
function isCallable(value: unknown): boolean {
	if (typeOf(value) === 'function') {
		return true;
	}
	if (typeOf(value) === 'table') {
		const tbl = value as Record<string, unknown>;
		const metatable = getmetatable(tbl) as Record<string, unknown> | undefined;
		if (metatable !== undefined && rawget(metatable, '__call') !== undefined) {
			return true;
		}
		if (tbl._isMockFunction !== undefined) {
			return true;
		}
	}
	return false;
}

const enableProfilerTimer = ReactFeatureFlags.enableProfilerTimer;

let rendererID: number | undefined;
let injectedHook: DevToolsHook | undefined;
let hasLoggedError = false;

// ROBLOX deviation: we use a function to handle the hook being changed at runtime.
export function isDevToolsPresent(): boolean {
	return __REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined;
}

export function injectInternals(internals: Object): boolean {
	if (__REACT_DEVTOOLS_GLOBAL_HOOK__ === undefined) {
		// No DevTools.
		return false;
	}

	const hook = __REACT_DEVTOOLS_GLOBAL_HOOK__ as DevToolsHook;
	if (hook.isDisabled) {
		// This isn't a real property on the hook, but it can be set to opt out
		// of DevTools integration and associated warnings and logs.
		// http://github.com/facebook/react/issues/3877
		return true;
	}

	if (!hook.supportsFiber) {
		if (__DEV__) {
			console.error(
				'The installed version of React DevTools is too old and will not work ' +
					'with the current version of React. Please update React DevTools. ' +
					'https://reactjs.org/link/react-devtools'
			);
		}
		// DevTools exists, even though it doesn't support Fiber.
		return true;
	}

	const [ok, err] = pcall(() => {
		rendererID = hook.inject(internals);
		// We have successfully injected, so now it is safe to set up hooks.
		injectedHook = hook;
	});

	if (!ok) {
		// Catch all errors because it is unsafe to throw during initialization.
		if (__DEV__) {
			console.error(string.format('React instrumentation encountered an error: %s.', tostring(err)));
		}
	}

	// DevTools exists.
	return true;
}

export function onScheduleRoot(root: FiberRoot, children: ReactNodeList): void {
	if (__DEV__) {
		if (injectedHook !== undefined && isCallable(injectedHook.onScheduleFiberRoot)) {
			const [ok, err] = pcall(() => {
				injectedHook!.onScheduleFiberRoot!(rendererID, root, children);
			});

			if (!ok) {
				if (__DEV__ && !hasLoggedError) {
					hasLoggedError = true;
					console.error(string.format('React instrumentation encountered an error: %s', tostring(err)));
				}
			}
		}
	}
}

export function onCommitRoot(root: FiberRoot, priorityLevel: ReactPriorityLevel): void {
	if (injectedHook !== undefined && isCallable(injectedHook.onCommitFiberRoot)) {
		const [ok, err] = pcall(() => {
			const didError = bit32.band(root.current.flags, DidCapture) === DidCapture;
			if (enableProfilerTimer) {
				injectedHook!.onCommitFiberRoot!(rendererID, root, priorityLevel, didError);
			} else {
				injectedHook!.onCommitFiberRoot!(rendererID, root, undefined, didError);
			}
		});

		if (!ok) {
			if (__DEV__) {
				if (!hasLoggedError) {
					hasLoggedError = true;
					console.error(string.format('React instrumentation encountered an error: %s', tostring(err)));
				}
			}
		}
	}
}

export function onCommitUnmount(fiber: Fiber): void {
	if (injectedHook !== undefined && isCallable(injectedHook.onCommitFiberUnmount)) {
		const [ok, err] = pcall(() => {
			injectedHook!.onCommitFiberUnmount!(rendererID, fiber);
		});

		if (!ok) {
			if (__DEV__) {
				if (!hasLoggedError) {
					hasLoggedError = true;
					console.error(string.format('React instrumentation encountered an error: %s', tostring(err)));
				}
			}
		}
	}
}

export default {
	isDevToolsPresent,
	injectInternals,
	onScheduleRoot,
	onCommitRoot,
	onCommitUnmount,
};
