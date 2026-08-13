/**
 * The global DevTools hook installer.
 *
 * `installHook` writes a {@link DevToolsHook} onto the supplied `target`
 * table under the `__REACT_DEVTOOLS_GLOBAL_HOOK__` key. On Roblox the
 * reconciler reads that key from its own `ReactGlobals` table, which by
 * default is `_G` itself, so the backend passes `_G` as the target.
 *
 * Ported from `react-devtools-shared/src/hook.js` (React 17).
 *
 * @module hook
 * @packageDocumentation
 */

import { __DEV__ } from '@nrbx/react-globals';

import { Console } from './backend/console';
import type { DevToolsHook, ReactRenderer, RendererInterface } from './backend/types';
import type { Handler } from './backend/types';

/** Signature of the `__REACT_DEVTOOLS_ATTACH__` function injected by the backend. */
export type DevToolsAttach = (
	hook: DevToolsHook,
	id: number,
	renderer: ReactRenderer,
	global: Record<string, unknown>
) => RendererInterface;

/**
 * Install the DevTools global hook onto `target`.
 *
 * Returns `undefined` when a hook is already installed on the target. The
 * returned hook exposes the renderer maps (`renderers`,
 * `rendererInterfaces`) and the event surface (`on` / `off` / `sub` / `emit`)
 * used by the rest of the backend.
 */
export function installHook(target: Record<string, unknown>): DevToolsHook | undefined {
	if (target.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined) {
		return undefined;
	}

	// ROBLOX deviation: unused upstream, kept as a no-op. It only matters for
	// dead-code-eliminated browser bundles, which don't exist on Roblox.
	const hasDetectedBadDCE = false;

	const fiberRoots: Record<number, Set<object>> = {};
	const rendererInterfaces = new Map<number, RendererInterface>();
	const listeners: Record<string, Array<Handler>> = {};
	const renderers = new Map<number, ReactRenderer>();

	function detectReactBuildType(_renderer: ReactRenderer): string {
		// ROBLOX deviation: the Roblox runtime does not ship separate
		// production / development bundles, so there is nothing to detect.
		return 'production';
	}

	function checkDCE(_fn: (...args: Array<unknown>) => unknown): void {
		// ROBLOX deviation: no optimizing bundler runs on Roblox.
	}

	// ROBLOX deviation: ids start at 1 instead of 0.
	let uidCounter = 1;
	function PREFIX_INCREMENT(): number {
		uidCounter += 1;
		return uidCounter;
	}

	function inject(renderer: ReactRenderer): number | undefined {
		const id = PREFIX_INCREMENT();

		renderers.set(id, renderer);

		const reactBuildType = hasDetectedBadDCE ? 'deadcode' : detectReactBuildType(renderer);

		if (__DEV__) {
			pcall(() => {
				const appendComponentStack = target.__REACT_DEVTOOLS_APPEND_COMPONENT_STACK__ !== false;
				const breakOnConsoleErrors = target.__REACT_DEVTOOLS_BREAK_ON_CONSOLE_ERRORS__ === true;

				// The upstream hook is stringified into the page, so its imports
				// are unavailable and this work is wrapped in a try/catch. The
				// same guard is kept here to mirror that behavior.
				if (appendComponentStack || breakOnConsoleErrors) {
					Console.registerRenderer(renderer);
					Console.patch({
						appendComponentStack,
						breakOnConsoleErrors,
					});
				}
			});
		}

		const attach = target.__REACT_DEVTOOLS_ATTACH__;

		if (type(attach) === 'function') {
			const rendererInterface = (attach as unknown as DevToolsAttach)(hook, id, renderer, target);
			hook.rendererInterfaces.set(id, rendererInterface);
		}

		hook.emit('renderer', {
			id,
			renderer,
			reactBuildType,
		});

		return id;
	}

	function sub(event: string, fn: Handler): () => void {
		hook.on(event, fn);
		return () => {
			hook.off(event, fn);
		};
	}

	function on(event: string, fn: Handler): void {
		if (!listeners[event]) {
			listeners[event] = [];
		}
		listeners[event].push(fn);
	}

	function off(event: string, fn: Handler): void {
		if (!listeners[event]) {
			return;
		}

		const index = listeners[event].indexOf(fn);

		if (index !== -1) {
			listeners[event].remove(index);
		}
		// ROBLOX deviation: upstream sets `listeners[event] = nil` once empty.
		// A non-optional index signature prevents that here, so an empty array
		// is left behind instead. Behaviorally identical: `emit` and `on` both
		// treat an empty array the same as a missing key.
	}

	function emit(event: string, data: unknown): void {
		if (listeners[event]) {
			for (const fn of listeners[event]) {
				fn(data);
			}
		}
	}

	function getFiberRoots(rendererID: number): Set<object> {
		const roots = fiberRoots;

		if (!roots[rendererID]) {
			roots[rendererID] = new Set<object>();
		}

		return roots[rendererID];
	}

	function onCommitFiberUnmount(rendererID: number, fiber: object): void {
		const rendererInterface = rendererInterfaces.get(rendererID);

		if (rendererInterface !== undefined) {
			rendererInterface.handleCommitFiberUnmount(fiber);
		}
	}

	function onCommitFiberRoot(rendererID: number, root: object, priorityLevel?: number): void {
		const mountedRoots = hook.getFiberRoots(rendererID);
		const rootContainer = root as { current: { memoizedState: { element?: unknown } | undefined } };
		const current = rootContainer.current;
		const isKnownRoot = mountedRoots.has(root);
		const isUnmounting = current.memoizedState === undefined || current.memoizedState.element === undefined;

		// Track mounted roots so the frontend can be notified of newly mounted
		// and unmounted trees.
		if (!isKnownRoot && !isUnmounting) {
			mountedRoots.add(root);
		} else if (isKnownRoot && isUnmounting) {
			mountedRoots.delete(root);
		}

		const rendererInterface = rendererInterfaces.get(rendererID);

		if (rendererInterface !== undefined) {
			rendererInterface.handleCommitFiberRoot(root, priorityLevel);
		}
	}

	const hook: DevToolsHook = {
		rendererInterfaces,
		listeners,
		// Fast Refresh relies on this on web; exposed here for completeness.
		renderers,

		emit,
		getFiberRoots,
		inject,
		on,
		off,
		sub,
		reactDevtoolsAgent: undefined,

		// Legacy flag — React v16 checks the hook for this to ensure DevTools
		// is new enough.
		supportsFiber: true,

		// Called by the reconciler during commits.
		checkDCE,
		onCommitFiberUnmount,
		onCommitFiberRoot,
	};

	target.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
	return hook;
}
