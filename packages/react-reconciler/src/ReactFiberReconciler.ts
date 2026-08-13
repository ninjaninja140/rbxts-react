/**
 * The top-level reconciler API.
 *
 * This module wires the public entry points (`createContainer`,
 * `updateContainer`, `getPublicRootInstance`, `injectIntoDevTools`, …) onto
 * the fiber work loop and the host config. It is the equivalent of
 * `react-dom`'s `ReactFiberReconciler` — the boundary between the React
 * runtime and the renderer.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberReconciler.new.lua`
 * (upstream React 17
 * `packages/react-reconciler/src/ReactFiberReconciler.new.js`).
 *
 * @module ReactFiberReconciler
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__, __TESTEZ_RUNNING_TEST__ } from '@nrbx/react-globals';
import {
	console,
	describeError,
	getComponentName,
	invariant,
	ReactFeatureFlags,
	ReactInstanceMap,
	ReactSharedInternals,
} from '@nrbx/react-shared';
import type { ReactNodeList } from '@nrbx/react-shared';

import HostConfig from './ReactFiberHostConfig';
import type {
	Container,
	Instance,
	PublicInstance,
	RendererInspectionConfig,
	TextInstance,
} from './ReactFiberHostConfig';

import { isArray } from './ReactFiber.new';
import {
	emptyContextObject,
	findCurrentUnmaskedContext,
	isContextProvider,
	processChildContext,
} from './ReactFiberContext.new';
import * as ReactCurrentFiber from './ReactCurrentFiber';
import { injectInternals, onScheduleRoot } from './ReactFiberDevToolsHook.new';
import {
	getCurrentUpdateLanePriority,
	getHighestPriorityPendingLanes,
	higherPriorityLane,
	InputDiscreteHydrationLane,
	NoTimestamp,
	SelectiveHydrationLane,
	setCurrentUpdateLanePriority,
	SyncLane,
} from './ReactFiberLane';
import { createFiberRoot } from './ReactFiberRoot.new';
import * as ReactFiberHotReloading from './ReactFiberHotReloading.new';
import { ClassComponent, FundamentalComponent, HostComponent, HostRoot, SuspenseComponent } from './ReactWorkTags';
import { StrictMode } from './ReactTypeOfMode';
import { createPortal } from './ReactPortal';
import { registerMutableSourceForHydration } from './ReactMutableSource.new';
import type { SuspenseState } from './ReactFiberSuspenseComponent.new';
import {
	findCurrentFiberUsingSlowPath,
	findCurrentHostFiber,
	findCurrentHostFiberWithNoPortals,
	getNearestMountedFiber,
} from './ReactFiberTreeReflection';
import { createUpdate, enqueueUpdate } from './ReactUpdateQueue.new';
import type { RootTag } from './ReactRootTags';
import ReactFiberFlags from './ReactFiberFlags';
import ReactRootTags from './ReactRootTags';
import ReactTypeOfMode from './ReactTypeOfMode';
import ReactWorkTags from './ReactWorkTags';
import * as RobloxReactProfiling from './RobloxReactProfiling';
import { markRenderScheduled, profilerEventTypes, registerProfilerEventCallback } from './SchedulingProfiler';
import {
	act,
	batchedEventUpdates,
	batchedUpdates,
	deferredUpdates,
	discreteUpdates,
	flushControlled,
	flushDiscreteUpdates,
	flushPassiveEffects,
	flushRoot,
	flushSync,
	IsThisRendererActing,
	requestEventTime,
	requestUpdateLane,
	scheduleUpdateOnFiber,
	unbatchedUpdates,
	warnIfNotScopedWithMatchingAct,
	warnIfUnmockedScheduler,
} from './ReactFiberWorkLoop.new';
import type { Fiber, FiberRoot, Lane, LanePriority, SuspenseHydrationCallbacks } from './types';

const enableSchedulingProfiler = ReactFeatureFlags.enableSchedulingProfiler;

// Type aliases

type Object = Record<string, any>;
type Path = Array<string | number>;

/** Minimal shape of a fiber hook touched by the DevTools override functions. */
type DevToolsHook = {
	memoizedState: any;
	baseState: any;
	next: DevToolsHook | undefined;
};

/** Opaque handle returned by `createContainer`; a fiber root. */
type OpaqueRoot = FiberRoot;

/**
 * 0 is PROD, 1 is DEV.
 * Might add PROFILE later.
 */
type BundleType = number;

/** Config the renderer passes to `injectIntoDevTools`. */
type DevToolsConfig = {
	bundleType: BundleType;
	version: string;
	rendererPackageName: string;
	// Note: this actually *does* depend on Fiber internal fields.
	// Used by "inspect clicked element" in React DevTools.
	findFiberByHostInstance?: (instance: Instance | TextInstance) => Fiber | undefined;
	rendererConfig?: RendererInspectionConfig;
};

// Module state

let didWarnAboutNestedUpdates: boolean | undefined;
let didWarnAboutFindNodeInStrictMode: Record<string, boolean> | undefined;

if (__DEV__) {
	didWarnAboutNestedUpdates = false;
	didWarnAboutFindNodeInStrictMode = {};
}

// The reconciler needs a non-nil placeholder when an update payload carries a
// `nil`/`undefined` element (i.e. unmounting a root). Luau tables cannot store
// `nil`, so assigning `{ element = undefined }` would silently drop the key and
// the root would never unmount. Any value that is not a valid React child hits
// the "delete remaining children" branch in the child reconciler, so an empty
// frozen table is a safe sentinel.
const REACT_NULL_ELEMENT: defined = {};

// Context helpers

/**
 * Resolves the legacy context object that should be visible to a subtree
 * rendered through `parentComponent`.
 */
function getContextForSubtree(parentComponent: Record<string, unknown> | undefined): Object {
	if (parentComponent === undefined) {
		return emptyContextObject;
	}

	const fiber = ReactInstanceMap.get(parentComponent) as Fiber;
	const parentContext = findCurrentUnmaskedContext(fiber);

	if (fiber.tag === ClassComponent) {
		const Component = fiber.type;
		if (isContextProvider(Component)) {
			return processChildContext(fiber, Component, parentContext);
		}
	}

	return parentContext;
}

/** Builds a human-readable list of an object's keys for error messages. */
function keysToString(obj: object): string {
	const keys: string[] = [];
	for (const [key] of pairs(obj)) {
		keys.push(key as string);
	}
	return keys.join(', ');
}

// Host instance lookup

/**
 * Resolves the nearest mounted host instance for a public React component
 * instance.
 *
 * @throws If `component` does not resolve to a mounted fiber.
 */
function findHostInstance(component: Object): PublicInstance | undefined {
	const fiber = ReactInstanceMap.get(component) as Fiber;
	if (fiber === undefined) {
		if (typeOf(component.render) === 'function') {
			invariant(false, 'Unable to find node on an unmounted component.');
		} else {
			invariant(false, 'Argument appears to not be a ReactComponent. Keys: %s', keysToString(component));
		}
	}
	const hostFiber = findCurrentHostFiber(fiber);
	if (hostFiber === undefined) {
		return undefined;
	}
	return hostFiber.stateNode;
}

/**
 * Like {@link findHostInstance}, but emits a deprecation warning when the
 * resolved host fiber lives inside a StrictMode subtree.
 */
function findHostInstanceWithWarning(component: Object, methodName: string): PublicInstance | undefined {
	if (__DEV__) {
		const fiber = ReactInstanceMap.get(component) as Fiber;
		if (fiber === undefined) {
			if (typeOf(component.render) === 'function') {
				invariant(false, 'Unable to find node on an unmounted component.');
			} else {
				invariant(false, 'Argument appears to not be a ReactComponent. Keys: %s', keysToString(component));
			}
		}

		const hostFiber = findCurrentHostFiber(fiber);
		if (hostFiber === undefined) {
			return undefined;
		}

		if (bit32.band(hostFiber.mode, StrictMode) !== 0) {
			const componentName = getComponentName(fiber.type) ?? 'Component';
			if (!didWarnAboutFindNodeInStrictMode![componentName]) {
				didWarnAboutFindNodeInStrictMode![componentName] = true;

				const previousFiber = ReactCurrentFiber.current;
				const [ok, result] = xpcall(() => {
					ReactCurrentFiber.setCurrentFiber(hostFiber);
					if (bit32.band(fiber.mode, StrictMode) !== 0) {
						console.error(
							'%s is deprecated in StrictMode. ' +
								'%s was passed an instance of %s which is inside StrictMode. ' +
								'Instead, add a ref directly to the element you want to reference. ' +
								'Learn more about using refs safely here: ' +
								'https://reactjs.org/link/strict-mode-find-node',
							methodName,
							methodName,
							componentName
						);
					} else {
						console.error(
							'%s is deprecated in StrictMode. ' +
								'%s was passed an instance of %s which renders StrictMode children. ' +
								'Instead, add a ref directly to the element you want to reference. ' +
								'Learn more about using refs safely here: ' +
								'https://reactjs.org/link/strict-mode-find-node',
							methodName,
							methodName,
							componentName
						);
					}
				}, describeError) as LuaTuple<[boolean, unknown]>;

				// Ideally this should reset to previous but this shouldn't be called in
				// render and there's another warning for that anyway.
				if (previousFiber) {
					ReactCurrentFiber.setCurrentFiber(previousFiber);
				} else {
					ReactCurrentFiber.resetCurrentFiber();
				}

				if (!ok) {
					error(result);
				}
			}
		}
		return hostFiber.stateNode;
	}
	return findHostInstance(component);
}

// Container management

/**
 * Creates a new fiber root bound to `containerInfo`.
 *
 * @param containerInfo - The host container (e.g. a `PlayerGui`).
 * @param tag - The root tag (legacy/blocking/concurrent).
 * @param hydrate - Whether the root should attempt to hydrate server content.
 * @param hydrationCallbacks - Optional suspense hydration callbacks.
 */
function createContainer(
	containerInfo: Container,
	tag: RootTag,
	hydrate: boolean,
	hydrationCallbacks?: SuspenseHydrationCallbacks
): OpaqueRoot {
	return createFiberRoot(containerInfo, tag, hydrate, hydrationCallbacks);
}

/**
 * Schedules the `element` to be rendered into `container`.
 *
 * @returns The lane the update was scheduled on.
 */
function updateContainer(
	element: ReactNodeList,
	container: OpaqueRoot,
	parentComponent: any,
	callback?: (...args: Array<any>) => any
): Lane {
	if (__DEV__) {
		onScheduleRoot(container, element);
	}

	const current = container.current;
	const eventTime = requestEventTime();
	if (__DEV__) {
		if (__TESTEZ_RUNNING_TEST__) {
			warnIfUnmockedScheduler(current);
			warnIfNotScopedWithMatchingAct(current);
		}
	}

	const lane = requestUpdateLane(current);

	if (enableSchedulingProfiler) {
		markRenderScheduled(lane);
	}

	const context = getContextForSubtree(parentComponent);
	if (container.context === undefined) {
		container.context = context;
	} else {
		container.pendingContext = context;
	}

	if (__DEV__) {
		const currentFiber = ReactCurrentFiber.current;
		if (ReactCurrentFiber.isRendering && currentFiber !== undefined && !didWarnAboutNestedUpdates) {
			didWarnAboutNestedUpdates = true;
			console.error(
				'Render methods should be a pure function of props and state; ' +
					'triggering nested component updates from render is not allowed. ' +
					'If necessary, trigger nested updates in componentDidUpdate.\n\n' +
					'Check the render method of %s.',
				getComponentName(currentFiber.type) ?? 'Unknown'
			);
		}
	}

	const update = createUpdate(eventTime, lane, { element });

	if (callback !== undefined) {
		if (__DEV__) {
			if (typeOf(callback) !== 'function') {
				console.error(
					'render(...): Expected the last optional `callback` argument to be a ' +
						'function. Instead received: %s.',
					tostring(callback)
				);
			}
		}
		update.callback = callback;
	}

	if (element === undefined) {
		// Reassign after the update payload has been constructed so the render
		// phase sees a non-nil sentinel instead of a nil element.
		update.payload = { element: REACT_NULL_ELEMENT as unknown as ReactNodeList };
	}

	enqueueUpdate(current, update);
	scheduleUpdateOnFiber(current, lane, eventTime);

	return lane;
}

/**
 * Returns the public instance rendered by the root, if any.
 */
function getPublicRootInstance(container: OpaqueRoot): PublicInstance | any | undefined {
	const containerFiber = container.current;
	if (containerFiber.child === undefined) {
		return undefined;
	}
	if (containerFiber.child.tag === HostComponent) {
		return HostConfig.getPublicInstance(containerFiber.child.stateNode);
	}
	return containerFiber.child.stateNode;
}

// Hydration attempts

let markRetryLaneIfNotHydrated: (fiber: Fiber, retryLane: Lane) => void;

function markRetryLaneImpl(fiber: Fiber, retryLane: Lane): void {
	const suspenseState = fiber.memoizedState as SuspenseState | undefined;
	if (suspenseState !== undefined && suspenseState.dehydrated !== undefined) {
		suspenseState.retryLane = higherPriorityLane(suspenseState.retryLane, retryLane);
	}
}

/**
 * Increases the priority of thenables when they resolve within this boundary.
 */
markRetryLaneIfNotHydrated = (fiber: Fiber, retryLane: Lane): void => {
	markRetryLaneImpl(fiber, retryLane);
	const alternate = fiber.alternate;
	if (alternate !== undefined) {
		markRetryLaneImpl(alternate, retryLane);
	}
};

/**
 * Attempts to synchronously hydrate the root/boundary and flush the first
 * scheduled update.
 */
function attemptSynchronousHydration(fiber: Fiber): void {
	if (fiber.tag === HostRoot) {
		const root = fiber.stateNode as FiberRoot;
		if (root.hydrate) {
			const lanes = getHighestPriorityPendingLanes(root);
			flushRoot(root, lanes);
		}
	} else if (fiber.tag === SuspenseComponent) {
		const eventTime = requestEventTime();
		flushSync(undefined, undefined);
		scheduleUpdateOnFiber(fiber, SyncLane, eventTime);
		// If we're still blocked after this, we need to increase the priority of
		// any promises resolving within this boundary so that they next attempt
		// also has higher priority.
		const retryLane = InputDiscreteHydrationLane;
		markRetryLaneIfNotHydrated(fiber, retryLane);
	}
}

/** Attempts hydration of a Suspense boundary at user-blocking priority. */
function attemptUserBlockingHydration(fiber: Fiber): void {
	if (fiber.tag !== SuspenseComponent) {
		// We ignore HostRoots here because we can't increase their priority and
		// they should not suspend on I/O, since you have to wrap anything that
		// might suspend in Suspense.
		return;
	}
	const eventTime = requestEventTime();
	const lane = InputDiscreteHydrationLane;
	scheduleUpdateOnFiber(fiber, lane, eventTime);
	markRetryLaneIfNotHydrated(fiber, lane);
}

/** Attempts hydration of a Suspense boundary at continuous priority. */
function attemptContinuousHydration(fiber: Fiber): void {
	if (fiber.tag !== SuspenseComponent) {
		return;
	}
	const eventTime = requestEventTime();
	const lane = SelectiveHydrationLane;
	scheduleUpdateOnFiber(fiber, lane, eventTime);
	markRetryLaneIfNotHydrated(fiber, lane);
}

/** Attempts hydration of a Suspense boundary at the current priority. */
function attemptHydrationAtCurrentPriority(fiber: Fiber): void {
	if (fiber.tag !== SuspenseComponent) {
		return;
	}
	const eventTime = requestEventTime();
	const lane = requestUpdateLane(fiber);
	scheduleUpdateOnFiber(fiber, lane, eventTime);
	markRetryLaneIfNotHydrated(fiber, lane);
}

// Priority helpers

/**
 * Runs `fn` with the given update lane priority, restoring the previous
 * priority afterwards.
 */
function runWithPriority<T>(priority: LanePriority, fn: () => T): T {
	const previousPriority = getCurrentUpdateLanePriority();
	setCurrentUpdateLanePriority(priority);
	const [ok, result] = xpcall(fn, describeError) as LuaTuple<[boolean, T]>;
	setCurrentUpdateLanePriority(previousPriority);
	if (!ok) {
		error(result);
	}
	return result;
}

/** Resolves the nearest mounted host fiber ignoring portals. */
function findHostInstanceWithNoPortals(fiber: Fiber): PublicInstance | undefined {
	const hostFiber = findCurrentHostFiberWithNoPortals(fiber);
	if (hostFiber === undefined) {
		return undefined;
	}
	if (hostFiber.tag === FundamentalComponent) {
		return (hostFiber.stateNode as { instance: PublicInstance }).instance;
	}
	return hostFiber.stateNode;
}

// Suspense handler

let shouldSuspendImpl: (fiber: Fiber) => boolean = () => false;

/** Returns whether the renderer believes `fiber` should suspend. */
function shouldSuspend(fiber: Fiber): boolean {
	return shouldSuspendImpl(fiber);
}

// DevTools overrides

let overrideHookState: ((fiber: Fiber, id: number, path: Path, value: any) => void) | undefined;
let overrideHookStateDeletePath: ((fiber: Fiber, id: number, path: Path) => void) | undefined;
let overrideHookStateRenamePath: ((fiber: Fiber, id: number, oldPath: Path, newPath: Path) => void) | undefined;
let overrideProps: ((fiber: Fiber, path: Path, value: any) => void) | undefined;
let overridePropsDeletePath: ((fiber: Fiber, path: Path) => void) | undefined;
let overridePropsRenamePath: ((fiber: Fiber, oldPath: Path, newPath: Path) => void) | undefined;
let scheduleUpdate: ((fiber: Fiber) => void) | undefined;
let setSuspenseHandler: ((newShouldSuspendImpl: (fiber: Fiber) => boolean) => void) | undefined;

if (__DEV__) {
	// NOTE: These helpers mutate plain tables and arrays. The `as string`
	// casts on index expressions are erased at compile time, so numeric keys
	// still reach Luau as numbers; they only satisfy the `Record<string, any>`
	// index signature that roblox-ts requires for the non-`any` table type.
	function copyWithDeleteImpl(obj: Object, path: Path, index: number): Object {
		const key = path[index];
		const updated = table.clone(obj);
		if (index + 1 === path.size()) {
			if (isArray(updated)) {
				(updated as unknown as Array<defined>).remove(key as number);
			} else {
				updated[key as string] = undefined;
			}
			return updated;
		}
		updated[key as string] = copyWithDeleteImpl(obj[key as string] as Object, path, index + 1);
		return updated;
	}

	function copyWithDelete(obj: Object, path: Path): Object {
		return copyWithDeleteImpl(obj, path, 0);
	}

	function copyWithRenameImpl(obj: Object, oldPath: Path, newPath: Path, index: number): Object {
		const oldKey = oldPath[index];
		const updated = table.clone(obj);
		if (index + 1 === oldPath.size()) {
			const newKey = newPath[index];
			updated[newKey as string] = updated[oldKey as string];
			if (isArray(updated)) {
				(updated as unknown as Array<defined>).remove(oldKey as number);
			} else {
				updated[oldKey as string] = undefined;
			}
		} else {
			updated[oldKey as string] = copyWithRenameImpl(
				obj[oldKey as string] as Object,
				oldPath,
				newPath,
				index + 1
			);
		}
		return updated;
	}

	function copyWithRename(obj: Object, oldPath: Path, newPath: Path): Object | undefined {
		if (oldPath.size() !== newPath.size()) {
			console.warn('copyWithRename() expects paths of the same length');
			return undefined;
		} else {
			for (let i = 0; i < newPath.size() - 1; i++) {
				if (oldPath[i] !== newPath[i]) {
					console.warn('copyWithRename() expects paths to be the same except for the deepest key');
					return undefined;
				}
			}
		}
		return copyWithRenameImpl(obj, oldPath, newPath, 0);
	}

	function copyWithSetImpl(obj: Object, path: Path, index: number, value: any): Object {
		if (index >= path.size()) {
			return value;
		}
		const key = path[index];
		const updated = table.clone(obj);
		updated[key as string] = copyWithSetImpl(obj[key as string] as Object, path, index + 1, value);
		return updated;
	}

	function copyWithSet(obj: Object, path: Path, value: any): Object {
		return copyWithSetImpl(obj, path, 0, value);
	}

	function findHook(fiber: Fiber, id: number): DevToolsHook | undefined {
		// For now, the "id" of stateful hooks is just the stateful hook index.
		// This may change in the future with e.g. nested hooks.
		let currentHook: DevToolsHook | undefined = fiber.memoizedState;
		while (currentHook !== undefined && id > 0) {
			currentHook = currentHook.next;
			id -= 1;
		}
		return currentHook;
	}

	// Support DevTools editable values for useState and useReducer.
	overrideHookState = (fiber: Fiber, id: number, path: Path, value: any): void => {
		const hook = findHook(fiber, id);
		if (hook !== undefined) {
			const newState = copyWithSet(hook.memoizedState, path, value);
			hook.memoizedState = newState;
			hook.baseState = newState;

			// We aren't actually adding an update to the queue, because there is no
			// update we can add for useReducer hooks that won't trigger an error.
			// (There's no appropriate action type for DevTools overrides.) As a
			// result though, React will see the scheduled update as a noop and
			// bailout. Shallow cloning props works as a workaround for now to
			// bypass the bailout check.
			fiber.memoizedProps = table.clone(fiber.memoizedProps);

			scheduleUpdateOnFiber(fiber, SyncLane, NoTimestamp);
		}
	};

	overrideHookStateDeletePath = (fiber: Fiber, id: number, path: Path): void => {
		const hook = findHook(fiber, id);
		if (hook !== undefined) {
			const newState = copyWithDelete(hook.memoizedState, path);
			hook.memoizedState = newState;
			hook.baseState = newState;

			fiber.memoizedProps = table.clone(fiber.memoizedProps);

			scheduleUpdateOnFiber(fiber, SyncLane, NoTimestamp);
		}
	};

	overrideHookStateRenamePath = (fiber: Fiber, id: number, oldPath: Path, newPath: Path): void => {
		const hook = findHook(fiber, id);
		if (hook !== undefined) {
			const newState = copyWithRename(hook.memoizedState, oldPath, newPath);
			hook.memoizedState = newState;
			hook.baseState = newState;

			fiber.memoizedProps = table.clone(fiber.memoizedProps);

			scheduleUpdateOnFiber(fiber, SyncLane, NoTimestamp);
		}
	};

	// Support DevTools props for function components, forwardRef, memo, host
	// components, etc.
	overrideProps = (fiber: Fiber, path: Path, value: any): void => {
		fiber.pendingProps = copyWithSet(fiber.memoizedProps, path, value);
		const alternate = fiber.alternate;
		if (alternate !== undefined) {
			alternate.pendingProps = fiber.pendingProps;
		}
		scheduleUpdateOnFiber(fiber, SyncLane, NoTimestamp);
	};

	overridePropsDeletePath = (fiber: Fiber, path: Path): void => {
		fiber.pendingProps = copyWithDelete(fiber.memoizedProps, path);
		const alternate = fiber.alternate;
		if (alternate !== undefined) {
			alternate.pendingProps = fiber.pendingProps;
		}
		scheduleUpdateOnFiber(fiber, SyncLane, NoTimestamp);
	};

	overridePropsRenamePath = (fiber: Fiber, oldPath: Path, newPath: Path): void => {
		fiber.pendingProps = copyWithRename(fiber.memoizedProps, oldPath, newPath);
		const alternate = fiber.alternate;
		if (alternate !== undefined) {
			alternate.pendingProps = fiber.pendingProps;
		}
		scheduleUpdateOnFiber(fiber, SyncLane, NoTimestamp);
	};

	scheduleUpdate = (fiber: Fiber): void => {
		scheduleUpdateOnFiber(fiber, SyncLane, NoTimestamp);
	};

	setSuspenseHandler = (newShouldSuspendImpl: (fiber: Fiber) => boolean): void => {
		shouldSuspendImpl = newShouldSuspendImpl;
	};
}

function findHostInstanceByFiber(fiber: Fiber): Instance | TextInstance | undefined {
	const hostFiber = findCurrentHostFiber(fiber);
	if (hostFiber === undefined) {
		return undefined;
	}
	return hostFiber.stateNode;
}

function emptyFindFiberByHostInstance(_instance: Instance | TextInstance): Fiber | undefined {
	return undefined;
}

function getCurrentFiberForDevTools(): Fiber | undefined {
	return ReactCurrentFiber.current;
}

// DevTools injection

/**
 * Injects the renderer's public API into the DevTools hook.
 *
 * @returns Whether the injection succeeded.
 */
function injectIntoDevTools(devToolsConfig: DevToolsConfig): boolean {
	const { findFiberByHostInstance } = devToolsConfig;
	const ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
	const getCurrentFiber = __DEV__ ? getCurrentFiberForDevTools : undefined;

	return injectInternals({
		bundleType: devToolsConfig.bundleType,
		version: devToolsConfig.version,
		rendererPackageName: devToolsConfig.rendererPackageName,
		rendererConfig: devToolsConfig.rendererConfig,
		overrideHookState,
		overrideHookStateDeletePath,
		overrideHookStateRenamePath,
		overrideProps,
		overridePropsDeletePath,
		overridePropsRenamePath,
		setSuspenseHandler,
		scheduleUpdate,
		currentDispatcherRef: ReactCurrentDispatcher,
		findHostInstanceByFiber,
		findFiberByHostInstance: findFiberByHostInstance ?? emptyFindFiberByHostInstance,
		// React Refresh
		findHostInstancesForRefresh: __DEV__ ? ReactFiberHotReloading.findHostInstancesForRefresh : undefined,
		scheduleRefresh: __DEV__ ? ReactFiberHotReloading.scheduleRefresh : undefined,
		scheduleRoot: __DEV__ ? ReactFiberHotReloading.scheduleRoot : undefined,
		setRefreshHandler: __DEV__ ? ReactFiberHotReloading.setRefreshHandler : undefined,
		// Enables DevTools to append owner stacks to error messages in DEV mode.
		getCurrentFiber,
	});
}

// Work-loop re-exports

export {
	act,
	batchedEventUpdates,
	batchedUpdates,
	createContainer,
	deferredUpdates,
	discreteUpdates,
	flushControlled,
	flushDiscreteUpdates,
	flushPassiveEffects,
	flushSync,
	getPublicRootInstance,
	injectIntoDevTools,
	IsThisRendererActing,
	unbatchedUpdates,
	updateContainer,
};

// Default export

export default {
	ReactRootTags,
	ReactWorkTags,
	ReactTypeOfMode,
	ReactFiberFlags,
	getNearestMountedFiber,
	findCurrentFiberUsingSlowPath,
	createPortal,
	registerMutableSourceForHydration,
	createContainer,
	updateContainer,
	batchedEventUpdates,
	batchedUpdates,
	unbatchedUpdates,
	deferredUpdates,
	discreteUpdates,
	flushDiscreteUpdates,
	flushControlled,
	flushSync,
	flushPassiveEffects,
	IsThisRendererActing,
	act,
	getPublicRootInstance,
	attemptSynchronousHydration,
	attemptUserBlockingHydration,
	attemptContinuousHydration,
	attemptHydrationAtCurrentPriority,
	runWithPriority,
	getCurrentUpdateLanePriority,
	findHostInstance,
	findHostInstanceWithWarning,
	findHostInstanceWithNoPortals,
	shouldSuspend,
	injectIntoDevTools,
	robloxReactProfiling: RobloxReactProfiling,
	schedulingProfiler: {
		profilerEventTypes,
		registerProfilerEventCallback,
	},
};
