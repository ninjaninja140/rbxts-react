/**
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberBeginWork.new.lua`.
 */

import { __COMPAT_WARNINGS__, __DEV__, __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__ } from '@nrbx/react-globals';
import { tracing } from '@nrbx/scheduler';
import {
	checkPropTypes,
	console,
	ConsolePatchingDev,
	getComponentName,
	invariant,
	ReactFeatureFlags,
	ReactSharedInternals,
	ReactSymbols,
	shallowEqual,
} from '@nrbx/react-shared';

import ReactStrictModeWarnings from './ReactStrictModeWarnings.new';
import {
	FunctionComponent,
	ClassComponent,
	HostRoot,
	HostComponent,
	HostText,
	HostPortal,
	ForwardRef,
	Fragment,
	Mode,
	ContextProvider,
	ContextConsumer,
	Profiler,
	SuspenseComponent,
	SuspenseListComponent,
	MemoComponent,
	SimpleMemoComponent,
	LazyComponent,
	IncompleteClassComponent,
	OffscreenComponent,
	LegacyHiddenComponent,
	IndeterminateComponent,
} from './ReactWorkTags';
import {
	NoFlags,
	PerformedWork,
	Placement,
	Hydrating,
	ContentReset,
	DidCapture,
	Ref,
	Deletion,
	ForceUpdateForLegacySuspense,
	StaticMask,
} from './ReactFiberFlags';
import { getCurrentFiberOwnerNameInDevOrNull, setIsRendering } from './ReactCurrentFiber';
import {
	resolveFunctionForHotReloading,
	resolveForwardRefForHotReloading,
	resolveClassForHotReloading,
} from './ReactFiberHotReloading.new';
import { processUpdateQueue, cloneUpdateQueue, initializeUpdateQueue } from './ReactUpdateQueue.new';
import {
	NoLane,
	NoLanes,
	SyncLane,
	OffscreenLane,
	DefaultHydrationLane,
	SomeRetryLane,
	NoTimestamp,
	includesSomeLane,
	laneToLanes,
	removeLanes,
	mergeLanes,
	getBumpedLaneForHydration,
} from './ReactFiberLane';
import { ConcurrentMode, NoMode, ProfileMode, StrictMode, BlockingMode } from './ReactTypeOfMode';
import { pushHostContext, pushHostContainer } from './ReactFiberHostContext.new';
import {
	suspenseStackCursor,
	pushSuspenseContext,
	InvisibleParentSuspenseContext,
	ForceSuspenseFallback,
	hasSuspenseContext,
	setDefaultShallowSuspenseContext,
	addSubtreeSuspenseContext,
	setShallowSuspenseContext,
} from './ReactFiberSuspenseContext.new';
import { findFirstSuspended } from './ReactFiberSuspenseComponent.new';
import {
	pushProvider,
	propagateContextChange,
	readContext,
	prepareToReadContext,
	calculateChangedBits,
	scheduleWorkOnParentPath,
} from './ReactFiberNewContext.new';
import { stopProfilerTimerIfRunning } from './ReactProfilerTimer.new';
import {
	getMaskedContext,
	getUnmaskedContext,
	hasContextChanged as hasLegacyContextChanged,
	pushContextProvider as pushLegacyContextProvider,
	isContextProvider as isLegacyContextProvider,
	pushTopLevelContextObject,
	invalidateContextProvider,
} from './ReactFiberContext.new';
import {
	enterHydrationState,
	reenterHydrationStateFromDehydratedSuspenseInstance,
	resetHydrationState,
	tryToClaimNextHydratableInstance,
	warnIfHydrating,
} from './ReactFiberHydrationContext.new';
import {
	adoptClassInstance,
	applyDerivedStateFromProps,
	constructClassInstance,
	mountClassInstance,
	resumeMountClassInstance,
	updateClassInstance,
} from './ReactFiberClassComponent.new';
import { resolveDefaultProps } from './ReactFiberLazyComponent.new';
import {
	resolveLazyComponentTag,
	createFiberFromTypeAndProps,
	createFiberFromFragment,
	createFiberFromOffscreen,
	createWorkInProgress,
	isSimpleFunctionComponent,
} from './ReactFiber.new';
import { setWorkInProgressVersion } from './ReactMutableSource.new';
import { markSkippedUpdateLanes } from './ReactFiberWorkInProgress';
import HostConfig, { type Props, type SuspenseInstance, type Container } from './ReactFiberHostConfig';
import ReactFiberReconciler from './ReactFiberReconciler';
import ReactChildFiber from './ReactChildFiber.new';
import ReactFiberWorkLoop from './ReactFiberWorkLoop.new';
import type { Fiber, Lanes } from './types';

const {
	debugRenderPhaseSideEffectsForStrictMode,
	disableLegacyContext,
	disableModulePatternComponents,
	enableProfilerTimer,
	enableSchedulerTracing,
	enableSuspenseServerRenderer,
	warnAboutDefaultPropsOnFunctionComponents,
} = ReactFeatureFlags;

const { REACT_LAZY_TYPE, getIteratorFn: _getIteratorFn } = ReactSymbols;

// Host-config functions are read lazily (at call time) because the renderer
// splices its implementation in via `initialize()` long after this module has
// been `require`d. See ReactFiberHostConfig for details.
function shouldSetTextContent(type_: string, props: unknown): boolean {
	return HostConfig.shouldSetTextContent(type_, props as Props);
}
function isSuspenseInstancePending(instance: unknown): boolean {
	return HostConfig.isSuspenseInstancePending!(instance as SuspenseInstance);
}
function isSuspenseInstanceFallback(instance: unknown): boolean {
	return HostConfig.isSuspenseInstanceFallback!(instance as SuspenseInstance);
}
function registerSuspenseInstanceRetry(instance: unknown, callback: () => void): void {
	HostConfig.registerSuspenseInstanceRetry!(instance as SuspenseInstance, callback);
}
const supportsHydration = () => HostConfig.supportsHydration ?? false;

const mountChildFibers = ReactChildFiber.mountChildFibers;
const reconcileChildFibers = ReactChildFiber.reconcileChildFibers;
const cloneChildFibers = ReactChildFiber.cloneChildFibers;

const pushRenderLanes = ReactFiberWorkLoop.pushRenderLanes;
const markSpawnedWork = ReactFiberWorkLoop.markSpawnedWork;
const retryDehydratedSuspenseBoundary = ReactFiberWorkLoop.retryDehydratedSuspenseBoundary;
const scheduleUpdateOnFiber = ReactFiberWorkLoop.scheduleUpdateOnFiber;
const renderDidSuspendDelayIfPossible = ReactFiberWorkLoop.renderDidSuspendDelayIfPossible;
const getWorkInProgressRoot = ReactFiberWorkLoop.getWorkInProgressRoot;
const getExecutionContext = ReactFiberWorkLoop.getExecutionContext;
const RetryAfterError = ReactFiberWorkLoop.RetryAfterError;
const NoContext = ReactFiberWorkLoop.NoContext;

const disableLogs = ConsolePatchingDev.disableLogs;
const reenableLogs = ConsolePatchingDev.reenableLogs;

let Schedule_tracing_wrap: ((callback: (...args: Array<any>) => any) => (...args: Array<any>) => any) | undefined;

const lazyRefs = {
	renderWithHooksRef: undefined as ((...args: Array<any>) => any) | undefined,
	bailoutHooksRef: undefined as ((...args: Array<any>) => any) | undefined,
	shouldSuspendRef: undefined as ((...args: Array<any>) => boolean) | undefined,
};

function shouldSuspend(fiber: any): boolean {
	if (!lazyRefs.shouldSuspendRef) {
		lazyRefs.shouldSuspendRef = ReactFiberReconciler.shouldSuspend;
	}
	return lazyRefs.shouldSuspendRef!(fiber);
}

function getSiblingModule(moduleName: string): unknown {
	const parent = (script as ModuleScript).Parent;
	invariant(parent !== undefined, 'Expected module parent to exist.');
	const child = parent.FindFirstChild(moduleName);
	invariant(child?.IsA('ModuleScript') === true, "Expected sibling module '%s' to exist.", moduleName);
	return require(child as ModuleScript);
}

function initReactFiberHooks(): void {
	const hooks = getSiblingModule('ReactFiberHooks.new') as Record<string, (...args: Array<any>) => any>;
	lazyRefs.renderWithHooksRef = hooks.renderWithHooks;
	lazyRefs.bailoutHooksRef = hooks.bailoutHooks;
}

function renderWithHooks(...args: Array<unknown>): any {
	if (!lazyRefs.renderWithHooksRef) {
		initReactFiberHooks();
	}
	return lazyRefs.renderWithHooksRef!(...args);
}

function bailoutHooks(...args: Array<unknown>): any {
	if (!lazyRefs.bailoutHooksRef) {
		initReactFiberHooks();
	}
	return lazyRefs.bailoutHooksRef!(...args);
}

function unimplemented(message: string): never {
	console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	console.log(`UNIMPLEMENTED ERROR: ${tostring(message)}`);
	error(`FIXME (roblox): ${message} is unimplemented`);
}

const ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;

let didReceiveUpdate = false;

let didWarnAboutBadClass: Record<string, boolean> = {};
let didWarnAboutModulePatternComponent: Record<string, boolean> = {};
let didWarnAboutContextTypeOnFunctionComponent: Record<string, boolean> = {};
let didWarnAboutGetDerivedStateOnFunctionComponent: Record<string, boolean> = {};
let didWarnAboutFunctionRefs: Record<string, boolean> = {};
export let didWarnAboutReassigningProps = false;
let didWarnAboutRevealOrder: Record<string, boolean> = {};
let didWarnAboutTailOptions: Record<string, boolean> = {};
let didWarnAboutDefaultPropsOnFunctionComponent: Record<string, boolean> = {};

if (__DEV__) {
	didWarnAboutBadClass = {};
	didWarnAboutModulePatternComponent = {};
	didWarnAboutContextTypeOnFunctionComponent = {};
	didWarnAboutGetDerivedStateOnFunctionComponent = {};
	didWarnAboutFunctionRefs = {};
	didWarnAboutReassigningProps = false;
	didWarnAboutRevealOrder = {};
	didWarnAboutTailOptions = {};
	didWarnAboutDefaultPropsOnFunctionComponent = {};
}

function reconcileChildren(current: Fiber | undefined, workInProgress: Fiber, nextChildren: any, renderLanes: Lanes) {
	if (current === undefined) {
		// If this is a fresh new component that hasn't been rendered yet, we
		// won't update its child set by applying minimal side-effects. Instead,
		// we will add them all to the child before it gets rendered. That means
		// we can optimize this reconciliation pass by not tracking side-effects.
		workInProgress.child = mountChildFibers(workInProgress, undefined, nextChildren, renderLanes);
	} else {
		// If the current child is the same as the work in progress, it means that
		// we haven't yet started any work on these children. Therefore, we use
		// the clone algorithm to create a copy of all the current children.

		// If we had any progressed work already, that is invalid at this point so
		// let's throw it out.
		workInProgress.child = reconcileChildFibers(workInProgress, current.child, nextChildren, renderLanes);
	}
}

function forceUnmountCurrentAndReconcile(current: Fiber, workInProgress: Fiber, nextChildren: any, renderLanes: Lanes) {
	// This function is fork of reconcileChildren. It's used in cases where we
	// want to reconcile without matching against the existing set. This has the
	// effect of all current children being unmounted; even if the type and key
	// are the same, the old child is unmounted and a new child is created.
	//
	// To do this, we're going to go through the reconcile algorithm twice. In
	// the first pass, we schedule a deletion for all the current children by
	// passing undefined.
	workInProgress.child = reconcileChildFibers(workInProgress, current.child, undefined, renderLanes);
	// In the second pass, we mount the new children. The trick here is that we
	// pass undefined in place of where we usually pass the current child set. This has
	// the effect of remounting all children regardless of whether their
	// identities match.
	workInProgress.child = reconcileChildFibers(workInProgress, undefined, nextChildren, renderLanes);
}

function updateForwardRef(
	current: Fiber | undefined,
	workInProgress: Fiber,
	Component: Record<string, unknown>,
	nextProps: Record<string, unknown>,
	renderLanes: Lanes
) {
	// TODO: current can be non-undefined here even if the component
	// hasn't yet mounted. This happens after the first render suspends.
	// We'll need to figure out if this is fine or can cause issues.

	if (__DEV__ || __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__) {
		if (
			typeOf(Component) !== 'function' &&
			(workInProgress.type as unknown) !== (workInProgress.elementType as unknown)
		) {
			// Lazy component props can't be validated in createElement
			// because they're only guaranteed to be resolved here.
			const innerPropTypes = Component.propTypes as Record<string, defined>;
			const validateProps = Component.validateProps as unknown;
			if (innerPropTypes || validateProps) {
				checkPropTypes(
					innerPropTypes,
					validateProps as any,
					nextProps, // Resolved props
					'prop',
					getComponentName(Component)
				);
			}
		}
	}

	const render = Component.render;
	const ref = workInProgress.ref;

	// The rest is a fork of updateFunctionComponent
	let nextChildren: any;
	prepareToReadContext(workInProgress, renderLanes, markWorkInProgressReceivedUpdate);
	if (__DEV__) {
		ReactCurrentOwner.current = workInProgress;
		setIsRendering(true);
		nextChildren = renderWithHooks(current, workInProgress, render, nextProps, ref, renderLanes);
		if (debugRenderPhaseSideEffectsForStrictMode && workInProgress.mode & StrictMode) {
			disableLogs();
			try {
				nextChildren = renderWithHooks(current, workInProgress, render, nextProps, ref, renderLanes);
			} finally {
				reenableLogs();
			}
		}
		setIsRendering(false);
	} else {
		nextChildren = renderWithHooks(current, workInProgress, render, nextProps, ref, renderLanes);
	}

	if (current !== undefined && !didReceiveUpdate) {
		bailoutHooks(current, workInProgress, renderLanes);
		return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
	}

	// React DevTools reads this flag.
	workInProgress.flags |= PerformedWork;
	reconcileChildren(current, workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

function updateMemoComponent(
	current: Fiber | undefined,
	workInProgress: Fiber,
	Component: Record<string, unknown>,
	nextProps: Record<string, unknown>,
	updateLanes: Lanes,
	renderLanes: Lanes
) {
	if (current === undefined) {
		const type_ = Component.type as Record<string, unknown>;
		if (
			isSimpleFunctionComponent(type_) &&
			Component.compare === undefined &&
			// SimpleMemoComponent codepath doesn't resolve outer props either.
			Component.defaultProps === undefined
		) {
			let resolvedType = type_;
			if (__DEV__) {
				resolvedType = resolveFunctionForHotReloading(type_);
			}
			// If this is a plain function component without default props,
			// and with only the default shallow comparison, we upgrade it
			// to a SimpleMemoComponent to allow fast path updates.
			workInProgress.tag = SimpleMemoComponent;
			workInProgress.type = resolvedType;
			if (__DEV__) {
				validateFunctionComponentInDev(workInProgress, type_);
			}
			return updateSimpleMemoComponent(
				current,
				workInProgress,
				resolvedType,
				nextProps,
				updateLanes,
				renderLanes
			);
		}
		if (__DEV__ || __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__) {
			const innerPropTypes = type_.propTypes as Record<string, defined>;
			const validateProps = type_.validateProps as unknown;
			if (innerPropTypes || validateProps) {
				// Inner memo component props aren't currently validated in createElement.
				// We could move it there, but we'd still need this for lazy code path.
				checkPropTypes(
					innerPropTypes,
					validateProps as any,
					nextProps, // Resolved props
					'prop',
					getComponentName(type_)
				);
			}
		}
		const child = createFiberFromTypeAndProps(
			Component.type,
			undefined,
			nextProps,
			workInProgress,
			workInProgress.mode,
			renderLanes
		);
		child.ref = workInProgress.ref;
		child.return_ = workInProgress;
		workInProgress.child = child;
		return child;
	}
	if (__DEV__ || __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__) {
		const type_ = Component.type as Record<string, unknown>;
		const innerPropTypes = type_.propTypes as Record<string, defined>;
		const validateProps = type_.validateProps as unknown;
		if (innerPropTypes || validateProps) {
			// Inner memo component props aren't currently validated in createElement.
			// We could move it there, but we'd still need this for lazy code path.
			checkPropTypes(
				innerPropTypes,
				validateProps as any,
				nextProps, // Resolved props
				'prop',
				getComponentName(type_)
			);
		}
	}
	const currentChild = current.child as Fiber; // This is always exactly one child
	if (!includesSomeLane(updateLanes, renderLanes)) {
		// This will be the props with resolved defaultProps,
		// unlike current.memoizedProps which will be the unresolved ones.
		const prevProps = currentChild.memoizedProps;
		// Default to shallow comparison
		let compare = Component.compare as (a: any, b: any) => boolean;
		compare = compare !== undefined ? compare : shallowEqual;
		if (compare(prevProps, nextProps) && (current.ref as unknown) === (workInProgress.ref as unknown)) {
			return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
		}
	}
	// React DevTools reads this flag.
	workInProgress.flags |= PerformedWork;
	const newChild = createWorkInProgress(currentChild, nextProps);
	newChild.ref = workInProgress.ref;
	newChild.return_ = workInProgress;
	workInProgress.child = newChild;
	return newChild;
}

function updateSimpleMemoComponent(
	current: Fiber | undefined,
	workInProgress: Fiber,
	Component: Record<string, unknown>,
	nextProps: Record<string, unknown>,
	updateLanes: Lanes,
	renderLanes: Lanes
) {
	// TODO: current can be non-undefined here even if the component
	// hasn't yet mounted. This happens when the inner render suspends.
	// We'll need to figure out if this is fine or can cause issues.

	if (__DEV__ || __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__) {
		if ((workInProgress.type as unknown) !== (workInProgress.elementType as unknown)) {
			// Lazy component props can't be validated in createElement
			// because they're only guaranteed to be resolved here.
			let outerMemoType = workInProgress.elementType as Record<string, unknown>;
			if (outerMemoType.$$typeof === REACT_LAZY_TYPE) {
				// We warn when you define propTypes on lazy()
				// so let's just skip over it to find memo() outer wrapper.
				// Inner props for memo are validated later.
				const lazyComponent = outerMemoType;
				const payload = lazyComponent._payload;
				const init = lazyComponent._init as (payload: any) => any;
				try {
					outerMemoType = init(payload) as Record<string, unknown>;
				} catch (_x) {
					outerMemoType = undefined as unknown as Record<string, unknown>;
				}
				// Inner propTypes will be validated in the function component path.
				const outerPropTypes = outerMemoType?.propTypes;
				const validateProps = outerMemoType?.validateProps;
				if (outerPropTypes || validateProps) {
					checkPropTypes(
						outerPropTypes as Record<string, defined>,
						validateProps as any,
						nextProps, // Resolved (SimpleMemoComponent has no defaultProps)
						'prop',
						getComponentName(outerMemoType)
					);
				}
			}
		}
	}
	if (current !== undefined) {
		const prevProps = current.memoizedProps;
		if (
			shallowEqual(prevProps, nextProps) &&
			(current.ref as unknown) === (workInProgress.ref as unknown) &&
			// Prevent bailout if the implementation changed due to hot reload.
			(__DEV__ ? (workInProgress.type as unknown) === (current.type as unknown) : true)
		) {
			didReceiveUpdate = false;
			if (!includesSomeLane(renderLanes, updateLanes)) {
				// The pending lanes were cleared at the beginning of beginWork. We're
				// about to bail out, but there might be other lanes that weren't
				// included in the current render. Usually, the priority level of the
				// remaining updates is accumlated during the evaluation of the
				// component (i.e. when processing the update queue). But since since
				// we're bailing out early *without* evaluating the component, we need
				// to account for it here, too. Reset to the value of the current fiber.
				// NOTE: This only applies to SimpleMemoComponent, not MemoComponent,
				// because a MemoComponent fiber does not have hooks or an update queue;
				// rather, it wraps around an inner component, which may or may not
				// contains hooks.
				// TODO: Move the reset at in beginWork out of the common path so that
				// this is no longer necessary.
				workInProgress.lanes = current.lanes;
				return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
			} else if ((current.flags & ForceUpdateForLegacySuspense) !== NoFlags) {
				// This is a special case that only exists for legacy mode.
				// See https://github.com/facebook/react/pull/19216.
				didReceiveUpdate = true;
			}
		}
	}
	return updateFunctionComponent(current, workInProgress, Component, nextProps, renderLanes);
}

function updateOffscreenComponent(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	const nextProps = workInProgress.pendingProps as Record<string, unknown>;
	const nextChildren = nextProps.children;

	const prevState =
		current !== undefined ? (current.memoizedState as Record<string, unknown> | undefined) : undefined;

	if (nextProps.mode === 'hidden' || nextProps.mode === 'unstable-defer-without-hiding') {
		if ((workInProgress.mode & ConcurrentMode) === NoMode) {
			// In legacy sync mode, don't defer the subtree. Render it now.
			// TODO: Figure out what we should do in Blocking mode.
			const nextState = {
				baseLanes: NoLanes,
			};
			workInProgress.memoizedState = nextState;
			pushRenderLanes(workInProgress, renderLanes);
		} else if (!includesSomeLane(renderLanes, OffscreenLane)) {
			let nextBaseLanes: Lanes;
			if (prevState !== undefined) {
				const prevBaseLanes = prevState.baseLanes as Lanes;
				nextBaseLanes = mergeLanes(prevBaseLanes, renderLanes);
			} else {
				nextBaseLanes = renderLanes;
			}

			// Schedule this fiber to re-render at offscreen priority. Then bailout.
			if (enableSchedulerTracing) {
				markSpawnedWork(OffscreenLane);
			}
			workInProgress.lanes = workInProgress.childLanes = laneToLanes(OffscreenLane);
			const nextState = {
				baseLanes: nextBaseLanes,
			};
			workInProgress.memoizedState = nextState;
			// We're about to bail out, but we need to push this to the stack anyway
			// to avoid a push/pop misalignment.
			pushRenderLanes(workInProgress, nextBaseLanes);
			return undefined;
		} else {
			// Rendering at offscreen, so we can clear the base lanes.
			const nextState = {
				baseLanes: NoLanes,
			};
			workInProgress.memoizedState = nextState;
			// Push the lanes that were skipped when we bailed out.
			const subtreeRenderLanes = prevState !== undefined ? (prevState.baseLanes as Lanes) : renderLanes;
			pushRenderLanes(workInProgress, subtreeRenderLanes);
		}
	} else {
		let subtreeRenderLanes: Lanes;
		if (prevState !== undefined) {
			subtreeRenderLanes = mergeLanes(prevState.baseLanes as Lanes, renderLanes);
			// Since we're not hidden anymore, reset the state
			workInProgress.memoizedState = undefined;
		} else {
			// We weren't previously hidden, and we still aren't, so there's nothing
			// special to do. Need to push to the stack regardless, though, to avoid
			// a push/pop misalignment.
			subtreeRenderLanes = renderLanes;
		}
		pushRenderLanes(workInProgress, subtreeRenderLanes);
	}

	reconcileChildren(current, workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

// Note: These happen to have identical begin phases, for now. We shouldn't hold
// ourselves to this constraint, though. If the behavior diverges, we should
// fork the function.
const updateLegacyHiddenComponent = updateOffscreenComponent;

function updateFragment(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	const nextChildren = workInProgress.pendingProps;
	reconcileChildren(current, workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

function updateMode(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	const nextChildren = (workInProgress.pendingProps as Record<string, unknown>).children;
	reconcileChildren(current, workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

function updateProfiler(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	if (enableProfilerTimer) {
		// Reset effect durations for the next eventual effect phase.
		// These are reset during render to allow the DevTools commit hook a chance to read them,
		const stateNode = workInProgress.stateNode;
		stateNode.effectDuration = 0;
		stateNode.passiveEffectDuration = 0;
	}
	const nextProps = workInProgress.pendingProps as Record<string, unknown>;
	const nextChildren = nextProps.children;
	reconcileChildren(current, workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

function markRef(current: Fiber | undefined, workInProgress: Fiber) {
	const ref = workInProgress.ref;
	if (
		(current === undefined && (ref as unknown) !== undefined) ||
		(current !== undefined && (current.ref as unknown) !== (ref as unknown))
	) {
		// Schedule a Ref effect
		workInProgress.flags |= Ref;
	}
}

function updateFunctionComponent(
	current: Fiber | undefined,
	workInProgress: Fiber,
	Component: Record<string, unknown>,
	nextProps: Record<string, unknown>,
	renderLanes: Lanes
) {
	if (__DEV__ || __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__) {
		if ((workInProgress.type as unknown) !== (workInProgress.elementType as unknown)) {
			// Lazy component props can't be validated in createElement
			// because they're only guaranteed to be resolved here.
			const innerPropTypes = Component.propTypes as Record<string, defined>;
			const validateProps = Component.validateProps as unknown;
			if (innerPropTypes || validateProps) {
				checkPropTypes(
					innerPropTypes,
					validateProps as any,
					nextProps, // Resolved props
					'prop',
					getComponentName(Component)
				);
			}
		}
	}

	let context: object = {};
	if (!disableLegacyContext) {
		const unmaskedContext = getUnmaskedContext(workInProgress, Component, true);
		context = getMaskedContext(workInProgress, unmaskedContext);
	}

	let nextChildren: any;
	prepareToReadContext(workInProgress, renderLanes, markWorkInProgressReceivedUpdate);
	if (__DEV__) {
		ReactCurrentOwner.current = workInProgress;
		setIsRendering(true);
		nextChildren = renderWithHooks(current, workInProgress, Component, nextProps, context, renderLanes);
		if (debugRenderPhaseSideEffectsForStrictMode && workInProgress.mode & StrictMode) {
			disableLogs();
			try {
				nextChildren = renderWithHooks(current, workInProgress, Component, nextProps, context, renderLanes);
			} finally {
				reenableLogs();
			}
		}
		setIsRendering(false);
	} else {
		nextChildren = renderWithHooks(current, workInProgress, Component, nextProps, context, renderLanes);
	}

	if (current !== undefined && !didReceiveUpdate) {
		bailoutHooks(current, workInProgress, renderLanes);
		return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
	}

	// React DevTools reads this flag.
	workInProgress.flags |= PerformedWork;
	reconcileChildren(current, workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

function _updateBlock(
	current: Fiber | undefined,
	workInProgress: Fiber,
	block: Record<string, unknown>,
	nextProps: Record<string, unknown>,
	renderLanes: Lanes
) {
	// TODO: current can be non-undefined here even if the component
	// hasn't yet mounted. This happens after the first render suspends.
	// We'll need to figure out if this is fine or can cause issues.

	const render = block._render;
	const data = block._data;

	// The rest is a fork of updateFunctionComponent
	let nextChildren: any;
	prepareToReadContext(workInProgress, renderLanes, markWorkInProgressReceivedUpdate);
	if (__DEV__) {
		ReactCurrentOwner.current = workInProgress;
		setIsRendering(true);
		nextChildren = renderWithHooks(current, workInProgress, render, nextProps, data, renderLanes);
		if (debugRenderPhaseSideEffectsForStrictMode && workInProgress.mode & StrictMode) {
			disableLogs();
			try {
				nextChildren = renderWithHooks(current, workInProgress, render, nextProps, data, renderLanes);
			} finally {
				reenableLogs();
			}
		}
		setIsRendering(false);
	} else {
		nextChildren = renderWithHooks(current, workInProgress, render, nextProps, data, renderLanes);
	}

	if (current !== undefined && !didReceiveUpdate) {
		bailoutHooks(current, workInProgress, renderLanes);
		return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
	}

	// React DevTools reads this flag.
	workInProgress.flags |= PerformedWork;
	reconcileChildren(current, workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

function updateClassComponent(
	current: Fiber | undefined,
	workInProgress: Fiber,
	Component: Record<string, unknown>,
	nextProps: Record<string, unknown>,
	renderLanes: Lanes
) {
	if (__DEV__ || __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__) {
		if ((workInProgress.type as unknown) !== (workInProgress.elementType as unknown)) {
			// Lazy component props can't be validated in createElement
			// because they're only guaranteed to be resolved here.
			const innerPropTypes = Component.propTypes as Record<string, defined>;
			const validateProps = Component.validateProps as unknown;
			if (innerPropTypes || validateProps) {
				checkPropTypes(
					innerPropTypes,
					validateProps as any,
					nextProps, // Resolved props
					'prop',
					getComponentName(Component)
				);
			}
		}
	}

	// Push context providers early to prevent context stack mismatches.
	// During mounting we don't know the child context yet as the instance doesn't exist.
	// We will invalidate the child context in finishClassComponent() right after rendering.
	let hasContext: boolean;
	if (isLegacyContextProvider(Component)) {
		hasContext = true;
		pushLegacyContextProvider(workInProgress);
	} else {
		hasContext = false;
	}
	prepareToReadContext(workInProgress, renderLanes, markWorkInProgressReceivedUpdate);

	const instance = workInProgress.stateNode as Record<string, unknown> | undefined;
	let shouldUpdate: boolean;
	if (instance === undefined) {
		if (current !== undefined) {
			// A class component without an instance only mounts if it suspended
			// inside a non-concurrent tree, in an inconsistent state. We want to
			// treat it like a new mount, even though an empty version of it already
			// committed. Disconnect the alternate pointers.
			current.alternate = undefined;
			workInProgress.alternate = undefined;
			// Since this is conceptually a new fiber, schedule a Placement effect
			workInProgress.flags |= Placement;
		}
		// In the initial pass we might need to construct the instance.
		constructClassInstance(workInProgress, Component, nextProps);
		mountClassInstance(workInProgress, Component, nextProps, renderLanes);
		shouldUpdate = true;
	} else if (current === undefined) {
		// In a resume, we'll already have an instance we can reuse.
		shouldUpdate = resumeMountClassInstance(workInProgress, Component, nextProps, renderLanes);
	} else {
		shouldUpdate = updateClassInstance(current, workInProgress, Component, nextProps, renderLanes);
	}
	const nextUnitOfWork = finishClassComponent(
		current,
		workInProgress,
		Component,
		shouldUpdate,
		hasContext,
		renderLanes
	);
	if (__DEV__) {
		const inst = workInProgress.stateNode as Record<string, unknown>;
		if (shouldUpdate && inst.props !== nextProps) {
			if (!didWarnAboutReassigningProps) {
				console.error(
					'It looks like %s is reassigning its own `this.props` while rendering. ' +
						'This is not supported and can lead to confusing bugs.',
					getComponentName(workInProgress.type) || 'a component'
				);
			}
			didWarnAboutReassigningProps = true;
		}
	}
	return nextUnitOfWork;
}

function finishClassComponent(
	current: Fiber | undefined,
	workInProgress: Fiber,
	Component: Record<string, unknown>,
	shouldUpdate: boolean,
	hasContext: boolean,
	renderLanes: Lanes
) {
	// Refs should update even if shouldComponentUpdate returns false
	markRef(current, workInProgress);

	const didCaptureError = (workInProgress.flags & DidCapture) !== NoFlags;

	if (!shouldUpdate && !didCaptureError) {
		// Context providers should defer to sCU for rendering
		if (hasContext) {
			invalidateContextProvider(workInProgress, Component, false);
		}

		return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
	}

	const instance = workInProgress.stateNode as Record<string, unknown>;

	// Rerender
	ReactCurrentOwner.current = workInProgress;
	let nextChildren: any;
	if (didCaptureError && typeOf(Component.getDerivedStateFromError) !== 'function') {
		// If we captured an error, but getDerivedStateFromError is not defined,
		// unmount all the children. componentDidCatch will schedule an update to
		// re-render a fallback. This is temporary until we migrate everyone to
		// the new API.
		// TODO: Warn in a future release.
		nextChildren = undefined;

		if (enableProfilerTimer) {
			stopProfilerTimerIfRunning(workInProgress);
		}
	} else {
		if (__DEV__) {
			setIsRendering(true);
			nextChildren = (instance.render as (this: unknown) => unknown)();
			if (debugRenderPhaseSideEffectsForStrictMode && workInProgress.mode & StrictMode) {
				disableLogs();
				try {
					(instance.render as (this: unknown) => unknown)();
				} finally {
					reenableLogs();
				}
			}
			setIsRendering(false);
		} else {
			nextChildren = (instance.render as (this: unknown) => unknown)();
		}
	}

	// React DevTools reads this flag.
	workInProgress.flags |= PerformedWork;
	if (current !== undefined && didCaptureError) {
		// If we're recovering from an error, reconcile without reusing any of
		// the existing children. Conceptually, the normal children and the children
		// that are shown on error are two different sets, so we shouldn't reuse
		// normal children even if their identities match.
		forceUnmountCurrentAndReconcile(current, workInProgress, nextChildren, renderLanes);
	} else {
		reconcileChildren(current, workInProgress, nextChildren, renderLanes);
	}

	// Memoize state using the values we just used to render.
	// TODO: Restructure so we never read values from the instance.
	workInProgress.memoizedState = instance.state;

	// The context might have changed so we need to recalculate it.
	if (hasContext) {
		invalidateContextProvider(workInProgress, Component, true);
	}

	return workInProgress.child;
}

function pushHostRootContext(workInProgress: Fiber) {
	const root = workInProgress.stateNode as Record<string, unknown>;
	if (root.pendingContext) {
		pushTopLevelContextObject(workInProgress, root.pendingContext, root.pendingContext !== root.context);
	} else if (root.context) {
		// Should always be set
		pushTopLevelContextObject(workInProgress, root.context, false);
	}
	pushHostContainer(workInProgress, root.containerInfo as Container);
}

function updateHostRoot(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	pushHostRootContext(workInProgress);
	const updateQueue = workInProgress.updateQueue as Record<string, unknown> | undefined;
	invariant(
		current !== undefined && updateQueue !== undefined,
		'If the root does not have an updateQueue, we should have already ' +
			'bailed out. This error is likely caused by a bug in React. Please ' +
			'file an issue.'
	);
	const nextProps = workInProgress.pendingProps as Record<string, unknown>;
	const prevState = workInProgress.memoizedState as Record<string, unknown> | undefined;
	const prevChildren = prevState !== undefined ? prevState.element : undefined;
	cloneUpdateQueue(current, workInProgress);
	processUpdateQueue(workInProgress, nextProps, undefined, renderLanes);
	const nextState = workInProgress.memoizedState as Record<string, unknown>;
	// Caution: React DevTools currently depends on this property
	// being called "element".
	const nextChildren = nextState.element;
	if (nextChildren === prevChildren) {
		resetHydrationState();
		return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
	}
	const root = workInProgress.stateNode as Record<string, unknown>;
	if (root.hydrate && enterHydrationState(workInProgress)) {
		// If we don't have any current children this might be the first pass.
		// We always try to hydrate. If this isn't a hydration pass there won't
		// be any children to hydrate which is effectively the same thing as
		// not hydrating.

		if (supportsHydration()) {
			const mutableSourceEagerHydrationData = root.mutableSourceEagerHydrationData as Array<unknown>;
			if (mutableSourceEagerHydrationData !== undefined) {
				for (let i = 0; i < mutableSourceEagerHydrationData.size(); i += 2) {
					const mutableSource = mutableSourceEagerHydrationData[i] as any;
					const version = mutableSourceEagerHydrationData[i + 1] as any;
					setWorkInProgressVersion(mutableSource, version);
				}
			}
		}

		const child = mountChildFibers(workInProgress, undefined, nextChildren, renderLanes);
		workInProgress.child = child;

		let node = child;
		while (node) {
			// Mark each child as hydrating. This is a fast path to know whether this
			// tree is part of a hydrating tree. This is used to determine if a child
			// node has fully mounted yet, and for scheduling event replaying.
			// Conceptually this is similar to Placement in that a new subtree is
			// inserted into the React tree here. It just happens to not need DOM
			// mutations because it already exists.
			node.flags = (node.flags & ~Placement) | Hydrating;
			node = node.sibling;
		}
	} else {
		// Otherwise reset hydration state in case we aborted and resumed another
		// root.
		reconcileChildren(current, workInProgress, nextChildren, renderLanes);
		resetHydrationState();
	}
	return workInProgress.child;
}

function updateHostComponent(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	pushHostContext(workInProgress);

	if (current === undefined) {
		tryToClaimNextHydratableInstance(workInProgress);
	}

	const type_ = workInProgress.type as string;
	const nextProps = workInProgress.pendingProps as Record<string, unknown>;
	const prevProps = current !== undefined ? current.memoizedProps : undefined;

	let nextChildren = nextProps.children;
	const isDirectTextChild = shouldSetTextContent(type_, nextProps);

	if (isDirectTextChild) {
		// We special case a direct text child of a host node. This is a common
		// case. We won't handle it as a reified child. We will instead handle
		// this in the host environment that also has access to this prop. That
		// avoids allocating another HostText fiber and traversing it.
		nextChildren = undefined;
	} else if ((prevProps as unknown) !== undefined && shouldSetTextContent(type_, prevProps)) {
		// If we're switching from a direct text child to a normal child, or to
		// empty, we need to schedule the text content to be reset.
		workInProgress.flags |= ContentReset;
	}

	// React DevTools reads this flag.
	workInProgress.flags |= PerformedWork;

	markRef(current, workInProgress);
	reconcileChildren(current, workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

function updateHostText(current: Fiber | undefined, workInProgress: Fiber) {
	if (current === undefined) {
		tryToClaimNextHydratableInstance(workInProgress);
	}
	// Nothing to do here. This is terminal. We'll do the completion step
	// immediately after.
	return undefined;
}

function mountLazyComponent(
	_current: Fiber | undefined,
	workInProgress: Fiber,
	elementType: Record<string, unknown>,
	updateLanes: Lanes,
	renderLanes: Lanes
) {
	if (_current !== undefined) {
		// A lazy component only mounts if it suspended inside a non-
		// concurrent tree, in an inconsistent state. We want to treat it like
		// a new mount, even though an empty version of it already committed.
		// Disconnect the alternate pointers.
		_current.alternate = undefined;
		workInProgress.alternate = undefined;
		// Since this is conceptually a new fiber, schedule a Placement effect
		workInProgress.flags |= Placement;
	}

	const props = workInProgress.pendingProps;
	const lazyComponent = elementType;
	const payload = lazyComponent._payload as any;
	const init = lazyComponent._init as (payload: any) => any;
	let Component = init(payload) as Record<string, unknown>;
	// Store the unwrapped component in the type.
	workInProgress.type = Component;
	workInProgress.tag = resolveLazyComponentTag(Component);
	const resolvedTag = workInProgress.tag;
	const resolvedProps = resolveDefaultProps(Component, props);
	let child: Fiber | undefined;
	switch (resolvedTag) {
		case FunctionComponent: {
			if (__DEV__) {
				validateFunctionComponentInDev(workInProgress, Component);
				Component = resolveFunctionForHotReloading(Component);
				workInProgress.type = Component;
			}
			child = updateFunctionComponent(undefined, workInProgress, Component, resolvedProps, renderLanes);
			return child;
		}
		case ClassComponent: {
			if (__DEV__) {
				Component = resolveClassForHotReloading(Component);
				workInProgress.type = Component;
			}
			child = updateClassComponent(undefined, workInProgress, Component, resolvedProps, renderLanes);
			return child;
		}
		case ForwardRef: {
			if (__DEV__) {
				Component = resolveForwardRefForHotReloading(Component);
				workInProgress.type = Component;
			}
			child = updateForwardRef(undefined, workInProgress, Component, resolvedProps, renderLanes);
			return child;
		}
		case MemoComponent: {
			if (__DEV__ || __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__) {
				if ((workInProgress.type as unknown) !== (workInProgress.elementType as unknown)) {
					const outerPropTypes = Component.propTypes as Record<string, defined>;
					const validateProps = Component.validateProps as unknown;
					if (outerPropTypes || validateProps) {
						checkPropTypes(
							outerPropTypes as Record<string, defined>,
							validateProps as any,
							resolvedProps, // Resolved for outer only
							'prop',
							getComponentName(Component)
						);
					}
				}
			}
			child = updateMemoComponent(
				undefined,
				workInProgress,
				Component,
				resolveDefaultProps(Component.type as defined, resolvedProps), // The inner type can have defaults too
				updateLanes,
				renderLanes
			);
			return child;
		}
		// case Block: {
		// 	unimplemented("Blocks API");
		// }
	}
	let hint = '';
	if (__DEV__) {
		if (Component !== undefined && typeOf(Component) === 'table' && Component.$$typeof === REACT_LAZY_TYPE) {
			hint = ' Did you wrap a component in React.lazy() more than once?';
		}
	}
	// This message intentionally doesn't mention ForwardRef or MemoComponent
	// because the fact that it's a separate type of work is an
	// implementation detail.
	invariant(
		false,
		'Element type is invalid. Received a promise that resolves to: %s. ' +
			'Lazy element type must resolve to a class or function.%s',
		Component,
		hint
	);
}

function mountIncompleteClassComponent(
	_current: Fiber | undefined,
	workInProgress: Fiber,
	Component: Record<string, unknown>,
	nextProps: Record<string, unknown>,
	renderLanes: Lanes
) {
	if (_current !== undefined) {
		// An incomplete component only mounts if it suspended inside a non-
		// concurrent tree, in an inconsistent state. We want to treat it like
		// a new mount, even though an empty version of it already committed.
		// Disconnect the alternate pointers.
		_current.alternate = undefined;
		workInProgress.alternate = undefined;
		// Since this is conceptually a new fiber, schedule a Placement effect
		workInProgress.flags |= Placement;
	}

	// Promote the fiber to a class and try rendering again.
	workInProgress.tag = ClassComponent;

	// The rest of this function is a fork of `updateClassComponent`

	// Push context providers early to prevent context stack mismatches.
	// During mounting we don't know the child context yet as the instance doesn't exist.
	// We will invalidate the child context in finishClassComponent() right after rendering.
	let hasContext: boolean;
	if (isLegacyContextProvider(Component)) {
		hasContext = true;
		pushLegacyContextProvider(workInProgress);
	} else {
		hasContext = false;
	}
	prepareToReadContext(workInProgress, renderLanes, markWorkInProgressReceivedUpdate);

	constructClassInstance(workInProgress, Component, nextProps);
	mountClassInstance(workInProgress, Component, nextProps, renderLanes);

	return finishClassComponent(undefined, workInProgress, Component, true, hasContext, renderLanes);
}

function mountIndeterminateComponent(
	_current: Fiber | undefined,
	workInProgress: Fiber,
	Component: Record<string, unknown>,
	renderLanes: Lanes
) {
	if (_current !== undefined) {
		// An indeterminate component only mounts if it suspended inside a non-
		// concurrent tree, in an inconsistent state. We want to treat it like
		// a new mount, even though an empty version of it already committed.
		// Disconnect the alternate pointers.
		_current.alternate = undefined;
		workInProgress.alternate = undefined;
		// Since this is conceptually a new fiber, schedule a Placement effect
		workInProgress.flags |= Placement;
	}

	const props = workInProgress.pendingProps;
	let context: object = {};
	if (!disableLegacyContext) {
		const unmaskedContext = getUnmaskedContext(workInProgress, Component, false);
		context = getMaskedContext(workInProgress, unmaskedContext);
	}

	prepareToReadContext(workInProgress, renderLanes, markWorkInProgressReceivedUpdate);
	let value: Record<string, unknown>;

	if (__DEV__) {
		if (typeOf(Component) === 'table' && typeOf(Component.render) === 'function') {
			const componentName = getComponentName(Component) || 'Unknown';

			if (!didWarnAboutBadClass[componentName]) {
				console.error(
					"The <%s /> component appears to have a render method, but doesn't extend React.Component. " +
						'This is likely to cause errors. Change %s to extend React.Component instead.',
					componentName,
					componentName
				);
				didWarnAboutBadClass[componentName] = true;
			}
		}

		if (workInProgress.mode & StrictMode) {
			ReactStrictModeWarnings.recordLegacyContextWarning(workInProgress, undefined);
		}

		setIsRendering(true);
		ReactCurrentOwner.current = workInProgress;
		value = renderWithHooks(undefined, workInProgress, Component, props, context, renderLanes);
		setIsRendering(false);
	} else {
		value = renderWithHooks(undefined, workInProgress, Component, props, context, renderLanes);
	}
	// React DevTools reads this flag.
	workInProgress.flags |= PerformedWork;

	if (__DEV__) {
		// Support for module components is deprecated and is removed behind a flag.
		// Whether or not it would crash later, we want to show a good message in DEV first.
		if (
			typeOf(value) === 'table' &&
			value !== undefined &&
			typeOf(value.render) === 'function' &&
			value.$$typeof === undefined
		) {
			const componentName = getComponentName(Component) || 'Unknown';
			if (!didWarnAboutModulePatternComponent[componentName]) {
				console.error(
					'The <%s /> component appears to be a function component that returns a class instance. ' +
						'Change %s to a class that extends React.Component instead. ',
					componentName,
					componentName
				);
				didWarnAboutModulePatternComponent[componentName] = true;
			}
		}
	}

	if (
		// Run these checks in production only if the flag is off.
		// Eventually we'll delete this branch altogether.
		!disableModulePatternComponents &&
		typeOf(value) === 'table' &&
		value !== undefined &&
		typeOf(value.render) === 'function' &&
		value.$$typeof === undefined
	) {
		if (__DEV__) {
			const componentName = getComponentName(Component) || 'Unknown';
			if (!didWarnAboutModulePatternComponent[componentName]) {
				console.error(
					'The <%s /> component appears to be a function component that returns a class instance. ' +
						'Change %s to a class that extends React.Component instead. ',
					componentName,
					componentName
				);
				didWarnAboutModulePatternComponent[componentName] = true;
			}
		}

		// Proceed under the assumption that this is a class instance
		workInProgress.tag = ClassComponent;

		// Throw out any hooks that were used.
		workInProgress.memoizedState = undefined;
		workInProgress.updateQueue = undefined;

		// Push context providers early to prevent context stack mismatches.
		// During mounting we don't know the child context yet as the instance doesn't exist.
		// We will invalidate the child context in finishClassComponent() right after rendering.
		let hasContext = false;
		if (isLegacyContextProvider(Component)) {
			hasContext = true;
			pushLegacyContextProvider(workInProgress);
		} else {
			hasContext = false;
		}

		workInProgress.memoizedState = value.state !== undefined && value.state !== undefined ? value.state : undefined;

		initializeUpdateQueue(workInProgress);

		const getDerivedStateFromProps =
			typeOf(Component) !== 'function' ? Component.getDerivedStateFromProps : undefined;
		if (typeOf(getDerivedStateFromProps) === 'function') {
			applyDerivedStateFromProps(workInProgress, Component as any, getDerivedStateFromProps as any, props);
		}

		adoptClassInstance(workInProgress, value);
		mountClassInstance(workInProgress, Component, props, renderLanes);
		return finishClassComponent(undefined, workInProgress, Component, true, hasContext, renderLanes);
	} else {
		// Proceed under the assumption that this is a function component
		workInProgress.tag = FunctionComponent;
		if (__DEV__) {
			if (disableLegacyContext && Component.contextTypes) {
				console.error(
					'%s uses the legacy contextTypes API which is no longer supported. ' +
						'Use React.createContext() with React.useContext() instead.',
					getComponentName(Component) || 'Unknown'
				);
			}

			if (debugRenderPhaseSideEffectsForStrictMode && workInProgress.mode & StrictMode) {
				disableLogs();
				try {
					value = renderWithHooks(undefined, workInProgress, Component, props, context, renderLanes);
				} finally {
					reenableLogs();
				}
			}
		}
		reconcileChildren(undefined, workInProgress, value, renderLanes);
		if (__DEV__) {
			validateFunctionComponentInDev(workInProgress, Component);
		}
		return workInProgress.child;
	}
}

function validateFunctionComponentInDev(workInProgress: Fiber, Component: Record<string, unknown>) {
	if (__DEV__) {
		if ((workInProgress.ref as unknown) !== undefined) {
			let info = '';
			const ownerName = getCurrentFiberOwnerNameInDevOrNull();
			if (ownerName) {
				info += `\n\nCheck the render method of \`${ownerName}\`.`;
			}

			let warningKey = ownerName || workInProgress._debugID || '';
			const debugSource = workInProgress._debugSource;
			if (debugSource) {
				warningKey = `${debugSource.fileName}:${debugSource.lineNumber}`;
			}
			if (!didWarnAboutFunctionRefs[warningKey]) {
				didWarnAboutFunctionRefs[warningKey] = true;
				console.error(
					'Function components cannot be given refs. ' +
						'Attempts to access this ref will fail. ' +
						'Did you mean to use React.forwardRef()?%s',
					info
				);
			}
		}

		if (
			warnAboutDefaultPropsOnFunctionComponents &&
			typeOf(Component) !== 'function' &&
			Component.defaultProps !== undefined
		) {
			const componentName = getComponentName(Component) || 'Unknown';

			if (!didWarnAboutDefaultPropsOnFunctionComponent[componentName]) {
				console.error(
					'%s: Support for defaultProps will be removed from function components ' +
						'in a future major release.',
					componentName
				);
				didWarnAboutDefaultPropsOnFunctionComponent[componentName] = true;
			}
		}

		if (typeOf(Component) !== 'function' && typeOf(Component.getDerivedStateFromProps) === 'function') {
			const componentName = getComponentName(Component) || 'Unknown';

			if (!didWarnAboutGetDerivedStateOnFunctionComponent[componentName]) {
				console.error('%s: Function components do not support getDerivedStateFromProps.', componentName);
				didWarnAboutGetDerivedStateOnFunctionComponent[componentName] = true;
			}
		}

		if (
			typeOf(Component) !== 'function' &&
			typeOf(Component.contextType) === 'table' &&
			Component.contextType !== undefined
		) {
			const componentName = getComponentName(Component) || 'Unknown';

			if (!didWarnAboutContextTypeOnFunctionComponent[componentName]) {
				console.error('%s: Function components do not support contextType.', componentName);
				didWarnAboutContextTypeOnFunctionComponent[componentName] = true;
			}
		}
	}
}

const SUSPENDED_MARKER = {
	dehydrated: undefined,
	retryLane: NoLane,
};

function mountSuspenseOffscreenState(renderLanes: Lanes) {
	return {
		baseLanes: renderLanes,
	};
}

function updateSuspenseOffscreenState(prevOffscreenState: Record<string, unknown>, renderLanes: Lanes) {
	return {
		baseLanes: mergeLanes(prevOffscreenState.baseLanes as Lanes, renderLanes),
	};
}

// TODO: Probably should inline this back
function shouldRemainOnFallback(
	suspenseContext: any,
	current: Fiber | undefined,
	_workInProgress: Fiber,
	_renderLanes: Lanes
) {
	// If we're already showing a fallback, there are cases where we need to
	// remain on that fallback regardless of whether the content has resolved.
	// For example, SuspenseList coordinates when nested content appears.
	if (current !== undefined) {
		const suspenseState = current.memoizedState as Record<string, unknown> | undefined;
		if (suspenseState === undefined) {
			// Currently showing content. Don't hide it, even if ForceSuspenseFallack
			// is true. More precise name might be "ForceRemainSuspenseFallback".
			// Note: This is a factoring smell. Can't remain on a fallback if there's
			// no fallback to remain on.
			return false;
		}
	}

	// Not currently showing content. Consult the Suspense context.
	return hasSuspenseContext(suspenseContext, ForceSuspenseFallback);
}

function getRemainingWorkInPrimaryTree(current: Fiber, renderLanes: Lanes) {
	// TODO: Should not remove render lanes that were pinged during this render
	return removeLanes(current.childLanes, renderLanes);
}

function updateSuspenseComponent(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	const nextProps = workInProgress.pendingProps as Record<string, unknown>;

	// This is used by DevTools to force a boundary to suspend.
	if (__DEV__) {
		if (shouldSuspend(workInProgress)) {
			workInProgress.flags |= DidCapture;
		}
	}

	let suspenseContext = suspenseStackCursor.current;

	let showFallback = false;
	const didSuspend = (workInProgress.flags & DidCapture) !== NoFlags;

	if (didSuspend || shouldRemainOnFallback(suspenseContext, current, workInProgress, renderLanes)) {
		// Something in this boundary's subtree already suspended. Switch to
		// rendering the fallback children.
		showFallback = true;
		workInProgress.flags &= ~DidCapture;
	} else {
		// Attempting the main content
		if (current === undefined || (current.memoizedState as unknown) !== undefined) {
			// This is a new mount or this boundary is already showing a fallback state.
			// Mark this subtree context as having at least one invisible parent that could
			// handle the fallback state.
			// Boundaries without fallbacks or should be avoided are not considered since
			// they cannot handle preferred fallback states.
			if (nextProps.fallback !== undefined && nextProps.unstable_avoidThisFallback !== true) {
				suspenseContext = addSubtreeSuspenseContext(suspenseContext, InvisibleParentSuspenseContext);
			}
		}
	}

	suspenseContext = setDefaultShallowSuspenseContext(suspenseContext);

	pushSuspenseContext(workInProgress, suspenseContext);

	// OK, the next part is confusing. We're about to reconcile the Suspense
	// boundary's children. This involves some custom reconcilation logic. Two
	// main reasons this is so complicated.
	//
	// First, Legacy Mode has different semantics for backwards compatibility. The
	// primary tree will commit in an inconsistent state, so when we do the
	// second pass to render the fallback, we do some exceedingly, uh, clever
	// hacks to make that not totally break. Like transferring effects and
	// deletions from hidden tree. In Concurrent Mode, it's much simpler,
	// because we bailout on the primary tree completely and leave it in its old
	// state, no effects. Same as what we do for Offscreen (except that
	// Offscreen doesn't have the first render pass).
	//
	// Second is hydration. During hydration, the Suspense fiber has a slightly
	// different layout, where the child points to a dehydrated fragment, which
	// contains the DOM rendered by the server.
	//
	// Third, even if you set all that aside, Suspense is like error boundaries in
	// that we first we try to render one tree, and if that fails, we render again
	// and switch to a different tree. Like a try/catch block. So we have to track
	// which branch we're currently rendering. Ideally we would model this using
	// a stack.
	if (current === undefined) {
		// Initial mount
		// If we're currently hydrating, try to hydrate this boundary.
		// But only if this has a fallback.
		if (nextProps.fallback !== undefined) {
			tryToClaimNextHydratableInstance(workInProgress);
			// This could've been a dehydrated suspense component.
			if (enableSuspenseServerRenderer) {
				const suspenseState = workInProgress.memoizedState as Record<string, unknown> | undefined;
				if (suspenseState !== undefined) {
					const dehydrated = suspenseState.dehydrated as SuspenseInstance;
					if (dehydrated !== undefined) {
						return mountDehydratedSuspenseComponent(workInProgress, dehydrated, renderLanes);
					}
				}
			}
		}

		const nextPrimaryChildren = nextProps.children;
		const nextFallbackChildren = nextProps.fallback;
		if (showFallback) {
			const fallbackFragment = mountSuspenseFallbackChildren(
				workInProgress,
				nextPrimaryChildren,
				nextFallbackChildren,
				renderLanes
			);
			const primaryChildFragment = workInProgress.child as Fiber;
			primaryChildFragment.memoizedState = mountSuspenseOffscreenState(renderLanes);
			workInProgress.memoizedState = SUSPENDED_MARKER;
			return fallbackFragment;
		} else if (typeOf(nextProps.unstable_expectedLoadTime) === 'number') {
			// This is a CPU-bound tree. Skip this tree and show a placeholder to
			// unblock the surrounding content. Then immediately retry after the
			// initial commit.
			const fallbackFragment = mountSuspenseFallbackChildren(
				workInProgress,
				nextPrimaryChildren,
				nextFallbackChildren,
				renderLanes
			);
			const primaryChildFragment = workInProgress.child as Fiber;
			primaryChildFragment.memoizedState = mountSuspenseOffscreenState(renderLanes);
			workInProgress.memoizedState = SUSPENDED_MARKER;

			// Since nothing actually suspended, there will nothing to ping this to
			// get it started back up to attempt the next item. While in terms of
			// priority this work has the same priority as this current render, it's
			// not part of the same transition once the transition has committed. If
			// it's sync, we still want to yield so that it can be painted.
			// Conceptually, this is really the same as pinging. We can use any
			// RetryLane even if it's the one currently rendering since we're leaving
			// it behind on this node.
			workInProgress.lanes = SomeRetryLane;
			if (enableSchedulerTracing) {
				markSpawnedWork(SomeRetryLane);
			}
			return fallbackFragment;
		} else {
			return mountSuspensePrimaryChildren(workInProgress, nextPrimaryChildren, renderLanes);
		}
	} else {
		// This is an update.

		// If the current fiber has a SuspenseState, that means it's already showing
		// a fallback.
		const prevState = current.memoizedState as Record<string, unknown> | undefined;
		if (prevState !== undefined) {
			// The current tree is already showing a fallback

			// Special path for hydration
			if (enableSuspenseServerRenderer) {
				const dehydrated = prevState.dehydrated as SuspenseInstance;
				if (dehydrated !== undefined) {
					if (!didSuspend) {
						return updateDehydratedSuspenseComponent(
							current,
							workInProgress,
							dehydrated,
							prevState,
							renderLanes
						);
					} else if ((workInProgress.memoizedState as unknown) !== undefined) {
						// Something suspended and we should still be in dehydrated mode.
						// Leave the existing child in place.
						workInProgress.child = current.child;
						// The dehydrated completion pass expects this flag to be there
						// but the normal suspense pass doesn't.
						workInProgress.flags |= DidCapture;
						return undefined;
					} else {
						// Suspended but we should no longer be in dehydrated mode.
						// Therefore we now have to render the fallback.
						const nextPrimaryChildren = nextProps.children;
						const nextFallbackChildren = nextProps.fallback;
						const fallbackChildFragment = mountSuspenseFallbackAfterRetryWithoutHydrating(
							current,
							workInProgress,
							nextPrimaryChildren,
							nextFallbackChildren,
							renderLanes
						);
						const primaryChildFragment = workInProgress.child as Fiber;
						primaryChildFragment.memoizedState = mountSuspenseOffscreenState(renderLanes);
						workInProgress.memoizedState = SUSPENDED_MARKER;
						return fallbackChildFragment;
					}
				}
			}

			if (showFallback) {
				const nextFallbackChildren = nextProps.fallback;
				const nextPrimaryChildren = nextProps.children;
				const fallbackChildFragment = updateSuspenseFallbackChildren(
					current,
					workInProgress,
					nextPrimaryChildren,
					nextFallbackChildren,
					renderLanes
				);
				const primaryChildFragment = workInProgress.child as Fiber;
				const prevOffscreenState = (current.child as Fiber).memoizedState as
					| Record<string, unknown>
					| undefined;
				primaryChildFragment.memoizedState =
					prevOffscreenState === undefined
						? mountSuspenseOffscreenState(renderLanes)
						: updateSuspenseOffscreenState(prevOffscreenState, renderLanes);
				primaryChildFragment.childLanes = getRemainingWorkInPrimaryTree(current, renderLanes);
				workInProgress.memoizedState = SUSPENDED_MARKER;
				return fallbackChildFragment;
			} else {
				const nextPrimaryChildren = nextProps.children;
				const primaryChildFragment = updateSuspensePrimaryChildren(
					current,
					workInProgress,
					nextPrimaryChildren,
					renderLanes
				);
				workInProgress.memoizedState = undefined;
				return primaryChildFragment;
			}
		} else {
			// The current tree is not already showing a fallback.
			if (showFallback) {
				// Timed out.
				const nextFallbackChildren = nextProps.fallback;
				const nextPrimaryChildren = nextProps.children;
				const fallbackChildFragment = updateSuspenseFallbackChildren(
					current,
					workInProgress,
					nextPrimaryChildren,
					nextFallbackChildren,
					renderLanes
				);
				const primaryChildFragment = workInProgress.child as Fiber;
				const prevOffscreenState = (current.child as Fiber).memoizedState as
					| Record<string, unknown>
					| undefined;
				primaryChildFragment.memoizedState =
					prevOffscreenState === undefined
						? mountSuspenseOffscreenState(renderLanes)
						: updateSuspenseOffscreenState(prevOffscreenState, renderLanes);
				primaryChildFragment.childLanes = getRemainingWorkInPrimaryTree(current, renderLanes);
				// Skip the primary children, and continue working on the
				// fallback children.
				workInProgress.memoizedState = SUSPENDED_MARKER;
				return fallbackChildFragment;
			} else {
				// Still haven't timed out. Continue rendering the children, like we
				// normally do.
				const nextPrimaryChildren = nextProps.children;
				const primaryChildFragment = updateSuspensePrimaryChildren(
					current,
					workInProgress,
					nextPrimaryChildren,
					renderLanes
				);
				workInProgress.memoizedState = undefined;
				return primaryChildFragment;
			}
		}
	}
}

function mountSuspensePrimaryChildren(workInProgress: Fiber, primaryChildren: any, renderLanes: Lanes) {
	const mode = workInProgress.mode;
	const primaryChildProps = {
		mode: 'visible',
		children: primaryChildren,
	};
	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps, mode, renderLanes, undefined);
	primaryChildFragment.return_ = workInProgress;
	workInProgress.child = primaryChildFragment;
	return primaryChildFragment;
}

function mountSuspenseFallbackChildren(
	workInProgress: Fiber,
	primaryChildren: any,
	fallbackChildren: any,
	renderLanes: Lanes
) {
	const mode = workInProgress.mode;
	const progressedPrimaryFragment = workInProgress.child;

	const primaryChildProps = {
		mode: 'hidden',
		children: primaryChildren,
	};

	let primaryChildFragment: Fiber;
	let fallbackChildFragment: Fiber;
	if ((mode & BlockingMode) === NoMode && progressedPrimaryFragment !== undefined) {
		// In legacy mode, we commit the primary tree as if it successfully
		// completed, even though it's in an inconsistent state.
		primaryChildFragment = progressedPrimaryFragment;
		primaryChildFragment.childLanes = NoLanes;
		primaryChildFragment.pendingProps = primaryChildProps;

		if (enableProfilerTimer && workInProgress.mode & ProfileMode) {
			// Reset the durations from the first pass so they aren't included in the
			// final amounts. This seems counterintuitive, since we're intentionally
			// not measuring part of the render phase, but this makes it match what we
			// do in Concurrent Mode.
			primaryChildFragment.actualDuration = 0;
			primaryChildFragment.actualStartTime = -1;
			primaryChildFragment.selfBaseDuration = 0;
			primaryChildFragment.treeBaseDuration = 0;
		}

		fallbackChildFragment = createFiberFromFragment(fallbackChildren, mode, renderLanes, undefined);
	} else {
		primaryChildFragment = createFiberFromOffscreen(primaryChildProps, mode, NoLanes, undefined);
		fallbackChildFragment = createFiberFromFragment(fallbackChildren, mode, renderLanes, undefined);
	}

	primaryChildFragment.return_ = workInProgress;
	fallbackChildFragment.return_ = workInProgress;
	primaryChildFragment.sibling = fallbackChildFragment;
	workInProgress.child = primaryChildFragment;
	return fallbackChildFragment;
}

function createWorkInProgressOffscreenFiber(current: Fiber, offscreenProps: any) {
	// The props argument to `createWorkInProgress` is `any` typed, so we use this
	// wrapper function to constrain it.
	return createWorkInProgress(current, offscreenProps);
}

function updateSuspensePrimaryChildren(
	current: Fiber | undefined,
	workInProgress: Fiber,
	primaryChildren: any,
	renderLanes: Lanes
) {
	const currentPrimaryChildFragment = current!.child as Fiber;
	const currentFallbackChildFragment = currentPrimaryChildFragment.sibling;

	const primaryChildFragment = createWorkInProgressOffscreenFiber(currentPrimaryChildFragment, {
		mode: 'visible',
		children: primaryChildren,
	});
	if ((workInProgress.mode & BlockingMode) === NoMode) {
		primaryChildFragment.lanes = renderLanes;
	}
	primaryChildFragment.return_ = workInProgress;
	primaryChildFragment.sibling = undefined;
	if (currentFallbackChildFragment !== undefined) {
		// Delete the fallback child fragment
		const deletions = workInProgress.deletions;
		if (deletions === undefined) {
			workInProgress.deletions = [currentFallbackChildFragment];
			// TODO (effects) Rename this to better reflect its new usage (e.g. ChildDeletions)
			workInProgress.flags |= Deletion;
		} else {
			deletions.push(currentFallbackChildFragment);
		}
	}

	workInProgress.child = primaryChildFragment;
	return primaryChildFragment;
}

function updateSuspenseFallbackChildren(
	current: Fiber | undefined,
	workInProgress: Fiber,
	primaryChildren: any,
	fallbackChildren: any,
	renderLanes: Lanes
) {
	const mode = workInProgress.mode;
	const currentPrimaryChildFragment = current!.child as Fiber;
	const currentFallbackChildFragment = currentPrimaryChildFragment.sibling;

	const primaryChildProps = {
		mode: 'hidden',
		children: primaryChildren,
	};

	let primaryChildFragment: Fiber;
	if (
		// In legacy mode, we commit the primary tree as if it successfully
		// completed, even though it's in an inconsistent state.
		(mode & BlockingMode) === NoMode &&
		// Make sure we're on the second pass, i.e. the primary child fragment was
		// already cloned. In legacy mode, the only case where this isn't true is
		// when DevTools forces us to display a fallback; we skip the first render
		// pass entirely and go straight to rendering the fallback. (In Concurrent
		// Mode, SuspenseList can also trigger this scenario, but this is a legacy-
		// only codepath.)
		workInProgress.child !== currentPrimaryChildFragment
	) {
		const progressedPrimaryFragment = workInProgress.child as Fiber;
		primaryChildFragment = progressedPrimaryFragment;
		primaryChildFragment.childLanes = NoLanes;
		primaryChildFragment.pendingProps = primaryChildProps;

		if (enableProfilerTimer && workInProgress.mode & ProfileMode) {
			// Reset the durations from the first pass so they aren't included in the
			// final amounts. This seems counterintuitive, since we're intentionally
			// not measuring part of the render phase, but this makes it match what we
			// do in Concurrent Mode.
			primaryChildFragment.actualDuration = 0;
			primaryChildFragment.actualStartTime = -1;
			primaryChildFragment.selfBaseDuration = currentPrimaryChildFragment.selfBaseDuration;
			primaryChildFragment.treeBaseDuration = currentPrimaryChildFragment.treeBaseDuration;
		}

		// The fallback fiber was added as a deletion effect during the first pass.
		// However, since we're going to remain on the fallback, we no longer want
		// to delete it.
		workInProgress.deletions = undefined;
	} else {
		primaryChildFragment = createWorkInProgressOffscreenFiber(currentPrimaryChildFragment, primaryChildProps);

		// Since we're reusing a current tree, we need to reuse the flags, too.
		// (We don't do this in legacy mode, because in legacy mode we don't re-use
		// the current tree; see previous branch.)
		primaryChildFragment.subtreeFlags = currentPrimaryChildFragment.subtreeFlags & StaticMask;
	}
	let fallbackChildFragment: Fiber;
	if (currentFallbackChildFragment !== undefined) {
		fallbackChildFragment = createWorkInProgress(currentFallbackChildFragment, fallbackChildren);
	} else {
		fallbackChildFragment = createFiberFromFragment(fallbackChildren, mode, renderLanes, undefined);
		// Needs a placement effect because the parent (the Suspense boundary) already
		// mounted but this is a new fiber.
		fallbackChildFragment.flags |= Placement;
	}

	fallbackChildFragment.return_ = workInProgress;
	primaryChildFragment.return_ = workInProgress;
	primaryChildFragment.sibling = fallbackChildFragment;
	workInProgress.child = primaryChildFragment;

	return fallbackChildFragment;
}

function retrySuspenseComponentWithoutHydrating(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	// This will add the old fiber to the deletion list
	reconcileChildFibers(workInProgress, current!.child, undefined, renderLanes);

	// We're now not suspended nor dehydrated.
	const nextProps = workInProgress.pendingProps as Record<string, unknown>;
	const primaryChildren = nextProps.children;
	const primaryChildFragment = mountSuspensePrimaryChildren(workInProgress, primaryChildren, renderLanes);
	// Needs a placement effect because the parent (the Suspense boundary) already
	// mounted but this is a new fiber.
	primaryChildFragment.flags |= Placement;
	workInProgress.memoizedState = undefined;

	return primaryChildFragment;
}

function mountSuspenseFallbackAfterRetryWithoutHydrating(
	current: Fiber | undefined,
	workInProgress: Fiber,
	primaryChildren: any,
	fallbackChildren: any,
	renderLanes: Lanes
) {
	const mode = workInProgress.mode;
	const primaryChildFragment = createFiberFromOffscreen(primaryChildren, mode, NoLanes, undefined);
	const fallbackChildFragment = createFiberFromFragment(fallbackChildren, mode, renderLanes, undefined);
	// Needs a placement effect because the parent (the Suspense
	// boundary) already mounted but this is a new fiber.
	fallbackChildFragment.flags |= Placement;

	primaryChildFragment.return_ = workInProgress;
	fallbackChildFragment.return_ = workInProgress;
	primaryChildFragment.sibling = fallbackChildFragment;
	workInProgress.child = primaryChildFragment;

	if ((workInProgress.mode & BlockingMode) !== NoMode) {
		// We will have dropped the effect list which contains the
		// deletion. We need to reconcile to delete the current child.
		reconcileChildFibers(workInProgress, current!.child, undefined, renderLanes);
	}

	return fallbackChildFragment;
}

function mountDehydratedSuspenseComponent(
	workInProgress: Fiber,
	suspenseInstance: SuspenseInstance,
	_renderLanes: Lanes
) {
	// During the first pass, we'll bail out and not drill into the children.
	// Instead, we'll leave the content in place and try to hydrate it later.
	if ((workInProgress.mode & BlockingMode) === NoMode) {
		if (__DEV__) {
			console.error(
				'Cannot hydrate Suspense in legacy mode. Switch from ' +
					'ReactDOM.hydrate(element, container) to ' +
					'ReactDOM.createBlockingRoot(container, { hydrate: true })' +
					'.render(element) or remove the Suspense components from ' +
					'the server rendered components.'
			);
		}
		workInProgress.lanes = laneToLanes(SyncLane);
	} else if (isSuspenseInstanceFallback(suspenseInstance)) {
		// This is a client-only boundary. Since we won't get any content from the server
		// for this, we need to schedule that at a higher priority based on when it would
		// have timed out. In theory we could render it in this pass but it would have the
		// wrong priority associated with it and will prevent hydration of parent path.
		// Instead, we'll leave work left on it to render it in a separate commit.

		// TODO This time should be the time at which the server rendered response that is
		// a parent to this boundary was displayed. However, since we currently don't have
		// a protocol to transfer that time, we'll just estimate it by using the current
		// time. This will mean that Suspense timeouts are slightly shifted to later than
		// they should be.
		// Schedule a normal pri update to render this content.
		if (enableSchedulerTracing) {
			markSpawnedWork(DefaultHydrationLane);
		}
		workInProgress.lanes = laneToLanes(DefaultHydrationLane);
	} else {
		// We'll continue hydrating the rest at offscreen priority since we'll already
		// be showing the right content coming from the server, it is no rush.
		workInProgress.lanes = laneToLanes(OffscreenLane);
		if (enableSchedulerTracing) {
			markSpawnedWork(OffscreenLane);
		}
	}
	return undefined;
}

function updateDehydratedSuspenseComponent(
	current: Fiber | undefined,
	workInProgress: Fiber,
	suspenseInstance: SuspenseInstance,
	suspenseState: Record<string, unknown>,
	renderLanes: Lanes
) {
	// We should never be hydrating at this point because it is the first pass,
	// but after we've already committed once.
	warnIfHydrating();

	if ((getExecutionContext() & RetryAfterError) !== NoContext) {
		return retrySuspenseComponentWithoutHydrating(current, workInProgress, renderLanes);
	}

	if ((workInProgress.mode & BlockingMode) === NoMode) {
		return retrySuspenseComponentWithoutHydrating(current, workInProgress, renderLanes);
	}

	if (isSuspenseInstanceFallback(suspenseInstance)) {
		// This boundary is in a permanent fallback state. In this case, we'll never
		// get an update and we'll never be able to hydrate the final content. Let's just try the
		// client side render instead.
		return retrySuspenseComponentWithoutHydrating(current, workInProgress, renderLanes);
	}
	// We use lanes to indicate that a child might depend on context, so if
	// any context has changed, we need to treat is as if the input might have changed.
	const hasContextChanged = includesSomeLane(renderLanes, current!.childLanes);
	if (didReceiveUpdate || hasContextChanged) {
		// This boundary has changed since the first render. This means that we are now unable to
		// hydrate it. We might still be able to hydrate it using a higher priority lane.
		const root = getWorkInProgressRoot();
		if (root !== undefined) {
			const attemptHydrationAtLane = getBumpedLaneForHydration(root, renderLanes);
			if (attemptHydrationAtLane !== NoLane && attemptHydrationAtLane !== (suspenseState.retryLane as Lanes)) {
				// Intentionally mutating since this render will get interrupted. This
				// is one of the very rare times where we mutate the current tree
				// during the render phase.
				suspenseState.retryLane = attemptHydrationAtLane;
				// TODO: Ideally this would inherit the event time of the current render
				const eventTime = NoTimestamp;
				scheduleUpdateOnFiber(current!, attemptHydrationAtLane, eventTime);
			} else {
				// We have already tried to ping at a higher priority than we're rendering with
				// so if we got here, we must have failed to hydrate at those levels. We must
				// now give up. Instead, we're going to delete the whole subtree and instead inject
				// a new real Suspense boundary to take its place, which may render content
				// or fallback. This might suspend for a while and if it does we might still have
				// an opportunity to hydrate before this pass commits.
			}
		}

		// If we have scheduled higher pri work above, this will probably just abort the render
		// since we now have higher priority work, but in case it doesn't, we need to prepare to
		// render something, if we time out. Even if that requires us to delete everything and
		// skip hydration.
		// Delay having to do this as long as the suspense timeout allows us.
		renderDidSuspendDelayIfPossible();
		return retrySuspenseComponentWithoutHydrating(current, workInProgress, renderLanes);
	} else if (isSuspenseInstancePending(suspenseInstance)) {
		// This component is still pending more data from the server, so we can't hydrate its
		// content. We treat it as if this component suspended itself. It might seem as if
		// we could just try to render it client-side instead. However, this will perform a
		// lot of unnecessary work and is unlikely to complete since it often will suspend
		// on missing data anyway. Additionally, the server might be able to render more
		// than we can on the client yet. In that case we'd end up with more fallback states
		// on the client than if we just leave it alone. If the server times out or errors
		// these should update this boundary to the permanent Fallback state instead.
		// Mark it as having captured (i.e. suspended).
		workInProgress.flags |= DidCapture;
		// Leave the child in place. I.e. the dehydrated fragment.
		workInProgress.child = current!.child;
		// Register a callback to retry this boundary once the server has sent the result.
		let retry = () => retryDehydratedSuspenseBoundary(current!);
		if (enableSchedulerTracing) {
			if (Schedule_tracing_wrap === undefined) {
				Schedule_tracing_wrap = tracing.unstable_wrap as any;
			}
			if (Schedule_tracing_wrap !== undefined) {
				retry = Schedule_tracing_wrap(retry);
			}
		}
		registerSuspenseInstanceRetry(suspenseInstance, retry);
		return undefined;
	} else {
		// This is the first attempt.
		reenterHydrationStateFromDehydratedSuspenseInstance(workInProgress, suspenseInstance);
		const nextProps = workInProgress.pendingProps as Record<string, unknown>;
		const primaryChildren = nextProps.children;
		const primaryChildFragment = mountSuspensePrimaryChildren(workInProgress, primaryChildren, renderLanes);
		// Mark the children as hydrating. This is a fast path to know whether this
		// tree is part of a hydrating tree. This is used to determine if a child
		// node has fully mounted yet, and for scheduling event replaying.
		// Conceptually this is similar to Placement in that a new subtree is
		// inserted into the React tree here. It just happens to not need DOM
		// mutations because it already exists.
		primaryChildFragment.flags |= Hydrating;
		return primaryChildFragment;
	}
}

function scheduleWorkOnFiber(fiber: Fiber, renderLanes: Lanes) {
	fiber.lanes = mergeLanes(fiber.lanes, renderLanes);
	const alternate = fiber.alternate;
	if (alternate !== undefined) {
		alternate.lanes = mergeLanes(alternate.lanes, renderLanes);
	}
	scheduleWorkOnParentPath(fiber.return_, renderLanes);
}

function propagateSuspenseContextChange(workInProgress: Fiber, firstChild: Fiber | undefined, renderLanes: Lanes) {
	// Mark any Suspense boundaries with fallbacks as having work to do.
	// If they were previously forced into fallbacks, they may now be able
	// to unblock.
	let node = firstChild;
	while (node !== undefined) {
		if (node.tag === SuspenseComponent) {
			const state = node.memoizedState as Record<string, unknown> | undefined;
			if (state !== undefined) {
				scheduleWorkOnFiber(node, renderLanes);
			}
		} else if (node.tag === SuspenseListComponent) {
			// If the tail is hidden there might not be an Suspense boundaries
			// to schedule work on. In this case we have to schedule it on the
			// list itself.
			// We don't have to traverse to the children of the list since
			// the list will propagate the change when it rerenders.
			scheduleWorkOnFiber(node, renderLanes);
		} else if (node.child !== undefined) {
			node.child.return_ = node;
			node = node.child;
			continue;
		}
		if (node === workInProgress) {
			return;
		}
		while (node.sibling === undefined) {
			if (node.return_ === undefined || node.return_ === workInProgress) {
				return;
			}
			node = node.return_;
		}
		node.sibling.return_ = node.return_;
		node = node.sibling;
	}
}

function findLastContentRow(firstChild: Fiber | undefined) {
	// This is going to find the last row among these children that is already
	// showing content on the screen, as opposed to being in fallback state or
	// new. If a row has multiple Suspense boundaries, any of them being in the
	// fallback state, counts as the whole row being in a fallback state.
	// Note that the "rows" will be workInProgress, but any nested children
	// will still be current since we haven't rendered them yet. The mounted
	// order may not be the same as the new order. We use the new order.
	let row = firstChild;
	let lastContentRow: Fiber | undefined;
	while (row !== undefined) {
		const currentRow = row.alternate;
		// New rows can't be content rows.
		if (currentRow !== undefined && findFirstSuspended(currentRow) === undefined) {
			lastContentRow = row;
		}
		row = row.sibling;
	}
	return lastContentRow;
}

function validateRevealOrder(revealOrder: string) {
	if (__DEV__) {
		if (
			revealOrder !== undefined &&
			revealOrder !== 'forwards' &&
			revealOrder !== 'backwards' &&
			revealOrder !== 'together' &&
			!didWarnAboutRevealOrder[revealOrder]
		) {
			didWarnAboutRevealOrder[revealOrder] = true;
			if (typeOf(revealOrder) === 'string') {
				switch (string.lower(revealOrder)) {
					case 'together':
					case 'forwards':
					case 'backwards': {
						console.error(
							'"%s" is not a valid value for revealOrder on <SuspenseList />. ' +
								'Use lowercase "%s" instead.',
							revealOrder,
							string.lower(revealOrder)
						);
						break;
					}
					case 'forward':
					case 'backward': {
						console.error(
							'"%s" is not a valid value for revealOrder on <SuspenseList />. ' +
								'React uses the -s suffix in the spelling. Use "%ss" instead.',
							revealOrder,
							string.lower(revealOrder)
						);
						break;
					}
					default:
						console.error(
							'"%s" is not a supported revealOrder on <SuspenseList />. ' +
								'Did you mean "together", "forwards" or "backwards"?',
							revealOrder
						);
						break;
				}
			} else {
				console.error(
					'%s is not a supported value for revealOrder on <SuspenseList />. ' +
						'Did you mean "together", "forwards" or "backwards"?',
					revealOrder
				);
			}
		}
	}
}

function validateTailOptions(tailMode: string, revealOrder: string) {
	if (__DEV__) {
		if (tailMode !== undefined && !didWarnAboutTailOptions[tailMode]) {
			if (tailMode !== 'collapsed' && tailMode !== 'hidden') {
				didWarnAboutTailOptions[tailMode] = true;
				console.error(
					'"%s" is not a supported value for tail on <SuspenseList />. ' +
						'Did you mean "collapsed" or "hidden"?',
					tailMode
				);
			} else if (revealOrder !== 'forwards' && revealOrder !== 'backwards') {
				didWarnAboutTailOptions[tailMode] = true;
				console.error(
					'<SuspenseList tail="%s" /> is only valid if revealOrder is ' +
						'"forwards" or "backwards". ' +
						'Did you mean to specify revealOrder="forwards"?',
					tailMode
				);
			}
		}
	}
}

function validateSuspenseListNestedChild(childSlot: any, index: number) {
	if (__DEV__) {
		const isArray = typeOf(childSlot) === 'table';
		const isIterable = !isArray && typeOf(_getIteratorFn(childSlot)) === 'function';
		if (isArray || isIterable) {
			const type_ = isArray ? 'array' : 'iterable';
			console.error(
				'A nested %s was passed to row #%s in <SuspenseList />. Wrap it in ' +
					'an additional SuspenseList to configure its revealOrder: ' +
					'<SuspenseList revealOrder=...> ... ' +
					'<SuspenseList revealOrder=...>{%s}</SuspenseList> ... ' +
					'</SuspenseList>',
				type_,
				index,
				type_
			);
			return false;
		}
	}
	return true;
}

function validateSuspenseListChildren(children: any, revealOrder: string) {
	if (__DEV__) {
		if (
			(revealOrder === 'forwards' || revealOrder === 'backwards') &&
			(children as unknown) !== undefined &&
			(children as unknown) !== undefined &&
			(children as unknown) !== false
		) {
			if (typeOf(children) === 'table') {
				const childrenArray = children as Array<unknown>;
				for (let i = 0; i < childrenArray.size(); i++) {
					if (!validateSuspenseListNestedChild(childrenArray[i], i)) {
						return;
					}
				}
			} else {
				const iteratorFn = _getIteratorFn(children);
				if (typeOf(iteratorFn) === 'function') {
					const childrenIterator = (
						iteratorFn as (...args: Array<unknown>) => {
							next: () => { done: boolean; value: unknown };
						}
					)(children);
					if (childrenIterator) {
						let step = childrenIterator.next();
						let i = 0;
						for (; !step.done; step = childrenIterator.next()) {
							if (!validateSuspenseListNestedChild(step.value, i)) {
								return;
							}
							i++;
						}
					}
				} else {
					console.error(
						'A single row was passed to a <SuspenseList revealOrder="%s" />. ' +
							'This is not useful since it needs multiple rows. ' +
							'Did you mean to pass multiple children or an array?',
						revealOrder
					);
				}
			}
		}
	}
}

function initSuspenseListRenderState(
	workInProgress: Fiber,
	isBackwards: boolean,
	tail: Fiber | undefined,
	lastContentRow: Fiber | undefined,
	tailMode: string | undefined
) {
	const renderState = workInProgress.memoizedState as Record<string, unknown> | undefined;
	if (renderState === undefined) {
		workInProgress.memoizedState = {
			isBackwards: isBackwards,
			rendering: undefined,
			renderingStartTime: 0,
			last: lastContentRow,
			tail: tail,
			tailMode: tailMode,
		};
	} else {
		// We can reuse the existing object from previous renders.
		renderState.isBackwards = isBackwards;
		renderState.rendering = undefined;
		renderState.renderingStartTime = 0;
		renderState.last = lastContentRow;
		renderState.tail = tail;
		renderState.tailMode = tailMode;
	}
}

// This can end up rendering this component multiple passes.
// The first pass splits the children fibers into two sets. A head and tail.
// We first render the head. If anything is in fallback state, we do another
// pass through beginWork to rerender all children (including the tail) with
// the force suspend context. If the first render didn't have anything in
// in fallback state. Then we render each row in the tail one-by-one.
// That happens in the completeWork phase without going back to beginWork.
function _updateSuspenseListComponent(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	const nextProps = workInProgress.pendingProps as Record<string, unknown>;
	const revealOrder = nextProps.revealOrder as string;
	const tailMode = nextProps.tail as string;
	const newChildren = nextProps.children;

	validateRevealOrder(revealOrder);
	validateTailOptions(tailMode, revealOrder);
	validateSuspenseListChildren(newChildren, revealOrder);

	reconcileChildren(current, workInProgress, newChildren, renderLanes);

	let suspenseContext = suspenseStackCursor.current;

	const shouldForceFallback = hasSuspenseContext(suspenseContext, ForceSuspenseFallback);
	if (shouldForceFallback) {
		suspenseContext = setShallowSuspenseContext(suspenseContext, ForceSuspenseFallback);
		workInProgress.flags |= DidCapture;
	} else {
		const didSuspendBefore = current !== undefined && (current.flags & DidCapture) !== NoFlags;
		if (didSuspendBefore) {
			// If we previously forced a fallback, we need to schedule work
			// on any nested boundaries to let them know to try to render
			// again. This is the same as context updating.
			propagateSuspenseContextChange(workInProgress, workInProgress.child, renderLanes);
		}
		suspenseContext = setDefaultShallowSuspenseContext(suspenseContext);
	}
	pushSuspenseContext(workInProgress, suspenseContext);

	if ((workInProgress.mode & BlockingMode) === NoMode) {
		// In legacy mode, SuspenseList doesn't work so we just
		// use make it a noop by treating it as the default revealOrder.
		workInProgress.memoizedState = undefined;
	} else {
		switch (revealOrder) {
			case 'forwards': {
				const lastContentRow = findLastContentRow(workInProgress.child);
				let tail: Fiber | undefined;
				if (lastContentRow === undefined) {
					// The whole list is part of the tail.
					// TODO: We could fast path by just rendering the tail now.
					tail = workInProgress.child;
					workInProgress.child = undefined;
				} else {
					// Disconnect the tail rows after the content row.
					// We're going to render them separately later.
					tail = lastContentRow.sibling;
					lastContentRow.sibling = undefined;
				}
				initSuspenseListRenderState(
					workInProgress,
					false, // isBackwards
					tail,
					lastContentRow,
					tailMode
				);
				break;
			}
			case 'backwards': {
				// We're going to find the first row that has existing content.
				// At the same time we're going to reverse the list of everything
				// we pass in the meantime. That's going to be our tail in reverse
				// order.
				let tail: Fiber | undefined;
				let row = workInProgress.child;
				workInProgress.child = undefined;
				while (row !== undefined) {
					const currentRow = row.alternate;
					// New rows can't be content rows.
					if (currentRow !== undefined && findFirstSuspended(currentRow) === undefined) {
						// This is the beginning of the main content.
						workInProgress.child = row;
						break;
					}
					const nextRow = row.sibling;
					row.sibling = tail;
					tail = row;
					row = nextRow;
				}
				// TODO: If workInProgress.child is undefined, we can continue on the tail immediately.
				initSuspenseListRenderState(
					workInProgress,
					true, // isBackwards
					tail,
					undefined, // last
					tailMode
				);
				break;
			}
			case 'together': {
				initSuspenseListRenderState(
					workInProgress,
					false, // isBackwards
					undefined, // tail
					undefined, // last
					undefined
				);
				break;
			}
			default: {
				// The default reveal order is the same as not having
				// a boundary.
				workInProgress.memoizedState = undefined;
			}
		}
	}
	return workInProgress.child;
}

function updatePortalComponent(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	pushHostContainer(workInProgress, (workInProgress.stateNode as Record<string, unknown>).containerInfo as Container);
	const nextChildren = workInProgress.pendingProps;
	if (current === undefined) {
		// Portals are special because we don't append the children during mount
		// but at commit. Therefore we need to track insertions which the normal
		// flow doesn't do during mount. This doesn't happen at the root because
		// the root always starts with a "current" with a undefined child.
		// TODO: Consider unifying this with how the root works.
		workInProgress.child = reconcileChildFibers(workInProgress, undefined, nextChildren, renderLanes);
	} else {
		reconcileChildren(current, workInProgress, nextChildren, renderLanes);
	}
	return workInProgress.child;
}

let hasWarnedAboutUsingNoValuePropOnContextProvider = false;

function updateContextProvider(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	const providerType = workInProgress.type as Record<string, unknown>;
	const context = providerType._context;

	const newProps = workInProgress.pendingProps as Record<string, unknown>;
	const oldProps = workInProgress.memoizedProps as Record<string, unknown> | undefined;

	const newValue = newProps.value;

	if (__DEV__ || __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__) {
		if (!('value' in newProps)) {
			if (!hasWarnedAboutUsingNoValuePropOnContextProvider) {
				hasWarnedAboutUsingNoValuePropOnContextProvider = true;
				console.error(
					'The `value` prop is required for the `<Context.Provider>`. Did you misspell it or forget to pass it?'
				);
			}
		}
		const providerPropTypes = (workInProgress.type as Record<string, unknown>).propTypes as Record<string, defined>;
		const validateProps = (workInProgress.type as Record<string, unknown>).validateProps as unknown;

		if (providerPropTypes || validateProps) {
			checkPropTypes(providerPropTypes, validateProps as any, newProps, 'prop', 'Context.Provider');
		}
	}

	pushProvider(workInProgress, newValue);

	if (oldProps !== undefined) {
		const oldValue = oldProps.value;
		const changedBits = calculateChangedBits(context as any, newValue, oldValue);
		if (changedBits === 0) {
			// No change. Bailout early if children are the same.
			if (
				(oldProps as Record<string, unknown>).children === (newProps as Record<string, unknown>).children &&
				!hasLegacyContextChanged()
			) {
				return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
			}
		} else {
			// The context value changed. Search for matching consumers and schedule
			// them to update.
			propagateContextChange(workInProgress, context as any, changedBits, renderLanes);
		}
	}

	const newChildren = newProps.children;
	reconcileChildren(current, workInProgress, newChildren, renderLanes);
	return workInProgress.child;
}

const hasWarnedAbout = {
	usingContextAsConsumer: false,
	usingLegacyConsumer: false,
};

function updateContextConsumer(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	let context = workInProgress.type as Record<string, unknown>;
	// The logic below for Context differs depending on PROD or DEV mode. In
	// DEV mode, we create a separate object for Context.Consumer that acts
	// like a proxy to Context. This proxy object adds unnecessary code in PROD
	// so we use the old behaviour (Context.Consumer references Context) to
	// reduce size and overhead. The separate object references context via
	// a property called "_context", which also gives us the ability to check
	// in DEV mode if this property exists or not and warn if it does not.
	if (__DEV__) {
		if (context._context === undefined) {
			// This may be because it's a Context (rather than a Consumer).
			// Or it may be because it's older React where they're the same thing.
			// We only want to warn if we're sure it's a new React.
			if ((context as unknown) !== (context as Record<string, unknown>).Consumer) {
				if (!hasWarnedAbout.usingContextAsConsumer) {
					hasWarnedAbout.usingContextAsConsumer = true;
					console.error(
						'Rendering <Context> directly is not supported and will be removed in ' +
							'a future major release. Did you mean to render <Context.Consumer> instead?'
					);
				}
			}
		} else {
			context = context._context as Record<string, unknown>;
		}
	}
	const newProps = workInProgress.pendingProps as Record<string, unknown>;
	let render = newProps.children as (value: any) => any;
	if (newProps.render !== undefined) {
		if (__DEV__ && __COMPAT_WARNINGS__ && !hasWarnedAbout.usingLegacyConsumer) {
			hasWarnedAbout.usingLegacyConsumer = true;
			console.warn(
				"Your Context.Consumer component is using legacy Roact syntax, which won't be supported in future versions of Roact. \n" +
					"Please provide no props and supply the 'render' function as a child (the 3rd argument of createElement)."
			);
		}
		render = newProps.render as (value: any) => any;
	}

	if (__DEV__) {
		if (typeOf(render) !== 'function') {
			console.error(
				'A context consumer was rendered with multiple children, or a child ' +
					"that isn't a function. A context consumer expects a single child " +
					'that is a function. If you did pass a function, make sure there ' +
					'is no trailing or leading whitespace around it.'
			);
		}
	}

	prepareToReadContext(workInProgress, renderLanes, markWorkInProgressReceivedUpdate);
	const newValue = readContext(context as any, newProps.unstable_observedBits as number | boolean | undefined);
	let newChildren: any;
	if (__DEV__) {
		ReactCurrentOwner.current = workInProgress;
		setIsRendering(true);
		newChildren = render(newValue);
		setIsRendering(false);
	} else {
		newChildren = render(newValue);
	}

	// React DevTools reads this flag.
	workInProgress.flags |= PerformedWork;
	reconcileChildren(current, workInProgress, newChildren, renderLanes);
	return workInProgress.child;
}

function _updateFundamentalComponent(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	const fundamentalImpl = (workInProgress.type as Record<string, unknown>).impl as Record<string, unknown>;
	if (fundamentalImpl.reconcileChildren === false) {
		return undefined;
	}
	const nextProps = workInProgress.pendingProps as Record<string, unknown>;
	const nextChildren = nextProps.children;

	reconcileChildren(current, workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

function _updateScopeComponent(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	const nextProps = workInProgress.pendingProps as Record<string, unknown>;
	const nextChildren = nextProps.children;

	reconcileChildren(current, workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

export function markWorkInProgressReceivedUpdate() {
	didReceiveUpdate = true;
}

function bailoutOnAlreadyFinishedWork(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) {
	if (current !== undefined) {
		// Reuse previous dependencies
		workInProgress.dependencies = current.dependencies;
	}

	if (enableProfilerTimer) {
		// Don't update "base" render times for bailouts.
		stopProfilerTimerIfRunning(workInProgress);
	}

	markSkippedUpdateLanes(workInProgress.lanes);

	// Check if the children have any pending work.
	if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
		// The children don't have any work either. We can skip them.
		// TODO: Once we add back resuming, we should check if the children are
		// a work-in-progress set. If so, we need to transfer their effects.
		return undefined;
	} else {
		// This fiber doesn't have work, but its subtree does. Clone the child
		// fibers and continue.
		cloneChildFibers(current, workInProgress);
		return workInProgress.child;
	}
}

function remountFiber(current: Fiber | undefined, oldWorkInProgress: Fiber, newWorkInProgress: Fiber) {
	if (__DEV__) {
		const returnFiber = oldWorkInProgress.return_;
		if (returnFiber === undefined) {
			error('Cannot swap the root fiber.');
		}

		// Disconnect from the old current.
		// It will get deleted.
		current!.alternate = undefined;
		oldWorkInProgress.alternate = undefined;

		// Connect to the new tree.
		newWorkInProgress.index = oldWorkInProgress.index;
		newWorkInProgress.sibling = oldWorkInProgress.sibling;
		newWorkInProgress.return_ = oldWorkInProgress.return_;
		newWorkInProgress.ref = oldWorkInProgress.ref;

		// Replace the child/sibling pointers above it.
		if (oldWorkInProgress === returnFiber.child) {
			returnFiber.child = newWorkInProgress;
		} else {
			let prevSibling = returnFiber.child;
			if (prevSibling === undefined) {
				error('Expected parent to have a child.');
			}
			while (prevSibling.sibling !== oldWorkInProgress) {
				prevSibling = prevSibling.sibling;
				if (prevSibling === undefined) {
					error('Expected to find the previous sibling.');
				}
			}
			prevSibling.sibling = newWorkInProgress;
		}

		// Delete the old fiber and place the new one.
		// Since the old fiber is disconnected, we have to schedule it manually.
		const deletions = returnFiber.deletions;
		if (deletions === undefined) {
			returnFiber.deletions = [current as Fiber];
			// TODO (effects) Rename this to better reflect its new usage (e.g. ChildDeletions)
			returnFiber.flags |= Deletion;
		} else {
			deletions.push(current as Fiber);
		}

		newWorkInProgress.flags |= Placement;

		// Restart work from the new fiber.
		return newWorkInProgress;
	} else {
		error('Did not expect this call in production. ' + 'This is a bug in React. Please file an issue.');
	}
}

export function beginWork(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes): Fiber | undefined {
	const updateLanes = workInProgress.lanes;

	if (__DEV__) {
		if (workInProgress._debugNeedsRemount && current !== undefined) {
			// This will restart the begin phase with a new fiber.
			return remountFiber(
				current,
				workInProgress,
				createFiberFromTypeAndProps(
					workInProgress.type,
					workInProgress.key,
					workInProgress.pendingProps,
					workInProgress._debugOwner || undefined,
					workInProgress.mode,
					workInProgress.lanes
				)
			);
		}
	}

	if (current !== undefined) {
		const oldProps = current.memoizedProps as unknown;
		const newProps = workInProgress.pendingProps as unknown;

		if (
			oldProps !== newProps ||
			hasLegacyContextChanged() ||
			// Force a re-render if the implementation changed due to hot reload:
			(__DEV__ ? (workInProgress.type as unknown) !== (current.type as unknown) : false)
		) {
			// If props or context changed, mark the fiber as having performed work.
			// This may be unset if the props are determined to be equal later (memo).
			didReceiveUpdate = true;
		} else if (!includesSomeLane(renderLanes, updateLanes)) {
			didReceiveUpdate = false;
			// This fiber does not have any pending work. Bailout without entering
			// the begin phase. There's still some bookkeeping we that needs to be done
			// in this optimized path, mostly pushing stuff onto the stack.
			switch (workInProgress.tag) {
				case HostRoot:
					pushHostRootContext(workInProgress);
					resetHydrationState();
					break;
				case HostComponent:
					pushHostContext(workInProgress);
					break;
				case ClassComponent: {
					const Component = workInProgress.type;
					if (isLegacyContextProvider(Component)) {
						pushLegacyContextProvider(workInProgress);
					}
					break;
				}
				case HostPortal:
					pushHostContainer(
						workInProgress,
						(workInProgress.stateNode as Record<string, unknown>).containerInfo as Container
					);
					break;
				case ContextProvider: {
					const newValue = (workInProgress.memoizedProps as Record<string, unknown>).value;
					pushProvider(workInProgress, newValue);
					break;
				}
				case Profiler:
					if (enableProfilerTimer) {
						// Reset effect durations for the next eventual effect phase.
						// These are reset during render to allow the DevTools commit hook a chance to read them,
						const stateNode = workInProgress.stateNode;
						stateNode.effectDuration = 0;
						stateNode.passiveEffectDuration = 0;
					}
					break;
				case SuspenseComponent: {
					const state = workInProgress.memoizedState as Record<string, unknown> | undefined;
					if (state !== undefined) {
						if (enableSuspenseServerRenderer) {
							if (state.dehydrated !== undefined) {
								pushSuspenseContext(
									workInProgress,
									setDefaultShallowSuspenseContext(suspenseStackCursor.current)
								);
								// We know that this component will suspend again because if it has
								// been unsuspended it has committed as a resolved Suspense component.
								// If it needs to be retried, it should have work scheduled on it.
								workInProgress.flags |= DidCapture;
								// We should never render the children of a dehydrated boundary until we
								// upgrade it. We return undefined instead of bailoutOnAlreadyFinishedWork.
								return undefined;
							}
						}

						// If this boundary is currently timed out, we need to decide
						// whether to retry the primary children, or to skip over it and
						// go straight to the fallback. Check the priority of the primary
						// child fragment.
						const primaryChildFragment = workInProgress.child as Fiber;
						const primaryChildLanes = primaryChildFragment.childLanes;
						if (includesSomeLane(renderLanes, primaryChildLanes)) {
							// The primary children have pending work. Use the normal path
							// to attempt to render the primary children again.
							return updateSuspenseComponent(current, workInProgress, renderLanes);
						} else {
							// The primary child fragment does not have pending work marked
							// on it
							pushSuspenseContext(
								workInProgress,
								setDefaultShallowSuspenseContext(suspenseStackCursor.current)
							);
							// The primary children do not have pending work with sufficient
							// priority. Bailout.
							const child = bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
							if (child !== undefined) {
								// The fallback children have pending work. Skip over the
								// primary children and work on the fallback.
								return child.sibling;
							} else {
								return undefined;
							}
						}
					} else {
						pushSuspenseContext(
							workInProgress,
							setDefaultShallowSuspenseContext(suspenseStackCursor.current)
						);
					}
					break;
				}
				case SuspenseListComponent: {
					unimplemented('beginWork: SuspenseListComponent');
					break;
				}
				case OffscreenComponent:
				case LegacyHiddenComponent: {
					// Need to check if the tree still needs to be deferred. This is
					// almost identical to the logic used in the normal update path,
					// so we'll just enter that. The only difference is we'll bail out
					// at the next level instead of this one, because the child props
					// have not changed. Which is fine.
					// TODO: Probably should refactor `beginWork` to split the bailout
					// path from the normal path. I'm tempted to do a labeled break here
					// but I won't :)
					workInProgress.lanes = NoLanes;
					return updateOffscreenComponent(current, workInProgress, renderLanes);
				}
			}
			return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
		} else {
			if ((current.flags & ForceUpdateForLegacySuspense) !== NoFlags) {
				// This is a special case that only exists for legacy mode.
				// See https://github.com/facebook/react/pull/19216.
				didReceiveUpdate = true;
			} else {
				// An update was scheduled on this fiber, but there are no new props
				// nor legacy context. Set this to false. If an update queue or context
				// consumer produces a changed value, it will set this to true. Otherwise,
				// the component will assume the children have not changed and bail out.
				didReceiveUpdate = false;
			}
		}
	} else {
		didReceiveUpdate = false;
	}

	// Before entering the begin phase, clear pending update priority.
	// TODO: This assumes that we're about to evaluate the component and process
	// the update queue. However, there's an exception: SimpleMemoComponent
	// sometimes bails out later in the begin phase. This indicates that we should
	// move this assignment out of the common path and into each branch.
	workInProgress.lanes = NoLanes;

	switch (workInProgress.tag) {
		case IndeterminateComponent: {
			return mountIndeterminateComponent(current, workInProgress, workInProgress.type, renderLanes);
		}
		case LazyComponent: {
			const elementType = workInProgress.elementType;
			return mountLazyComponent(current, workInProgress, elementType, updateLanes, renderLanes);
		}
		case FunctionComponent: {
			const Component = workInProgress.type as Record<string, unknown>;
			const unresolvedProps = workInProgress.pendingProps;
			const resolvedProps =
				(workInProgress.elementType as unknown) === Component
					? unresolvedProps
					: resolveDefaultProps(Component, unresolvedProps);
			return updateFunctionComponent(current, workInProgress, Component, resolvedProps, renderLanes);
		}
		case ClassComponent: {
			const Component = workInProgress.type as Record<string, unknown>;
			const unresolvedProps = workInProgress.pendingProps;
			const resolvedProps =
				(workInProgress.elementType as unknown) === Component
					? unresolvedProps
					: resolveDefaultProps(Component, unresolvedProps);
			return updateClassComponent(current, workInProgress, Component, resolvedProps, renderLanes);
		}
		case HostRoot:
			return updateHostRoot(current, workInProgress, renderLanes);
		case HostComponent:
			return updateHostComponent(current, workInProgress, renderLanes);
		case HostText:
			return updateHostText(current, workInProgress);
		case SuspenseComponent:
			return updateSuspenseComponent(current, workInProgress, renderLanes);
		case HostPortal:
			return updatePortalComponent(current, workInProgress, renderLanes);
		case ForwardRef: {
			const type_ = workInProgress.type as Record<string, unknown>;
			const unresolvedProps = workInProgress.pendingProps;
			const resolvedProps =
				(workInProgress.elementType as unknown) === type_
					? unresolvedProps
					: resolveDefaultProps(type_, unresolvedProps);
			return updateForwardRef(current, workInProgress, type_, resolvedProps, renderLanes);
		}
		case Fragment:
			return updateFragment(current, workInProgress, renderLanes);
		case Mode:
			return updateMode(current, workInProgress, renderLanes);
		case Profiler:
			return updateProfiler(current, workInProgress, renderLanes);
		case ContextProvider:
			return updateContextProvider(current, workInProgress, renderLanes);
		case ContextConsumer:
			return updateContextConsumer(current, workInProgress, renderLanes);
		case MemoComponent: {
			const type_ = workInProgress.type as Record<string, unknown>;
			const unresolvedProps = workInProgress.pendingProps;
			// Resolve outer props first, then resolve inner props.
			let resolvedProps = resolveDefaultProps(type_, unresolvedProps);
			if (__DEV__ || __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__) {
				if ((workInProgress.type as unknown) !== (workInProgress.elementType as unknown)) {
					const outerPropTypes = type_.propTypes as Record<string, defined>;
					const validateProps = type_.validateProps as unknown;
					if (outerPropTypes || validateProps) {
						checkPropTypes(
							outerPropTypes,
							validateProps as any,
							resolvedProps, // Resolved for outer only
							'prop',
							getComponentName(type_)
						);
					}
				}
			}
			resolvedProps = resolveDefaultProps(type_.type as defined, resolvedProps);
			return updateMemoComponent(current, workInProgress, type_, resolvedProps, updateLanes, renderLanes);
		}
		case SimpleMemoComponent: {
			return updateSimpleMemoComponent(
				current,
				workInProgress,
				workInProgress.type,
				workInProgress.pendingProps,
				updateLanes,
				renderLanes
			);
		}
		case IncompleteClassComponent: {
			const Component = workInProgress.type as Record<string, unknown>;
			const unresolvedProps = workInProgress.pendingProps;
			const resolvedProps =
				(workInProgress.elementType as unknown) === Component
					? unresolvedProps
					: resolveDefaultProps(Component, unresolvedProps);
			return mountIncompleteClassComponent(current, workInProgress, Component, resolvedProps, renderLanes);
		}
		// case SuspenseListComponent:
		// case FundamentalComponent:
		// case ScopeComponent:
		// case Block:
		case OffscreenComponent: {
			return updateOffscreenComponent(current, workInProgress, renderLanes);
		}
		case LegacyHiddenComponent: {
			return updateLegacyHiddenComponent(current, workInProgress, renderLanes);
		}
	}
	invariant(
		false,
		'Unknown unit of work tag (%s). This error is likely caused by a bug in ' + 'React. Please file an issue.',
		workInProgress.tag
	);
}
