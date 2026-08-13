/**
 * Throws errors (and Suspense wakeables) captured during the render phase and
 * schedules error boundaries to recover from them.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberThrow.new.lua`
 * (itself a port of Facebook's
 * `packages/react-reconciler/src/ReactFiberThrow.new.js`).
 *
 * @module ReactFiberThrow
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { console, getComponentName, invariant, ReactFeatureFlags } from '@nrbx/react-shared';
import type { React_Component, Wakeable } from '@nrbx/react-shared';

import type { CapturedValue } from './ReactCapturedValue';
import { createCapturedValue } from './ReactCapturedValue';
import { logCapturedError } from './ReactFiberErrorLogger';
import {
	DidCapture,
	ForceUpdateForLegacySuspense,
	Incomplete,
	LifecycleEffectMask,
	NoFlags,
	ShouldCapture,
} from './ReactFiberFlags';
import { NoTimestamp, SyncLane, includesSomeLane, mergeLanes, pickArbitraryLane } from './ReactFiberLane';
import { shouldCaptureSuspense } from './ReactFiberSuspenseComponent.new';
import {
	InvisibleParentSuspenseContext,
	hasSuspenseContext,
	suspenseStackCursor,
} from './ReactFiberSuspenseContext.new';
import { BlockingMode, DebugTracingMode, NoMode } from './ReactTypeOfMode';
import { CaptureUpdate, ForceUpdate, createUpdate, enqueueCapturedUpdate, enqueueUpdate } from './ReactUpdateQueue.new';
import { ClassComponent, HostRoot, IncompleteClassComponent, SuspenseComponent } from './ReactWorkTags';
import { logComponentSuspended } from './DebugTracing';
import { markComponentSuspended } from './SchedulingProfiler';
import type { Fiber, FiberRoot, Lane, Lanes, Update } from './types';

const { enableDebugTracing, enableSchedulingProfiler } = ReactFeatureFlags;

/** A wakeable whose `andThen` is called without a `self` parameter. */
type WakeableWithThen = Wakeable & {
	andThen: (onFulfilled: () => void, onRejected: () => void) => void;
};

// `pingCache` is a plain Luau table keyed by wakeable identity. TypeScript's
// index signatures only accept `string`/`number`/`symbol` keys, so these are
// treated as `any` — mirroring how the Lua runtime actually stores them.
type PingCache = any;
type ThreadIDs = any;
type UnknownRecord = Record<string, unknown>;

// ROBLOX deviation: WorkLoop and HotReloading are loaded lazily (on first use)
// to break the module cycle between ReactFiberThrow -> ReactFiberWorkLoop and
// ReactFiberThrow -> ReactFiberHotReloading -> ReactFiberWorkLoop. The Lua
// original relied on `require` load order, which is fragile once compiled by
// roblox-ts (named imports are captured at module-load time).

let ReactFiberWorkLoop:
	| {
			markLegacyErrorBoundaryAsFailed: (instance: unknown) => void;
			isAlreadyFailedLegacyErrorBoundary: (instance: unknown) => boolean;
			pingSuspendedRoot: (root: FiberRoot, wakeable: Wakeable, lanes: Lanes) => void;
	  }
	| undefined;

let ReactFiberHotReloading:
	| {
			markFailedErrorBoundaryForHotReloading: (fiber: Fiber) => void;
	  }
	| undefined;

function getSiblingModule(moduleName: string): unknown {
	const parent = (script as ModuleScript).Parent;
	invariant(parent !== undefined, 'Expected module parent to exist.');
	const child = parent.FindFirstChild(moduleName);
	invariant(child?.IsA('ModuleScript') === true, "Expected sibling module '%s' to exist.", moduleName);
	return require(child as ModuleScript);
}

function markLegacyErrorBoundaryAsFailed(instance: unknown): void {
	if (ReactFiberWorkLoop === undefined) {
		ReactFiberWorkLoop = getSiblingModule('ReactFiberWorkLoop.new') as NonNullable<typeof ReactFiberWorkLoop>;
	}
	ReactFiberWorkLoop.markLegacyErrorBoundaryAsFailed(instance);
}

function isAlreadyFailedLegacyErrorBoundary(instance: unknown): boolean {
	if (ReactFiberWorkLoop === undefined) {
		ReactFiberWorkLoop = getSiblingModule('ReactFiberWorkLoop.new') as NonNullable<typeof ReactFiberWorkLoop>;
	}
	return ReactFiberWorkLoop.isAlreadyFailedLegacyErrorBoundary(instance);
}

function pingSuspendedRoot(root: FiberRoot, wakeable: Wakeable, lanes: Lanes): void {
	if (ReactFiberWorkLoop === undefined) {
		ReactFiberWorkLoop = getSiblingModule('ReactFiberWorkLoop.new') as NonNullable<typeof ReactFiberWorkLoop>;
	}
	ReactFiberWorkLoop.pingSuspendedRoot(root, wakeable, lanes);
}

function markFailedErrorBoundaryForHotReloading(fiber: Fiber): void {
	if (ReactFiberHotReloading === undefined) {
		ReactFiberHotReloading = getSiblingModule('ReactFiberHotReloading.new') as NonNullable<
			typeof ReactFiberHotReloading
		>;
	}
	ReactFiberHotReloading.markFailedErrorBoundaryForHotReloading(fiber);
}

/**
 * Creates an update that unmounts the root after an uncaught error.
 *
 * @param fiber - The HostRoot fiber that will capture the error.
 * @param errorInfo - The captured error value.
 * @param lane - The lane to schedule the update on.
 * @param onUncaughtError - Callback invoked with the error when the update runs.
 * @returns A capture update that renders `undefined` and logs the error.
 * @internal
 */
export function createRootErrorUpdate(
	fiber: Fiber,
	errorInfo: CapturedValue<unknown>,
	lane: Lane,
	onUncaughtError: ((error: unknown) => void) | undefined
): Update<any> {
	const update = createUpdate(NoTimestamp, lane, undefined);
	// Unmount the root by rendering nil.
	update.tag = CaptureUpdate;
	// Caution: React DevTools currently depends on this property
	// being called "element".
	update.payload = { element: undefined };
	const err = errorInfo.value;
	update.callback = () => {
		if (onUncaughtError !== undefined) {
			onUncaughtError(err);
		}
		logCapturedError(fiber, errorInfo);
	};
	return update;
}

/**
 * Creates an update that re-renders a class error boundary.
 *
 * If the boundary defines `getDerivedStateFromError`, the captured error is
 * passed through it to derive replacement state. If it only defines
 * `componentDidCatch`, the instance is marked as a failed legacy boundary and
 * the error is forwarded to `componentDidCatch` for manual recovery.
 *
 * @param fiber - The ClassComponent fiber that will capture the error.
 * @param errorInfo - The captured error value.
 * @param lane - The lane to schedule the update on.
 * @returns A capture update that re-renders the boundary.
 * @internal
 */
export function createClassErrorUpdate(fiber: Fiber, errorInfo: CapturedValue<unknown>, lane: Lane): Update<any> {
	const update = createUpdate(NoTimestamp, lane, undefined);
	update.tag = CaptureUpdate;
	const getDerivedStateFromError = (fiber.type as React_Component<any, any>).getDerivedStateFromError;
	if (typeOf(getDerivedStateFromError) === 'function') {
		const err = errorInfo.value;
		update.payload = () => {
			logCapturedError(fiber, errorInfo);
			return (getDerivedStateFromError as (error: unknown) => unknown)(err as any);
		};
	}

	const inst = fiber.stateNode;
	if ((inst as unknown) !== undefined && typeOf((inst as UnknownRecord).componentDidCatch) === 'function') {
		update.callback = () => {
			if (__DEV__) {
				markFailedErrorBoundaryForHotReloading(fiber);
			}
			if (typeOf(getDerivedStateFromError) !== 'function') {
				// To preserve the preexisting retry behavior of error boundaries,
				// we keep track of which ones already failed during this batch.
				// This gets reset before we yield back to the browser.
				// TODO: Warn in strict mode if getDerivedStateFromError is
				// not defined.
				markLegacyErrorBoundaryAsFailed(inst);

				// Only log here if componentDidCatch is the only error boundary method defined
				logCapturedError(fiber, errorInfo);
			}
			const err = errorInfo.value;
			const stack = errorInfo.stack;
			((inst as UnknownRecord).componentDidCatch as (e: unknown, info: { componentStack: string }) => void)(err, {
				componentStack: stack ?? '',
			});
			if (__DEV__) {
				if (typeOf(getDerivedStateFromError) !== 'function') {
					// If componentDidCatch is the only error boundary method defined,
					// then it needs to call setState to recover from errors.
					// If no state update is scheduled then the boundary will swallow the error.
					if (!includesSomeLane(fiber.lanes, SyncLane)) {
						console.error(
							'%s: Error boundaries should implement getDerivedStateFromError(). ' +
								'In that method, return a state update to display an error message or fallback UI.',
							getComponentName(fiber.type) ?? 'Unknown'
						);
					}
				}
			}
		};
	} else if (__DEV__) {
		update.callback = () => {
			markFailedErrorBoundaryForHotReloading(fiber);
		};
	}
	return update;
}

function attachPingListener(root: FiberRoot, wakeable: Wakeable, lanes: Lanes): void {
	// Attach a listener to the promise to "ping" the root and retry. But only if
	// one does not already exist for the lanes we're currently rendering (which
	// acts like a "thread ID" here).
	let pingCache: PingCache = root.pingCache;
	let threadIDs: ThreadIDs;
	if ((pingCache as unknown) === undefined) {
		// ROBLOX deviation: use a keyed table in place of WeakMap.
		threadIDs = {};
		root.pingCache = { [wakeable as any]: threadIDs };
		pingCache = root.pingCache;
	} else {
		threadIDs = (pingCache as unknown as Record<string, ThreadIDs>)[wakeable as unknown as string];
		if ((threadIDs as unknown) === undefined) {
			threadIDs = {};
			pingCache[wakeable as any] = threadIDs;
		}
	}
	if (!(threadIDs as unknown as Record<number, boolean>)[lanes]) {
		// Memoize using the thread ID to prevent redundant listeners.
		threadIDs[lanes] = true;
		const ping = () => pingSuspendedRoot(root, wakeable, lanes);
		(wakeable as WakeableWithThen).andThen(ping, ping);
	}
}

/**
 * Throws an error or Suspense wakeable captured during the render phase.
 *
 * Walks up from `returnFiber` looking for the nearest boundary that can
 * capture the thrown value. Wakeables are handled by the nearest Suspense
 * boundary; everything else is handled by the nearest class error boundary or
 * the root.
 *
 * @param root - The root whose render is in progress.
 * @param returnFiber - The fiber to walk up from.
 * @param sourceFiber - The fiber that threw.
 * @param value - The thrown value (an error, or a Suspense wakeable).
 * @param rootRenderLanes - The lanes of the render in progress.
 * @param onUncaughtError - Invoked when the root itself captures an error.
 * @param renderDidError - Invoked once when no boundary handles the throw.
 * @internal
 */
export function throwException(
	root: FiberRoot,
	returnFiber: Fiber,
	sourceFiber: Fiber,
	value: any,
	rootRenderLanes: Lanes,
	onUncaughtError: ((error: unknown) => void) | undefined,
	renderDidError: () => void
): void {
	// The source fiber did not complete.
	sourceFiber.flags = bit32.bor(sourceFiber.flags, Incomplete);

	if (
		(value as unknown) !== undefined &&
		typeOf(value) === 'table' &&
		typeOf((value as UnknownRecord).andThen) === 'function'
	) {
		// This is a wakeable.
		const wakeable: Wakeable = value;

		if (__DEV__) {
			if (enableDebugTracing) {
				if (bit32.band(sourceFiber.mode, DebugTracingMode) !== 0) {
					const name = getComponentName(sourceFiber.type) ?? 'Unknown';
					logComponentSuspended(name, wakeable);
				}
			}
		}

		if (enableSchedulingProfiler) {
			markComponentSuspended(sourceFiber, wakeable);
		}

		if (bit32.band(sourceFiber.mode, BlockingMode) === NoMode) {
			// Reset the memoizedState to what it was before we attempted
			// to render it.
			const currentSource = sourceFiber.alternate;
			if (currentSource) {
				sourceFiber.updateQueue = currentSource.updateQueue;
				sourceFiber.memoizedState = currentSource.memoizedState;
				sourceFiber.lanes = currentSource.lanes;
			} else {
				sourceFiber.updateQueue = undefined;
				sourceFiber.memoizedState = undefined;
			}
		}

		const hasInvisibleParentBoundary = hasSuspenseContext(
			suspenseStackCursor.current,
			InvisibleParentSuspenseContext
		);

		// Schedule the nearest Suspense to re-render the timed out view.
		let workInProgress: Fiber | undefined = returnFiber;
		do {
			if (
				workInProgress.tag === SuspenseComponent &&
				shouldCaptureSuspense(workInProgress, hasInvisibleParentBoundary)
			) {
				// Found the nearest boundary.

				// Stash the promise on the boundary fiber. If the boundary times out, we'll
				// attach another listener to flip the boundary back to its normal state.
				const wakeables: any = workInProgress.updateQueue;
				if ((wakeables as unknown) === undefined) {
					const updateQueue = {
						[wakeable as any]: true,
					};
					workInProgress.updateQueue = updateQueue;
				} else {
					wakeables[wakeable as any] = true;
				}

				// If the boundary is outside of blocking mode, we should *not*
				// suspend the commit. Pretend as if the suspended component rendered
				// nil and keep rendering. In the commit phase, we'll schedule a
				// subsequent synchronous update to re-render the Suspense.
				//
				// Note: It doesn't matter whether the component that suspended was
				// inside a blocking mode tree. If the Suspense is outside of it, we
				// should *not* suspend the commit.
				if (bit32.band(workInProgress.mode, BlockingMode) === NoMode) {
					workInProgress.flags = bit32.bor(workInProgress.flags, DidCapture);
					sourceFiber.flags = bit32.bor(sourceFiber.flags, ForceUpdateForLegacySuspense);

					// We're going to commit this fiber even though it didn't complete.
					// But we shouldn't call any lifecycle methods or callbacks. Remove
					// all lifecycle effect tags.
					sourceFiber.flags = bit32.band(
						sourceFiber.flags,
						bit32.bnot(bit32.bor(LifecycleEffectMask, Incomplete))
					);

					if (sourceFiber.tag === ClassComponent) {
						const currentSourceFiber = sourceFiber.alternate;
						if (currentSourceFiber === undefined) {
							// This is a new mount. Change the tag so it's not mistaken for a
							// completed class component. For example, we should not call
							// componentWillUnmount if it is deleted.
							sourceFiber.tag = IncompleteClassComponent;
						} else {
							// When we try rendering again, we should not reuse the current fiber,
							// since it's known to be in an inconsistent state. Use a force update to
							// prevent a bail out.
							const update = createUpdate(NoTimestamp, SyncLane, undefined);
							update.tag = ForceUpdate;
							enqueueUpdate(sourceFiber, update);
						}
					}

					// The source fiber did not complete. Mark it with Sync priority to
					// indicate that it still has pending work.
					sourceFiber.lanes = mergeLanes(sourceFiber.lanes, SyncLane);

					// Exit without suspending.
					return;
				}

				// Confirmed that the boundary is in a concurrent mode tree. Continue
				// with the normal suspend path.
				//
				// After this we'll use a set of heuristics to determine whether this
				// render pass will run to completion or restart or "suspend" the commit.
				// The actual logic for this is spread out in different places.
				//
				// This first principle is that if we're going to suspend when we complete
				// a root, then we should also restart if we get an update or ping that
				// might unsuspend it, and vice versa. The only reason to suspend is
				// because you think you might want to restart before committing. However,
				// it doesn't make sense to restart only while in the period we're suspended.
				//
				// Restarting too aggressively is also not good because it starves out any
				// intermediate loading state. So we use heuristics to determine when.

				// Suspense Heuristics
				//
				// If nothing threw a Promise or all the same fallbacks are already showing,
				// then don't suspend/restart.
				//
				// If this is an initial render of a new tree of Suspense boundaries and
				// those trigger a fallback, then don't suspend/restart. We want to ensure
				// that we can show the initial loading state as quickly as possible.
				//
				// If we hit a "Delayed" case, such as when we'd switch from content back into
				// a fallback, then we should always suspend/restart. Transitions apply
				// to this case. If none is defined, JND is used instead.
				//
				// If we're already showing a fallback and it gets "retried", allowing us to show
				// another level, but there's still an inner boundary that would show a fallback,
				// then we suspend/restart for 500ms since the last time we showed a fallback
				// anywhere in the tree. This effectively throttles progressive loading into a
				// consistent train of commits. This also gives us an opportunity to restart to
				// get to the completed state slightly earlier.
				//
				// If there's ambiguity due to batching it's resolved in preference of:
				// 1) "delayed", 2) "initial render", 3) "retry".
				//
				// We want to ensure that a "busy" state doesn't get force committed. We want to
				// ensure that new initial loading states can commit as soon as possible.

				attachPingListener(root, wakeable, rootRenderLanes);

				workInProgress.flags = bit32.bor(workInProgress.flags, ShouldCapture);
				workInProgress.lanes = rootRenderLanes;

				return;
			}
			// This boundary already captured during this render. Continue to the next
			// boundary.
			workInProgress = workInProgress.return_;
		} while (workInProgress !== undefined);

		// No boundary was found. Fallthrough to error mode.
		// TODO: Use invariant so the message is stripped in prod?
		value =
			(getComponentName(sourceFiber.type) ?? 'A React component') +
			' suspended while rendering, but no fallback UI was specified.\n' +
			'\n' +
			'Add a <Suspense fallback=...> component higher in the tree to ' +
			'provide a loading indicator or placeholder to display.';
	}

	// We didn't find a boundary that could handle this type of exception. Start
	// over and traverse parent path again, this time treating the exception
	// as an error.
	renderDidError();

	value = createCapturedValue(value, sourceFiber);
	let workInProgress: Fiber | undefined = returnFiber;
	do {
		if (workInProgress.tag === HostRoot) {
			const errorInfo = value;
			workInProgress.flags = bit32.bor(workInProgress.flags, ShouldCapture);
			const lane = pickArbitraryLane(rootRenderLanes);
			workInProgress.lanes = mergeLanes(workInProgress.lanes, lane);
			const update = createRootErrorUpdate(workInProgress, errorInfo, lane, onUncaughtError);
			enqueueCapturedUpdate(workInProgress, update);
			return;
		} else if (workInProgress.tag === ClassComponent) {
			// Capture and retry
			const errorInfo = value;
			const ctor = workInProgress.type;
			const instance = workInProgress.stateNode;
			if (
				bit32.band(workInProgress.flags, DidCapture) === NoFlags &&
				(typeOf((ctor as UnknownRecord).getDerivedStateFromError) === 'function' ||
					((instance as unknown) !== undefined &&
						typeOf((instance as UnknownRecord).componentDidCatch) === 'function' &&
						!isAlreadyFailedLegacyErrorBoundary(instance)))
			) {
				workInProgress.flags = bit32.bor(workInProgress.flags, ShouldCapture);
				const lane = pickArbitraryLane(rootRenderLanes);
				workInProgress.lanes = mergeLanes(workInProgress.lanes, lane);
				// Schedule the error boundary to re-render using updated state
				const update = createClassErrorUpdate(workInProgress, errorInfo, lane);
				enqueueCapturedUpdate(workInProgress, update);
				return;
			}
		}
		workInProgress = workInProgress.return_;
	} while (workInProgress !== undefined);
}

export default {
	throwException,
	createRootErrorUpdate,
	createClassErrorUpdate,
};
