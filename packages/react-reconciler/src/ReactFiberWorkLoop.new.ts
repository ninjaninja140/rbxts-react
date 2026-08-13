import { __DEV__, __YOLO__, __ROACT_17_MOCK_SCHEDULER__ } from '@nrbx/react-globals';
import {
	console,
	describeError,
	enqueueTask,
	getComponentName,
	invariant,
	ReactErrorUtils,
	ReactFeatureFlags,
	ReactSharedInternals,
} from '@nrbx/react-shared';
import type { Dispatcher, Thenable, Wakeable } from '@nrbx/react-shared';
import * as Scheduler from '@nrbx/scheduler';
import { tracing } from '@nrbx/scheduler';
import type { Interaction } from '@nrbx/scheduler';
import * as ReactCurrentFiber from './ReactCurrentFiber';
import * as DebugTracing from './DebugTracing';
import * as ReactFiberFlags from './ReactFiberFlags';
import * as ReactFiberLane from './ReactFiberLane';
import * as ReactTypeOfMode from './ReactTypeOfMode';
import * as ReactWorkTags from './ReactWorkTags';
import * as SchedulingProfiler from './SchedulingProfiler';
import * as SchedulerWithReactIntegration from './SchedulerWithReactIntegration.new';
import * as RobloxReactProfiling from './RobloxReactProfiling';
import * as ReactFiber from './ReactFiber.new';
import * as ReactFiberStack from './ReactFiberStack.new';
import * as ReactFiberTransition from './ReactFiberTransition';
import * as ReactFiberWorkInProgress from './ReactFiberWorkInProgress';
import ReactFiberUnwindWork from './ReactFiberUnwindWork.new';
import ReactStrictModeWarnings from './ReactStrictModeWarnings.new';
import ReactProfilerTimer from './ReactProfilerTimer.new';
import HostConfig from './ReactFiberHostConfig';
import { LegacyRoot } from './ReactRootTags';
import { createCapturedValue } from './ReactCapturedValue';
import { enqueueUpdate } from './ReactUpdateQueue.new';
import { resetContextDependencies } from './ReactFiberNewContext.new';
import { onCommitRoot as onCommitRootDevTools } from './ReactFiberDevToolsHook.new';
import { onCommitRoot as onCommitRootTestSelector } from './ReactTestSelectors';
import { doesFiberContain } from './ReactFiberTreeReflection';
import {
	commitBeforeMutationLifeCycles,
	commitDeletion,
	commitDetachRef,
	commitPassiveMount,
	commitPassiveUnmount,
	commitPassiveUnmountInsideDeletedTree,
	commitPlacement,
	commitWork,
	invokeLayoutEffectMountInDEV,
	invokeLayoutEffectUnmountInDEV,
	invokePassiveEffectMountInDEV,
	invokePassiveEffectUnmountInDEV,
	isSuspenseBoundaryBeingHidden,
	recursivelyCommitLayoutEffects,
} from './ReactFiberCommitWork.new';
import type { Fiber, FiberRoot, Lanes, Lane, ReactPriorityLevel } from './types';

const { ReactCurrentDispatcher, ReactCurrentOwner, IsSomeRendererActing } = ReactSharedInternals;

const { invokeGuardedCallback, hasCaughtError, clearCaughtError } = ReactErrorUtils;

const {
	ImmediatePriority,
	UserBlockingPriority,
	NormalPriority,
	NoPriority,
	cancelCallback,
	flushSyncCallbackQueue,
	getCurrentPriorityLevel,
	now,
	requestPaint,
	runWithPriority,
	scheduleCallback,
	scheduleSyncCallback,
	shouldYield,
} = SchedulerWithReactIntegration;

const { __interactionsRef, __subscriberRef } = tracing;

const {
	enableDebugTracing,
	enableSchedulingProfiler,
	enableSchedulerTracing,
	enableProfilerTimer,
	enableProfilerCommitHooks,
	enableDoubleInvokingEffects,
	skipUnmountedBoundaries,
	decoupleUpdatePriorityFromScheduler,
	deferRenderPhaseUpdateToNextBatch,
	replayFailedUnitOfWorkWithInvokeGuardedCallback,
	warnAboutDeprecatedLifecycles,
	warnAboutUnmockedScheduler,
} = ReactFeatureFlags;

type StackCursor<T> = ReactFiberStack.StackCursor<T>;

// Lazy sibling module loading
// ReactFiberWorkLoop participates in a dependency cycle with several of its
// siblings: they statically import this module for the public work loop API,
// while this module needs their internals on hot paths. Static imports in both
// directions would create a cycle, so the internals below are loaded lazily
// through Roblox's sibling-module `require` mechanism. Each lazy loader caches
// its result after the first call.

function getSiblingModule(moduleName: string): unknown {
	const parent = (script as ModuleScript).Parent;
	invariant(parent !== undefined, 'Expected module parent to exist.');
	const child = parent.FindFirstChild(moduleName);
	invariant(child?.IsA('ModuleScript') === true, "Expected sibling module '%s' to exist.", moduleName);
	return require(child as ModuleScript);
}

type ThrowModule = {
	throwException: (
		root: FiberRoot,
		returnFiber: Fiber,
		sourceFiber: Fiber,
		value: unknown,
		rootRenderLanes: Lanes,
		onUncaughtError: ((error: unknown) => void) | undefined,
		renderDidError: () => void
	) => void;
	createRootErrorUpdate: (
		fiber: Fiber,
		errorInfo: any,
		lane: Lane,
		onUncaughtError: ((error: unknown) => void) | undefined
	) => any;
	createClassErrorUpdate: (fiber: Fiber, errorInfo: any, lane: Lane) => any;
};

let ReactFiberThrow: ThrowModule | undefined;

function throwException(
	root: FiberRoot,
	returnFiber: Fiber,
	sourceFiber: Fiber,
	value: unknown,
	rootRenderLanes: Lanes,
	onUncaughtError: ((error: unknown) => void) | undefined,
	renderDidError: () => void
): void {
	if (ReactFiberThrow === undefined) {
		ReactFiberThrow = getSiblingModule('ReactFiberThrow.new') as ThrowModule;
	}
	ReactFiberThrow.throwException(
		root,
		returnFiber,
		sourceFiber,
		value,
		rootRenderLanes,
		onUncaughtError,
		renderDidError
	);
}

function createRootErrorUpdate(
	fiber: Fiber,
	errorInfo: any,
	lane: Lane,
	onUncaughtError: ((error: unknown) => void) | undefined
): any {
	if (ReactFiberThrow === undefined) {
		ReactFiberThrow = getSiblingModule('ReactFiberThrow.new') as ThrowModule;
	}
	return ReactFiberThrow.createRootErrorUpdate(fiber, errorInfo, lane, onUncaughtError);
}

function createClassErrorUpdate(fiber: Fiber, errorInfo: any, lane: Lane): any {
	if (ReactFiberThrow === undefined) {
		ReactFiberThrow = getSiblingModule('ReactFiberThrow.new') as ThrowModule;
	}
	return ReactFiberThrow.createClassErrorUpdate(fiber, errorInfo, lane);
}

type HooksModule = {
	resetHooksAfterThrow: () => void;
	ContextOnlyDispatcher: Dispatcher;
	getIsUpdatingOpaqueValueInRenderPhaseInDEV: () => boolean | undefined;
};

let ReactFiberHooks: HooksModule | undefined;

function resetHooksAfterThrow(): void {
	if (ReactFiberHooks === undefined) {
		ReactFiberHooks = getSiblingModule('ReactFiberHooks.new') as HooksModule;
	}
	ReactFiberHooks.resetHooksAfterThrow();
}

function getContextOnlyDispatcher(): Dispatcher {
	if (ReactFiberHooks === undefined) {
		ReactFiberHooks = getSiblingModule('ReactFiberHooks.new') as HooksModule;
	}
	return ReactFiberHooks.ContextOnlyDispatcher;
}

function getIsUpdatingOpaqueValueInRenderPhaseInDEV(): boolean | undefined {
	if (ReactFiberHooks === undefined) {
		ReactFiberHooks = getSiblingModule('ReactFiberHooks.new') as HooksModule;
	}
	return ReactFiberHooks.getIsUpdatingOpaqueValueInRenderPhaseInDEV();
}

let originalBeginWorkRef:
	| ((current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) => Fiber | undefined)
	| undefined;
let completeWorkRef:
	| ((current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) => Fiber | undefined)
	| undefined;

function originalBeginWork(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes): Fiber | undefined {
	if (originalBeginWorkRef === undefined) {
		originalBeginWorkRef = (
			getSiblingModule('ReactFiberBeginWork.new') as {
				beginWork: typeof originalBeginWork;
			}
		).beginWork;
	}
	return originalBeginWorkRef(current, workInProgress, renderLanes);
}

// The beginWork entry point. In DEV builds with guarded-callback replay this is
// reassigned to a wrapper that replays a failed unit of work so debuggers see it
// as an uncaught error (see `beginWork` below).
let beginWork: (current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes) => Fiber | undefined =
	originalBeginWork;

function completeWork(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes): Fiber | undefined {
	if (completeWorkRef === undefined) {
		completeWorkRef = (
			getSiblingModule('ReactFiberCompleteWork.new') as {
				completeWork: typeof completeWork;
			}
		).completeWork;
	}
	return completeWorkRef(current, workInProgress, renderLanes);
}

// Debug-only helpers that set and clear the fiber currently being worked on.
// In production builds these are no-ops guarded by the `__DEV__` flag inside
// `ReactCurrentFiber`.
function setCurrentDebugFiberInDEV(fiber: Fiber): void {
	ReactCurrentFiber.setCurrentFiber(fiber);
}

function resetCurrentDebugFiberInDEV(): void {
	ReactCurrentFiber.resetCurrentFiber();
}

// The scheduler is referenced here *only* to detect whether it's been mocked.
// Cast through a concrete shape rather than `any` because roblox-ts refuses to
// emit code that consumes `any`-typed values.
const flushMockScheduler = (
	Scheduler as unknown as {
		unstable_flushAllWithoutAsserting?: (...args: Array<unknown>) => unknown;
	}
).unstable_flushAllWithoutAsserting;

type ExecutionContext = number;

const NoContext: ExecutionContext = 0b0000000;
const BatchedContext: ExecutionContext = 0b0000001;
const EventContext: ExecutionContext = 0b0000010;
const DiscreteEventContext: ExecutionContext = 0b0000100;
const LegacyUnbatchedContext: ExecutionContext = 0b0001000;
const RenderContext: ExecutionContext = 0b0010000;
const CommitContext: ExecutionContext = 0b0100000;
const RetryAfterError: ExecutionContext = 0b1000000;

export { NoContext, RetryAfterError };

const RootExitStatus = {
	Incomplete: 0,
	FatalErrored: 1,
	Errored: 2,
	Suspended: 3,
	SuspendedWithDelay: 4,
	Completed: 5,
} as const;

// Describes where we are in the React execution stack.
let executionContext: ExecutionContext = NoContext;
// The root we're working on.
let workInProgressRoot: FiberRoot | undefined;
// The fiber we're working on.
let workInProgress: Fiber | undefined;
// The lanes we're rendering.
let workInProgressRootRenderLanes: Lanes = ReactFiberLane.NoLanes;

// Stack that allows components to change the render lanes for its subtree.
export let subtreeRenderLanes: Lanes = ReactFiberLane.NoLanes;
const subtreeRenderLanesCursor: StackCursor<Lanes> = ReactFiberStack.createCursor(ReactFiberLane.NoLanes);

// Whether the root completed, errored, suspended, etc.
let workInProgressRootExitStatus: number = RootExitStatus.Incomplete;
// A fatal error, if one is thrown.
let workInProgressRootFatalError: any;
let workInProgressRootIncludedLanes: Lanes = ReactFiberLane.NoLanes;
const workInProgressRootSkippedLanes = ReactFiberWorkInProgress.workInProgressRootSkippedLanes;
// Lanes that were updated (in an interleaved event) during this render.
let workInProgressRootUpdatedLanes: Lanes = ReactFiberLane.NoLanes;
// Lanes that were pinged (in an interleaved event) during this render.
let workInProgressRootPingedLanes: Lanes = ReactFiberLane.NoLanes;

let mostRecentlyUpdatedRoot: FiberRoot | undefined;

// The most recent time we committed a fallback.
let globalMostRecentFallbackTime = 0;
const FALLBACK_THROTTLE_MS = 500;

// The absolute time for when we should start giving up on rendering more.
let workInProgressRootRenderTargetTime = math.huge;
const RENDER_TIMEOUT_MS = 500;

// Used to avoid traversing the return path to find the nearest Profiler ancestor during commit.
let nearestProfilerOnStack: Fiber | undefined;

function resetRenderTimer(): void {
	workInProgressRootRenderTargetTime = now() + RENDER_TIMEOUT_MS;
}

export function getRenderTargetTime(): number {
	return workInProgressRootRenderTargetTime;
}

let hasUncaughtError = false;
let firstUncaughtError: any;
let legacyErrorBoundariesThatAlreadyFailed: Set<any> | undefined;

let rootDoesHavePassiveEffects = false;
let rootWithPendingPassiveEffects: FiberRoot | undefined;
let pendingPassiveEffectsRenderPriority: ReactPriorityLevel = NoPriority;
let pendingPassiveEffectsLanes: Lanes = ReactFiberLane.NoLanes;

let rootsWithPendingDiscreteUpdates: Set<FiberRoot> | undefined;

// Use these to prevent an infinite loop of nested updates.
const NESTED_UPDATE_LIMIT = 50;
let nestedUpdateCount = 0;
let rootWithNestedUpdates: FiberRoot | undefined;

const NESTED_PASSIVE_UPDATE_LIMIT = 50;
let nestedPassiveUpdateCount = 0;

// Marks the need to reschedule pending interactions at these lanes during the commit phase.
let spawnedWorkDuringRender: Array<Lane | Lanes> | undefined;

// If two updates are scheduled within the same event, we treat their event times as simultaneous.
let currentEventTime: number = ReactFiberLane.NoTimestamp;
let currentEventWipLanes: Lanes = ReactFiberLane.NoLanes;
let currentEventPendingLanes: Lanes = ReactFiberLane.NoLanes;

let focusedInstanceHandle: Fiber | undefined;
let shouldFireAfterActiveInstanceBlur = false;

export function getWorkInProgressRoot(): FiberRoot | undefined {
	return workInProgressRoot;
}

export function requestEventTime(): number {
	if (bit32.band(executionContext, bit32.bor(RenderContext, CommitContext)) !== NoContext) {
		// We're inside React, so it's fine to read the actual time.
		return now();
	}
	// We're not inside React, so we may be in the middle of a browser event.
	if (currentEventTime !== ReactFiberLane.NoTimestamp) {
		// Use the same start time for all updates until we enter React again.
		return currentEventTime;
	}
	// This is the first update since React yielded. Compute a new start time.
	currentEventTime = now();
	return currentEventTime;
}

export function requestUpdateLane(fiber: Fiber): Lane {
	// Special cases.
	const mode = fiber.mode;
	if (bit32.band(mode, ReactTypeOfMode.BlockingMode) === ReactTypeOfMode.NoMode) {
		return ReactFiberLane.SyncLane;
	} else if (bit32.band(mode, ReactTypeOfMode.ConcurrentMode) === ReactTypeOfMode.NoMode) {
		return getCurrentPriorityLevel() === ImmediatePriority
			? ReactFiberLane.SyncLane
			: ReactFiberLane.SyncBatchedLane;
	} else if (
		!deferRenderPhaseUpdateToNextBatch &&
		bit32.band(executionContext, RenderContext) !== NoContext &&
		workInProgressRootRenderLanes !== ReactFiberLane.NoLanes
	) {
		// This is a render phase update. These are not officially supported.
		return ReactFiberLane.pickArbitraryLane(workInProgressRootRenderLanes);
	}

	if (currentEventWipLanes === ReactFiberLane.NoLanes) {
		currentEventWipLanes = workInProgressRootIncludedLanes;
	}

	const isTransition = ReactFiberTransition.requestCurrentTransition() !== ReactFiberTransition.NoTransition;
	if (isTransition) {
		if (currentEventPendingLanes !== ReactFiberLane.NoLanes) {
			if (mostRecentlyUpdatedRoot !== undefined) {
				currentEventPendingLanes = mostRecentlyUpdatedRoot.pendingLanes;
			} else {
				currentEventPendingLanes = ReactFiberLane.NoLanes;
			}
		}
		return ReactFiberLane.findTransitionLane(currentEventWipLanes, currentEventPendingLanes);
	}

	const schedulerPriority = getCurrentPriorityLevel();

	let lane: Lane;
	if (
		bit32.band(executionContext, DiscreteEventContext) !== NoContext &&
		schedulerPriority === UserBlockingPriority
	) {
		lane = ReactFiberLane.findUpdateLane(ReactFiberLane.InputDiscreteLanePriority, currentEventWipLanes);
	} else {
		const schedulerLanePriority = ReactFiberLane.schedulerPriorityToLanePriority(schedulerPriority);

		if (decoupleUpdatePriorityFromScheduler) {
			const currentUpdateLanePriority = ReactFiberLane.getCurrentUpdateLanePriority();
			if (
				schedulerLanePriority !== currentUpdateLanePriority &&
				currentUpdateLanePriority !== ReactFiberLane.NoLanePriority
			) {
				if (__DEV__) {
					console.error(
						'Expected current scheduler lane priority %s to match current update lane priority %s',
						tostring(schedulerLanePriority),
						tostring(currentUpdateLanePriority)
					);
				}
			}
		}

		lane = ReactFiberLane.findUpdateLane(schedulerLanePriority, currentEventWipLanes);
	}

	return lane;
}

function requestRetryLane(fiber: Fiber): Lane {
	// This is a fork of `requestUpdateLane` designed specifically for Suspense "retries".
	const mode = fiber.mode;
	if (bit32.band(mode, ReactTypeOfMode.BlockingMode) === ReactTypeOfMode.NoMode) {
		return ReactFiberLane.SyncLane;
	} else if (bit32.band(mode, ReactTypeOfMode.ConcurrentMode) === ReactTypeOfMode.NoMode) {
		return getCurrentPriorityLevel() === ImmediatePriority
			? ReactFiberLane.SyncLane
			: ReactFiberLane.SyncBatchedLane;
	}

	if (currentEventWipLanes === ReactFiberLane.NoLanes) {
		currentEventWipLanes = workInProgressRootIncludedLanes;
	}
	return ReactFiberLane.findRetryLane(currentEventWipLanes);
}

export function scheduleUpdateOnFiber(fiber: Fiber, lane: Lane, eventTime: number): FiberRoot | undefined {
	checkForNestedUpdates();

	const root = markUpdateLaneFromFiberToRoot(fiber, lane);
	if (root === undefined) {
		return undefined;
	}

	// Mark that the root has a pending update.
	ReactFiberLane.markRootUpdated(root, lane, eventTime);

	if (root === workInProgressRoot) {
		// Received an update to a tree that's in the middle of rendering.
		warnAboutRenderPhaseUpdatesInDEV(fiber);

		if (deferRenderPhaseUpdateToNextBatch || bit32.band(executionContext, RenderContext) === NoContext) {
			workInProgressRootUpdatedLanes = ReactFiberLane.mergeLanes(workInProgressRootUpdatedLanes, lane);
		}
		if (workInProgressRootExitStatus === RootExitStatus.SuspendedWithDelay) {
			// The root already suspended with a delay, which means this render
			// definitely won't finish.
			markRootSuspended(root, workInProgressRootRenderLanes);
		}
	}

	const priorityLevel = getCurrentPriorityLevel();

	if (lane === ReactFiberLane.SyncLane) {
		if (
			// Check if we're inside unbatchedUpdates.
			bit32.band(executionContext, LegacyUnbatchedContext) !== NoContext &&
			// Check if we're not already rendering.
			bit32.band(executionContext, bit32.bor(RenderContext, CommitContext)) === NoContext
		) {
			// Register pending interactions on the root to avoid losing traced interaction data.
			schedulePendingInteractions(root, lane);

			// This is a legacy edge case. The initial mount of a render-ed root inside
			// batchedUpdates should be synchronous, but layout updates should be
			// deferred until the end of the batch.
			performSyncWorkOnRoot(root);
		} else {
			ensureRootIsScheduled(root, eventTime);
			schedulePendingInteractions(root, lane);
			if (executionContext === NoContext) {
				// Flush the synchronous work now, unless we're already working or inside a batch.
				resetRenderTimer();
				flushSyncCallbackQueue();
			}
		}
	} else {
		// Schedule a discrete update but only if it's not Sync.
		if (
			bit32.band(executionContext, DiscreteEventContext) !== NoContext &&
			(priorityLevel === UserBlockingPriority || priorityLevel === ImmediatePriority)
		) {
			// This is the result of a discrete event. Track the lowest priority discrete
			// update per root so we can flush them early, if needed.
			if (rootsWithPendingDiscreteUpdates === undefined) {
				rootsWithPendingDiscreteUpdates = new Set([root]);
			} else {
				rootsWithPendingDiscreteUpdates.add(root);
			}
		}
		// Schedule other updates after in case the callback is sync.
		ensureRootIsScheduled(root, eventTime);
		schedulePendingInteractions(root, lane);
	}

	// We use this when assigning a lane for a transition inside `requestUpdateLane`.
	mostRecentlyUpdatedRoot = root;
	return root;
}

// This is split into a separate function so we can mark a fiber with pending work
// without treating it as a typical update that originates from an event.
function markUpdateLaneFromFiberToRoot(sourceFiber: Fiber, lane: Lane): FiberRoot | undefined {
	// Update the source fiber's lanes.
	sourceFiber.lanes = ReactFiberLane.mergeLanes(sourceFiber.lanes, lane);
	let alternate = sourceFiber.alternate;
	if (alternate !== undefined) {
		alternate.lanes = ReactFiberLane.mergeLanes(alternate.lanes, lane);
	}
	if (__DEV__) {
		if (
			alternate === undefined &&
			bit32.band(sourceFiber.flags, bit32.bor(ReactFiberFlags.Placement, ReactFiberFlags.Hydrating)) !==
				ReactFiberFlags.NoFlags
		) {
			warnAboutUpdateOnNotYetMountedFiberInDEV(sourceFiber);
		}
	}
	// Walk the parent path to the root and update the child expiration time.
	let node = sourceFiber;
	let parent = sourceFiber.return_;
	while (parent !== undefined) {
		parent.childLanes = ReactFiberLane.mergeLanes(parent.childLanes, lane);
		alternate = parent.alternate;
		if (alternate !== undefined) {
			alternate.childLanes = ReactFiberLane.mergeLanes(alternate.childLanes, lane);
		} else {
			if (__DEV__) {
				if (
					bit32.band(parent.flags, bit32.bor(ReactFiberFlags.Placement, ReactFiberFlags.Hydrating)) !==
					ReactFiberFlags.NoFlags
				) {
					warnAboutUpdateOnNotYetMountedFiberInDEV(sourceFiber);
				}
			}
		}
		node = parent;
		parent = parent.return_;
	}
	if (node.tag === ReactWorkTags.HostRoot) {
		const root: FiberRoot = node.stateNode;
		return root;
	} else {
		return undefined;
	}
}

// Use this function to schedule a task for a root. There's only one task per root.
function ensureRootIsScheduled(root: FiberRoot, currentTime: number): void {
	const existingCallbackNode = root.callbackNode;

	// Check if any lanes are being starved by other work. If so, mark them as expired.
	ReactFiberLane.markStarvedLanesAsExpired(root, currentTime);

	// Determine the next lanes to work on, and their priority.
	const lanes = root === workInProgressRoot ? workInProgressRootRenderLanes : ReactFiberLane.NoLanes;
	const nextLanes = ReactFiberLane.getNextLanes(root, lanes);
	// This returns the priority level computed during the `getNextLanes` call.
	const newCallbackPriority = ReactFiberLane.returnNextLanesPriority();

	if (nextLanes === ReactFiberLane.NoLanes) {
		// Special case: There's nothing to work on.
		if (existingCallbackNode !== undefined) {
			cancelCallback(existingCallbackNode);
			root.callbackNode = undefined;
			root.callbackPriority = ReactFiberLane.NoLanePriority;
		}
		return;
	}

	// Check if there's an existing task. We may be able to reuse it.
	if (existingCallbackNode !== undefined) {
		const existingCallbackPriority = root.callbackPriority;
		if (existingCallbackPriority === newCallbackPriority) {
			// The priority hasn't changed. We can reuse the existing task.
			return;
		}
		// The priority changed. Cancel the existing callback.
		cancelCallback(existingCallbackNode);
	}

	// Schedule a new callback.
	let newCallbackNode: unknown;
	if (newCallbackPriority === ReactFiberLane.SyncLanePriority) {
		// Special case: Sync React callbacks are scheduled on a special internal queue.
		newCallbackNode = scheduleSyncCallback(() => {
			const profileRunning = RobloxReactProfiling.profileRootBeforeUnitOfWork(root);
			const ret = performSyncWorkOnRoot(root);
			RobloxReactProfiling.profileRootAfterYielding(profileRunning);
			return ret;
		});
	} else if (newCallbackPriority === ReactFiberLane.SyncBatchedLanePriority) {
		newCallbackNode = scheduleCallback(ImmediatePriority, () => {
			const profileRunning = RobloxReactProfiling.profileRootBeforeUnitOfWork(root);
			const ret = performSyncWorkOnRoot(root);
			RobloxReactProfiling.profileRootAfterYielding(profileRunning);
			return ret;
		});
	} else {
		const schedulerPriorityLevel = ReactFiberLane.lanePriorityToSchedulerPriority(newCallbackPriority);
		newCallbackNode = scheduleCallback(schedulerPriorityLevel, () => {
			const profileRunning = RobloxReactProfiling.profileRootBeforeUnitOfWork(root);
			const ret = performConcurrentWorkOnRoot(root);
			RobloxReactProfiling.profileRootAfterYielding(profileRunning);
			return ret;
		});
	}

	root.callbackPriority = newCallbackPriority;
	root.callbackNode = newCallbackNode;
}

// This is the entry point for every concurrent task, i.e. anything that goes through Scheduler.
function performConcurrentWorkOnRoot(root: FiberRoot): Scheduler.Callback | undefined {
	// Since we know we're in a React event, we can clear the current event time.
	currentEventTime = ReactFiberLane.NoTimestamp;
	currentEventWipLanes = ReactFiberLane.NoLanes;
	currentEventPendingLanes = ReactFiberLane.NoLanes;

	invariant(
		bit32.band(executionContext, bit32.bor(RenderContext, CommitContext)) === NoContext,
		'Should not already be working.'
	);

	// Flush any pending passive effects before deciding which lanes to work on.
	const originalCallbackNode = root.callbackNode;
	const didFlushPassiveEffects = flushPassiveEffects();
	if (didFlushPassiveEffects) {
		// Something in the passive effect phase may have canceled the current task.
		if (root.callbackNode !== originalCallbackNode) {
			// The current task was canceled. Exit.
			return undefined;
		}
	}

	// Determine the next expiration time to work on, using the fields stored on the root.
	let lanes = ReactFiberLane.getNextLanes(
		root,
		root === workInProgressRoot ? workInProgressRootRenderLanes : ReactFiberLane.NoLanes
	);
	if (lanes === ReactFiberLane.NoLanes) {
		// Defensive coding. This is never expected to happen.
		return undefined;
	}

	let exitStatus = renderRootConcurrent(root, lanes);

	if (ReactFiberLane.includesSomeLane(workInProgressRootIncludedLanes, workInProgressRootUpdatedLanes)) {
		// The render included lanes that were updated during the render phase.
		// We'll throw out the current work and restart.
		prepareFreshStack(root, ReactFiberLane.NoLanes);
	} else if (exitStatus !== RootExitStatus.Incomplete) {
		if (exitStatus === RootExitStatus.Errored) {
			executionContext = bit32.bor(executionContext, RetryAfterError);

			// If an error occurred during hydration, discard server response and
			// fall back to client side render.
			if (root.hydrate) {
				root.hydrate = false;
				HostConfig.clearContainer(root.containerInfo);
			}

			// If something threw an error, try rendering one more time.
			lanes = ReactFiberLane.getLanesToRetrySynchronouslyOnError(root);
			if (lanes !== ReactFiberLane.NoLanes) {
				exitStatus = renderRootSync(root, lanes);
			}
		}

		if (exitStatus === RootExitStatus.FatalErrored) {
			const fatalError = workInProgressRootFatalError;
			prepareFreshStack(root, ReactFiberLane.NoLanes);
			markRootSuspended(root, lanes);
			ensureRootIsScheduled(root, now());
			error(fatalError);
		}

		// We now have a consistent tree. The next step is either to commit it, or,
		// if something suspended, wait to commit it after a timeout.
		const finishedWork: Fiber = root.current.alternate as any;
		root.finishedWork = finishedWork;
		root.finishedLanes = lanes;
		finishConcurrentRender(root, exitStatus, lanes);
	}

	ensureRootIsScheduled(root, now());
	if (root.callbackNode === originalCallbackNode) {
		// The task node scheduled for this root is the same one that's currently
		// executing. Need to return a continuation.
		return () => {
			const profileRunning = RobloxReactProfiling.profileRootBeforeUnitOfWork(root);
			const ret = performConcurrentWorkOnRoot(root);
			RobloxReactProfiling.profileRootAfterYielding(profileRunning);
			return ret;
		};
	}
	return undefined;
}

// We track the depth of the act() calls with this counter, so we can tell if
// any async act() calls try to run in parallel.
let actingUpdatesScopeDepth = 0;
let didWarnAboutUsingActInProd = false;

function shouldForceFlushFallbacksInDEV(): boolean {
	// Never force flush in production.
	return __DEV__ && actingUpdatesScopeDepth > 0;
}

function finishConcurrentRender(root: FiberRoot, exitStatus: number, lanes: Lanes): void {
	if (exitStatus === RootExitStatus.Incomplete || exitStatus === RootExitStatus.FatalErrored) {
		invariant(false, 'Root did not complete. This is a bug in React.');
	} else if (exitStatus === RootExitStatus.Errored) {
		// We should have already attempted to retry this tree. If we reached this
		// point, it errored again. Commit it.
		commitRoot(root);
	} else if (exitStatus === RootExitStatus.Suspended) {
		markRootSuspended(root, lanes);

		// We have an acceptable loading state. We need to figure out if we should
		// immediately commit it or wait a bit.
		if (
			ReactFiberLane.includesOnlyRetries(lanes) &&
			// Do not delay if we're inside an act() scope.
			!shouldForceFlushFallbacksInDEV()
		) {
			// This render only included retries, no updates. Throttle committing retries.
			const msUntilTimeout = globalMostRecentFallbackTime + FALLBACK_THROTTLE_MS - now();
			// Don't bother with a very short suspense time.
			if (msUntilTimeout > 10) {
				const nextLanes = ReactFiberLane.getNextLanes(root, ReactFiberLane.NoLanes);
				if (nextLanes !== ReactFiberLane.NoLanes) {
					// There's additional work on this root.
					return;
				}
				const suspendedLanes = root.suspendedLanes;
				if (!ReactFiberLane.isSubsetOfLanes(suspendedLanes, lanes)) {
					// We should prefer to render the fallback of at the last suspended
					// level. Ping the last suspended level to try rendering it again.
					const eventTime = requestEventTime();
					ReactFiberLane.markRootPinged(root, suspendedLanes, eventTime);
					return;
				}

				// The render is suspended, it hasn't timed out, and there's no lower
				// priority work to do. Wait for more data to arrive.
				root.timeoutHandle = HostConfig.scheduleTimeout(() => commitRoot(root), msUntilTimeout);
				return;
			}
		}
		// The work expired. Commit immediately.
		commitRoot(root);
	} else if (exitStatus === RootExitStatus.SuspendedWithDelay) {
		markRootSuspended(root, lanes);

		if (ReactFiberLane.includesOnlyTransitions(lanes)) {
			// This is a transition, so we should exit without committing a placeholder
			// and without scheduling a timeout. Delay indefinitely until more data arrives.
			return;
		}

		if (!shouldForceFlushFallbacksInDEV()) {
			// This is not a transition, but we did trigger an avoided state.
			const mostRecentEventTime = ReactFiberLane.getMostRecentEventTime(root, lanes);
			const eventTimeMs = mostRecentEventTime;
			const timeElapsedMs = now() - eventTimeMs;
			const msUntilTimeout = jnd(timeElapsedMs) - timeElapsedMs;

			// Don't bother with a very short suspense time.
			if (msUntilTimeout > 10) {
				root.timeoutHandle = HostConfig.scheduleTimeout(() => commitRoot(root), msUntilTimeout);
				return;
			}
		}
		// Commit the placeholder.
		commitRoot(root);
	} else if (exitStatus === RootExitStatus.Completed) {
		// The work completed. Ready to commit.
		commitRoot(root);
	} else {
		invariant(false, 'Unknown root exit status.');
	}
}

function markRootSuspended(root: FiberRoot, suspendedLanes: Lanes): void {
	// When suspending, we should always exclude lanes that were pinged or updated
	// during the render phase.
	let lanes = ReactFiberLane.removeLanes(suspendedLanes, workInProgressRootPingedLanes);
	lanes = ReactFiberLane.removeLanes(lanes, workInProgressRootUpdatedLanes);
	ReactFiberLane.markRootSuspended(root, lanes);
}

// This is the entry point for synchronous tasks that don't go through Scheduler.
function performSyncWorkOnRoot(root: FiberRoot): undefined {
	invariant(
		bit32.band(executionContext, bit32.bor(RenderContext, CommitContext)) === NoContext,
		'Should not already be working.'
	);

	flushPassiveEffects();

	let lanes: Lanes;
	let exitStatus: number;
	if (
		root === workInProgressRoot &&
		ReactFiberLane.includesSomeLane(root.expiredLanes, workInProgressRootRenderLanes)
	) {
		// There's a partial tree, and at least one of its lanes has expired. Finish
		// rendering it before rendering the rest of the expired work.
		lanes = workInProgressRootRenderLanes;
		exitStatus = renderRootSync(root, lanes);
		if (ReactFiberLane.includesSomeLane(workInProgressRootIncludedLanes, workInProgressRootUpdatedLanes)) {
			// The render included lanes that were updated during the render phase.
			lanes = ReactFiberLane.getNextLanes(root, lanes);
			exitStatus = renderRootSync(root, lanes);
		}
	} else {
		lanes = ReactFiberLane.getNextLanes(root, ReactFiberLane.NoLanes);
		exitStatus = renderRootSync(root, lanes);
	}

	if (root.tag !== LegacyRoot && exitStatus === RootExitStatus.Errored) {
		executionContext = bit32.bor(executionContext, RetryAfterError);

		// If an error occurred during hydration, discard server response.
		if (root.hydrate) {
			root.hydrate = false;
			HostConfig.clearContainer(root.containerInfo);
		}

		// If something threw an error, try rendering one more time.
		lanes = ReactFiberLane.getLanesToRetrySynchronouslyOnError(root);
		if (lanes !== ReactFiberLane.NoLanes) {
			exitStatus = renderRootSync(root, lanes);
		}
	}

	if (exitStatus === RootExitStatus.FatalErrored) {
		const fatalError = workInProgressRootFatalError;
		prepareFreshStack(root, ReactFiberLane.NoLanes);
		markRootSuspended(root, lanes);
		ensureRootIsScheduled(root, now());
		error(fatalError);
	}

	// We now have a consistent tree. Because this is a sync render, we will commit
	// it even if something suspended.
	const finishedWork: Fiber = root.current.alternate as any;
	root.finishedWork = finishedWork;
	root.finishedLanes = lanes;
	commitRoot(root);

	// Before exiting, make sure there's a callback scheduled for the next pending level.
	ensureRootIsScheduled(root, now());

	return undefined;
}

export function flushRoot(root: FiberRoot, lanes: Lanes): void {
	ReactFiberLane.markRootExpired(root, lanes);
	ensureRootIsScheduled(root, now());
	if (bit32.band(executionContext, bit32.bor(RenderContext, CommitContext)) === NoContext) {
		resetRenderTimer();
		flushSyncCallbackQueue();
	}
}

export function getExecutionContext(): ExecutionContext {
	return executionContext;
}

export function flushDiscreteUpdates(): void {
	if (bit32.band(executionContext, bit32.bor(BatchedContext, RenderContext, CommitContext)) !== NoContext) {
		if (__DEV__) {
			if (bit32.band(executionContext, RenderContext) !== NoContext) {
				console.error('unstable_flushDiscreteUpdates: Cannot flush updates when React is already rendering.');
			}
		}
		// We're already rendering, so we can't synchronously flush pending work.
		return;
	}
	flushPendingDiscreteUpdates();
	// If the discrete updates scheduled passive effects, flush them now so that they
	// fire before the next serial event.
	flushPassiveEffects();
}

export function deferredUpdates<A>(fn: () => A): A {
	if (decoupleUpdatePriorityFromScheduler) {
		const previousLanePriority = ReactFiberLane.getCurrentUpdateLanePriority();
		ReactFiberLane.setCurrentUpdateLanePriority(ReactFiberLane.DefaultLanePriority);
		const [ok, result] = __YOLO__
			? ([true, runWithPriority(NormalPriority, fn)] as const)
			: xpcall(runWithPriority, describeError, NormalPriority, fn);

		// finally
		ReactFiberLane.setCurrentUpdateLanePriority(previousLanePriority);

		if (ok) {
			return result;
		}
		error(result);
	}
	return runWithPriority(NormalPriority, fn);
}

function flushPendingDiscreteUpdates(): void {
	if (rootsWithPendingDiscreteUpdates !== undefined) {
		// For each root with pending discrete updates, schedule a callback to
		// immediately flush them.
		const roots = rootsWithPendingDiscreteUpdates;
		rootsWithPendingDiscreteUpdates = undefined;
		roots.forEach((root) => {
			ReactFiberLane.markDiscreteUpdatesExpired(root);
			ensureRootIsScheduled(root, now());
		});
	}
	// Now flush the immediate queue.
	flushSyncCallbackQueue();
}

export function batchedUpdates<A, R>(fn: (a: A) => R, a: A): R {
	const prevExecutionContext = executionContext;
	executionContext = bit32.bor(executionContext, BatchedContext);

	const [ok, result] = __YOLO__ ? ([true, fn(a)] as const) : xpcall(fn, describeError, a);

	// finally
	executionContext = prevExecutionContext;
	if (executionContext === NoContext) {
		// Flush the immediate callbacks that were scheduled during this batch.
		resetRenderTimer();
		flushSyncCallbackQueue();
	}

	if (ok) {
		return result;
	}
	error(result);
}

export function batchedEventUpdates<A, R>(fn: (a: A) => R, a: A): R {
	const prevExecutionContext = executionContext;
	executionContext = bit32.bor(executionContext, EventContext);

	const [ok, result] = __YOLO__ ? ([true, fn(a)] as const) : xpcall(fn, describeError, a);

	// finally
	executionContext = prevExecutionContext;
	if (executionContext === NoContext) {
		resetRenderTimer();
		flushSyncCallbackQueue();
	}

	if (ok) {
		return result;
	}
	error(result);
}

export function discreteUpdates<A, B, C, D, R>(fn: (a: A, b: B, c: C, d: D) => R, a: A, b: B, c: C, d: D): R {
	const prevExecutionContext = executionContext;
	executionContext = bit32.bor(executionContext, DiscreteEventContext);

	const previousLanePriority = decoupleUpdatePriorityFromScheduler
		? ReactFiberLane.getCurrentUpdateLanePriority()
		: undefined;
	if (decoupleUpdatePriorityFromScheduler) {
		ReactFiberLane.setCurrentUpdateLanePriority(ReactFiberLane.InputDiscreteLanePriority);
	}

	const [ok, result] = xpcall(runWithPriority, describeError, UserBlockingPriority, () => fn(a, b, c, d));

	// finally
	if (decoupleUpdatePriorityFromScheduler && previousLanePriority !== undefined) {
		ReactFiberLane.setCurrentUpdateLanePriority(previousLanePriority);
	}
	executionContext = prevExecutionContext;
	if (executionContext === NoContext) {
		resetRenderTimer();
		flushSyncCallbackQueue();
	}

	if (ok) {
		return result;
	}
	error(result);
}

export function unbatchedUpdates<A, R>(fn: (a: A) => R, a: A): R {
	const prevExecutionContext = executionContext;
	executionContext = bit32.band(executionContext, bit32.bnot(BatchedContext));
	executionContext = bit32.bor(executionContext, LegacyUnbatchedContext);

	const [ok, result] = __YOLO__ ? ([true, fn(a)] as const) : xpcall(fn, describeError, a);

	// finally
	executionContext = prevExecutionContext;
	if (executionContext === NoContext) {
		resetRenderTimer();
		flushSyncCallbackQueue();
	}

	if (ok) {
		return result;
	}
	error(result);
}

export function flushSync<A, R>(fn: ((a: A) => R) | undefined, a: A): R {
	const prevExecutionContext = executionContext;
	if (bit32.band(prevExecutionContext, bit32.bor(RenderContext, CommitContext)) !== NoContext) {
		if (__DEV__) {
			console.error(
				'flushSync was called from inside a lifecycle method. React cannot ' +
					'flush when React is already rendering. Consider moving this call to ' +
					'a scheduler task or micro task.'
			);
		}
		return (fn as (a: A) => R)(a);
	}
	executionContext = bit32.bor(executionContext, BatchedContext);

	const previousLanePriority = decoupleUpdatePriorityFromScheduler
		? ReactFiberLane.getCurrentUpdateLanePriority()
		: undefined;
	if (decoupleUpdatePriorityFromScheduler) {
		ReactFiberLane.setCurrentUpdateLanePriority(ReactFiberLane.SyncLanePriority);
	}

	let result: R;
	let ok = true;
	if (fn) {
		const [okLocal, resultLocal] = __YOLO__
			? ([true, runWithPriority(ImmediatePriority, () => fn(a))] as const)
			: xpcall(runWithPriority, describeError, ImmediatePriority, () => fn(a));
		ok = okLocal;
		result = resultLocal as R;
	} else {
		result = undefined as any;
	}

	// finally
	if (decoupleUpdatePriorityFromScheduler && previousLanePriority !== undefined) {
		ReactFiberLane.setCurrentUpdateLanePriority(previousLanePriority);
	}
	executionContext = prevExecutionContext;
	// Flush the immediate callbacks that were scheduled during this batch.
	flushSyncCallbackQueue();

	if (!ok) {
		error(result);
	}
	return result;
}

export function flushControlled(fn: () => any): void {
	const prevExecutionContext = executionContext;
	executionContext = bit32.bor(executionContext, BatchedContext);

	const previousLanePriority = decoupleUpdatePriorityFromScheduler
		? ReactFiberLane.getCurrentUpdateLanePriority()
		: undefined;
	if (decoupleUpdatePriorityFromScheduler) {
		ReactFiberLane.setCurrentUpdateLanePriority(ReactFiberLane.SyncLanePriority);
	}

	const [ok, result] = xpcall(runWithPriority, describeError, ImmediatePriority, fn);

	// finally
	if (decoupleUpdatePriorityFromScheduler && previousLanePriority !== undefined) {
		ReactFiberLane.setCurrentUpdateLanePriority(previousLanePriority);
	}
	executionContext = prevExecutionContext;
	if (executionContext === NoContext) {
		resetRenderTimer();
		flushSyncCallbackQueue();
	}

	if (!ok) {
		error(result);
	}
}

// Render lanes stack

export function pushRenderLanes(fiber: Fiber, lanes: Lanes): void {
	ReactFiberStack.push(subtreeRenderLanesCursor, subtreeRenderLanes, fiber);
	subtreeRenderLanes = ReactFiberLane.mergeLanes(subtreeRenderLanes, lanes);
	workInProgressRootIncludedLanes = ReactFiberLane.mergeLanes(workInProgressRootIncludedLanes, lanes);
}

export function popRenderLanes(fiber: Fiber): void {
	subtreeRenderLanes = subtreeRenderLanesCursor.current;
	ReactFiberStack.pop(subtreeRenderLanesCursor, fiber);
}

function prepareFreshStack(root: FiberRoot, lanes: Lanes): void {
	root.finishedWork = undefined;
	root.finishedLanes = ReactFiberLane.NoLanes;

	const timeoutHandle = root.timeoutHandle;
	if (timeoutHandle !== HostConfig.noTimeout) {
		// The root previously suspended and scheduled a timeout to commit a
		// fallback state. Now that we have additional work, cancel the timeout.
		root.timeoutHandle = HostConfig.noTimeout;
		HostConfig.cancelTimeout(timeoutHandle);
	}

	if (workInProgress !== undefined) {
		let interruptedWork = workInProgress.return_;
		while (interruptedWork !== undefined) {
			ReactFiberUnwindWork.unwindInterruptedWork(interruptedWork);
			interruptedWork = interruptedWork.return_;
		}
	}
	workInProgressRoot = root;
	workInProgress = ReactFiber.createWorkInProgress(root.current, undefined);
	workInProgressRootRenderLanes = lanes;
	subtreeRenderLanes = lanes;
	workInProgressRootIncludedLanes = lanes;
	workInProgressRootExitStatus = RootExitStatus.Incomplete;
	workInProgressRootFatalError = undefined;
	workInProgressRootSkippedLanes(ReactFiberLane.NoLanes);
	workInProgressRootUpdatedLanes = ReactFiberLane.NoLanes;
	workInProgressRootPingedLanes = ReactFiberLane.NoLanes;

	if (enableSchedulerTracing) {
		spawnedWorkDuringRender = undefined;
	}

	if (__DEV__) {
		ReactStrictModeWarnings.discardPendingWarnings();
	}
}

function handleError(root: FiberRoot, thrownValue: unknown): void {
	while (true) {
		let erroredWork = workInProgress;

		// Reset module-level state that was set during the render phase.
		resetContextDependencies();
		resetHooksAfterThrow();
		resetCurrentDebugFiberInDEV();
		// TODO: I found and added this missing line while investigating a
		// separate issue. Write a regression test using string refs.
		ReactCurrentOwner.current = undefined;

		if (erroredWork === undefined || erroredWork.return_ === undefined) {
			// Expected to be working on a non-root fiber. This is a fatal error
			// because there's no ancestor that can handle it; the root is
			// supposed to capture all errors that weren't caught by an error
			// boundary.
			workInProgressRootExitStatus = RootExitStatus.FatalErrored;
			workInProgressRootFatalError = thrownValue;
			// Set `workInProgress` to undefined. This represents advancing to the
			// next sibling, or the parent if there are no siblings. But since the
			// root has no siblings nor a parent, we set it to undefined. Usually
			// this is handled by `completeUnitOfWork` or `unwindWork`, but since
			// we're intentionally not calling those, we need set it here.
			workInProgress = undefined;
			return;
		}

		if (
			enableProfilerTimer &&
			bit32.band(erroredWork.mode, ReactTypeOfMode.ProfileMode) !== ReactTypeOfMode.NoMode
		) {
			// Record the time spent rendering before an error was thrown. This
			// avoids inaccurate Profiler durations in the case of a suspended
			// render.
			ReactProfilerTimer.stopProfilerTimerIfRunningAndRecordDelta(erroredWork, true);
		}

		// We pass `onUncaughtError` and `renderDidError` here because
		// `throwException` can't call them directly due to a module cycle.
		// Capture the narrowed fiber so the closure below sees a non-nil value
		// (TypeScript resets narrowing for mutable `let` bindings captured by
		// closures).
		const erroredFiber: Fiber = erroredWork;
		const [ok, yetAnotherThrownValue] = xpcall(() => {
			throwException(
				root,
				erroredFiber.return_!,
				erroredFiber,
				thrownValue,
				workInProgressRootRenderLanes,
				onUncaughtError,
				renderDidError
			);
			completeUnitOfWork(erroredFiber);
		}, describeError);

		if (!ok) {
			// Something in the return path also threw.
			thrownValue = yetAnotherThrownValue;
			if (workInProgress === erroredWork && erroredWork !== undefined) {
				// If this boundary has already errored, then we had trouble
				// processing the error. Bubble it to the next boundary.
				erroredWork = erroredWork.return_!;
				workInProgress = erroredWork;
			} else {
				erroredWork = workInProgress;
			}
			continue;
		}
		// Return to the normal work loop.
		return;
	}
}

function pushDispatcher(): Dispatcher | undefined {
	const prevDispatcher = ReactCurrentDispatcher.current;

	// We lazily load the ContextOnlyDispatcher and wrap it in a getter to
	// match the Lua module's lazy-init convention.
	ReactCurrentDispatcher.current = getContextOnlyDispatcher();
	if (prevDispatcher === undefined) {
		// The React isomorphic package does not include a default dispatcher.
		// Instead the first renderer will lazily attach one, in order to give
		// nicer error messages.
		return getContextOnlyDispatcher();
	}
	return prevDispatcher;
}

function popDispatcher(prevDispatcher: Dispatcher | undefined): void {
	ReactCurrentDispatcher.current = prevDispatcher;
}

function pushInteractions(root: FiberRoot): Set<Interaction> | undefined {
	if (enableSchedulerTracing) {
		const interactionsRef = __interactionsRef!;
		const prevInteractions = interactionsRef.current;
		interactionsRef.current = root.memoizedInteractions;
		return prevInteractions;
	}
	return undefined;
}

function popInteractions(prevInteractions: Set<Interaction> | undefined): void {
	if (enableSchedulerTracing) {
		__interactionsRef!.current = prevInteractions!;
	}
}

export function markCommitTimeOfFallback(): void {
	globalMostRecentFallbackTime = now();
}

export function markSkippedUpdateLanes(lane: Lane | Lanes): void {
	ReactFiberWorkInProgress.markSkippedUpdateLanes(lane);
}

export function renderDidSuspend(): void {
	if (workInProgressRootExitStatus === RootExitStatus.Incomplete) {
		workInProgressRootExitStatus = RootExitStatus.Suspended;
	}
}

export function renderDidSuspendDelayIfPossible(): void {
	if (
		workInProgressRootExitStatus === RootExitStatus.Incomplete ||
		workInProgressRootExitStatus === RootExitStatus.Suspended
	) {
		workInProgressRootExitStatus = RootExitStatus.SuspendedWithDelay;
	}

	// Check if there are updates that we skipped in the tree that might have
	// unblocked this render.
	if (
		workInProgressRoot !== undefined &&
		(ReactFiberLane.includesNonIdleWork(workInProgressRootSkippedLanes()) ||
			ReactFiberLane.includesNonIdleWork(workInProgressRootUpdatedLanes))
	) {
		// Mark the current render as suspended so that we switch to working on
		// the updates that were skipped.
		markRootSuspended(workInProgressRoot, workInProgressRootRenderLanes);
	}
}

export function renderDidError(): void {
	if (workInProgressRootExitStatus !== RootExitStatus.Completed) {
		workInProgressRootExitStatus = RootExitStatus.Errored;
	}
}

// Called during render to determine if anything has suspended.
// Returns false if we're not sure.
export function renderHasNotSuspendedYet(): boolean {
	// If something errored or completed, we can't really be sure,
	// so those are false.
	return workInProgressRootExitStatus === RootExitStatus.Incomplete;
}

function renderRootSync(root: FiberRoot, lanes: Lanes): number {
	const prevExecutionContext = executionContext;
	executionContext = bit32.bor(executionContext, RenderContext);
	const prevDispatcher = pushDispatcher();

	// If the root or lanes have changed, throw out the existing stack and
	// prepare a fresh one. Otherwise we'll continue where we left off.
	if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
		prepareFreshStack(root, lanes);
		startWorkOnPendingInteractions(root, lanes);
	}

	const prevInteractions = pushInteractions(root);

	if (__DEV__) {
		if (enableDebugTracing) {
			DebugTracing.logRenderStarted(lanes);
		}
	}

	if (enableSchedulingProfiler) {
		SchedulingProfiler.markRenderStarted(lanes);
	}

	while (true) {
		let ok: boolean;
		let thrownValue: unknown;
		if (!__YOLO__) {
			[ok, thrownValue] = xpcall(workLoopSync, describeError);
		} else {
			ok = true;
			workLoopSync();
		}

		if (!ok) {
			handleError(root, thrownValue);
		} else {
			break;
		}
	}
	resetContextDependencies();
	if (enableSchedulerTracing) {
		popInteractions(prevInteractions);
	}

	executionContext = prevExecutionContext;
	popDispatcher(prevDispatcher);

	if (workInProgress !== undefined) {
		// This is a sync render, so we should have finished the whole tree.
		invariant(
			false,
			'Cannot commit an incomplete root. This error is likely caused by a ' +
				'bug in React. Please file an issue.'
		);
	}

	if (__DEV__) {
		if (enableDebugTracing) {
			DebugTracing.logRenderStopped();
		}
	}

	if (enableSchedulingProfiler) {
		SchedulingProfiler.markRenderStopped();
	}

	// Set this to undefined to indicate there's no in-progress render.
	workInProgressRoot = undefined;
	workInProgressRootRenderLanes = ReactFiberLane.NoLanes;

	return workInProgressRootExitStatus;
}

// The work loop is an extremely hot path.
function workLoopSync(): void {
	// Already timed out, so perform work without checking if we need to yield.
	while (workInProgress !== undefined) {
		performUnitOfWork(workInProgress);
	}
}

function renderRootConcurrent(root: FiberRoot, lanes: Lanes): number {
	const prevExecutionContext = executionContext;
	executionContext = bit32.bor(executionContext, RenderContext);
	const prevDispatcher = pushDispatcher();

	// If the root or lanes have changed, throw out the existing stack and
	// prepare a fresh one. Otherwise we'll continue where we left off.
	if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
		resetRenderTimer();
		prepareFreshStack(root, lanes);
		startWorkOnPendingInteractions(root, lanes);
	}

	const prevInteractions = pushInteractions(root);

	if (__DEV__) {
		if (enableDebugTracing) {
			DebugTracing.logRenderStarted(lanes);
		}
	}

	if (enableSchedulingProfiler) {
		SchedulingProfiler.markRenderStarted(lanes);
	}

	while (true) {
		let ok: boolean;
		let thrownValue: unknown;
		if (!__YOLO__) {
			// The `"break"` sentinel mirrors the Lua port's workaround for `break`
			// not being available inside a `pcall`.
			[ok, thrownValue] = xpcall(workLoopConcurrent, describeError);
			if (ok) {
				thrownValue = 'break';
			}
		} else {
			ok = true;
			thrownValue = 'break';
			workLoopConcurrent();
		}

		if (thrownValue === 'break') {
			break;
		}
		if (!ok) {
			handleError(root, thrownValue);
		}
	}
	resetContextDependencies();
	if (enableSchedulerTracing) {
		popInteractions(prevInteractions);
	}

	popDispatcher(prevDispatcher);
	executionContext = prevExecutionContext;

	if (__DEV__) {
		if (enableDebugTracing) {
			DebugTracing.logRenderStopped();
		}
	}

	// Check if the tree has completed.
	if (workInProgress !== undefined) {
		// Still work remaining.
		if (enableSchedulingProfiler) {
			SchedulingProfiler.markRenderYielded();
		}
		return RootExitStatus.Incomplete;
	} else {
		// Completed the tree.
		if (enableSchedulingProfiler) {
			SchedulingProfiler.markRenderStopped();
		}

		// Set this to undefined to indicate there's no in-progress render.
		workInProgressRoot = undefined;
		workInProgressRootRenderLanes = ReactFiberLane.NoLanes;

		// Return the final exit status.
		return workInProgressRootExitStatus;
	}
}

function workLoopConcurrent(): void {
	// Perform work until Scheduler asks us to yield.
	while (workInProgress !== undefined && !shouldYield()) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(unitOfWork: Fiber): void {
	// RobloxReactProfiling measures the time spent on each fiber.
	const profileRunning = RobloxReactProfiling.profileUnitOfWorkBefore(unitOfWork);

	// The current, flushed state of this fiber is the alternate.
	const current = unitOfWork.alternate;
	setCurrentDebugFiberInDEV(unitOfWork);

	let nextFiber: Fiber | undefined;
	if (enableProfilerTimer && bit32.band(unitOfWork.mode, ReactTypeOfMode.ProfileMode) !== ReactTypeOfMode.NoMode) {
		ReactProfilerTimer.startProfilerTimer(unitOfWork);
		nextFiber = beginWork(current, unitOfWork, subtreeRenderLanes);
		ReactProfilerTimer.stopProfilerTimerIfRunningAndRecordDelta(unitOfWork, true);
	} else {
		nextFiber = beginWork(current, unitOfWork, subtreeRenderLanes);
	}

	resetCurrentDebugFiberInDEV();
	unitOfWork.memoizedProps = unitOfWork.pendingProps;
	if (nextFiber === undefined) {
		// If this doesn't spawn new work, complete the current work.
		completeUnitOfWork(unitOfWork);
	} else {
		workInProgress = nextFiber;
	}

	ReactCurrentOwner.current = undefined;

	RobloxReactProfiling.profileUnitOfWorkAfter(profileRunning);
}

function completeUnitOfWork(unitOfWork: Fiber): void {
	// Attempt to complete the current unit of work, then move to the next
	// sibling. If there are no more siblings, return to the parent fiber.
	let completedWork: Fiber | undefined = unitOfWork;
	do {
		// The current, flushed state of this fiber is the alternate.
		const current = completedWork.alternate;
		const returnFiber: Fiber | undefined = completedWork.return_;

		// Check if the work completed or if something threw.
		if (bit32.band(completedWork.flags, ReactFiberFlags.Incomplete) === ReactFiberFlags.NoFlags) {
			setCurrentDebugFiberInDEV(completedWork);
			let nextFiber: Fiber | undefined;
			if (
				!enableProfilerTimer ||
				bit32.band(completedWork.mode, ReactTypeOfMode.ProfileMode) === ReactTypeOfMode.NoMode
			) {
				nextFiber = completeWork(current, completedWork, subtreeRenderLanes);
			} else {
				ReactProfilerTimer.startProfilerTimer(completedWork);
				nextFiber = completeWork(current, completedWork, subtreeRenderLanes);
				// Update render duration assuming we didn't error.
				ReactProfilerTimer.stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);
			}
			resetCurrentDebugFiberInDEV();

			if (nextFiber !== undefined) {
				// Completing this fiber spawned new work. Work on that next.
				workInProgress = nextFiber;
				return;
			}
		} else {
			// This fiber did not complete because something threw. Pop values off
			// the stack without entering the complete phase. If this is a boundary,
			// capture values if possible.
			const nextFiber = ReactFiberUnwindWork.unwindWork(completedWork, subtreeRenderLanes);

			// Because this fiber did not complete, don't reset its expiration time.

			if (nextFiber !== undefined) {
				// If completing this work spawned new work, do that next. We'll
				// come back here again.
				// Since we're restarting, remove anything that is not a host effect
				// from the effect tag.
				nextFiber.flags = bit32.band(nextFiber.flags, ReactFiberFlags.HostEffectMask);
				workInProgress = nextFiber;
				return;
			}

			if (
				enableProfilerTimer &&
				bit32.band(completedWork.mode, ReactTypeOfMode.ProfileMode) !== ReactTypeOfMode.NoMode
			) {
				// Record the render duration for the fiber that errored.
				ReactProfilerTimer.stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);

				// Include the time spent working on failed children before continuing.
				let actualDuration = completedWork.actualDuration ?? 0;
				let child = completedWork.child;
				while (child !== undefined) {
					actualDuration += child.actualDuration ?? 0;
					child = child.sibling;
				}
				completedWork.actualDuration = actualDuration;
			}

			if (returnFiber !== undefined) {
				// Mark the parent fiber as incomplete.
				returnFiber.flags = bit32.bor(returnFiber.flags, ReactFiberFlags.Incomplete);
				returnFiber.subtreeFlags = ReactFiberFlags.NoFlags;
				returnFiber.deletions = undefined;
			}
		}

		const siblingFiber = completedWork.sibling;
		if (siblingFiber !== undefined) {
			// If there is more work to do in this returnFiber, do that next.
			workInProgress = siblingFiber;
			return;
		}
		// Otherwise, return to the parent.
		completedWork = returnFiber;
		// Update the next thing we're working on in case something throws.
		workInProgress = completedWork;
	} while (completedWork !== undefined);

	// We've reached the root.
	if (workInProgressRootExitStatus === RootExitStatus.Incomplete) {
		workInProgressRootExitStatus = RootExitStatus.Completed;
	}
}

// Commit phase

export function commitRoot(root: FiberRoot): void {
	const renderPriorityLevel = getCurrentPriorityLevel();
	runWithPriority(ImmediatePriority, () => {
		RobloxReactProfiling.profileCommitBefore();
		const ret = commitRootImpl(root, renderPriorityLevel);
		RobloxReactProfiling.profileCommitAfter();
		return ret;
	});
}

function commitRootImpl(root: FiberRoot, renderPriorityLevel: ReactPriorityLevel): void {
	do {
		// `flushPassiveEffects` will call `flushSyncUpdateQueue` at the end, which
		// means `flushPassiveEffects` will sometimes result in additional
		// passive effects. So we need to keep flushing in a loop until there are
		// no more pending effects.
		flushPassiveEffects();
	} while (rootWithPendingPassiveEffects !== undefined);
	flushRenderPhaseStrictModeWarningsInDEV();

	invariant(
		bit32.band(executionContext, bit32.bor(RenderContext, CommitContext)) === NoContext,
		'Should not already be working.'
	);

	const finishedWork = root.finishedWork;
	const lanes = root.finishedLanes;

	if (__DEV__) {
		if (enableDebugTracing) {
			DebugTracing.logCommitStarted(lanes);
		}
	}

	if (enableSchedulingProfiler) {
		SchedulingProfiler.markCommitStarted(lanes);
	}

	if (finishedWork === undefined) {
		if (__DEV__) {
			if (enableDebugTracing) {
				DebugTracing.logCommitStopped();
			}
		}

		if (enableSchedulingProfiler) {
			SchedulingProfiler.markCommitStopped(root);
		}

		return;
	}
	root.finishedWork = undefined;
	root.finishedLanes = ReactFiberLane.NoLanes;

	invariant(
		finishedWork !== root.current,
		'Cannot commit the same tree as before. This error is likely caused by ' +
			'a bug in React. Please file an issue.'
	);

	// commitRoot never returns a continuation; it always finishes synchronously.
	// So we can clear these now to allow a new callback to be scheduled.
	root.callbackNode = undefined;

	// Update the first and last pending times on this root. The new first
	// pending time is whatever is left on the root fiber.
	let remainingLanes = ReactFiberLane.mergeLanes(finishedWork.lanes, finishedWork.childLanes);
	ReactFiberLane.markRootFinished(root, remainingLanes);

	// Clear already finished discrete updates in case that a later call of
	// `flushDiscreteUpdates` starts a useless render pass which may cancels
	// a scheduled timeout.
	if (rootsWithPendingDiscreteUpdates !== undefined) {
		if (!ReactFiberLane.hasDiscreteLanes(remainingLanes) && rootsWithPendingDiscreteUpdates.has(root)) {
			rootsWithPendingDiscreteUpdates.delete(root);
		}
	}

	if (root === workInProgressRoot) {
		// We can reset these now that they are finished.
		workInProgressRoot = undefined;
		workInProgress = undefined;
		workInProgressRootRenderLanes = ReactFiberLane.NoLanes;
	}

	// Check if there are any effects in the whole tree.
	const subtreeHasEffects =
		bit32.band(
			finishedWork.subtreeFlags,
			bit32.bor(
				ReactFiberFlags.BeforeMutationMask,
				ReactFiberFlags.MutationMask,
				ReactFiberFlags.LayoutMask,
				ReactFiberFlags.PassiveMask
			)
		) !== ReactFiberFlags.NoFlags;
	const rootHasEffect =
		bit32.band(
			finishedWork.flags,
			bit32.bor(
				ReactFiberFlags.BeforeMutationMask,
				ReactFiberFlags.MutationMask,
				ReactFiberFlags.LayoutMask,
				ReactFiberFlags.PassiveMask
			)
		) !== ReactFiberFlags.NoFlags;

	if (subtreeHasEffects || rootHasEffect) {
		let previousLanePriority: number | undefined;
		if (decoupleUpdatePriorityFromScheduler) {
			previousLanePriority = ReactFiberLane.getCurrentUpdateLanePriority();
			ReactFiberLane.setCurrentUpdateLanePriority(ReactFiberLane.SyncLanePriority);
		}

		const prevExecutionContext = executionContext;
		executionContext = bit32.bor(executionContext, CommitContext);
		const prevInteractions = pushInteractions(root);

		// Reset this to undefined before calling lifecycles.
		ReactCurrentOwner.current = undefined;

		// The first phase is the "before mutation" phase. We use this phase to
		// read the state of the host tree right before we mutate it. This is
		// where getSnapshotBeforeUpdate is called.
		focusedInstanceHandle = HostConfig.prepareForCommit(root.containerInfo) as Fiber | undefined;
		shouldFireAfterActiveInstanceBlur = false;

		commitBeforeMutationEffects(finishedWork);

		// We no longer need to track the active instance fiber.
		focusedInstanceHandle = undefined;

		if (enableProfilerTimer) {
			// Mark the current commit time to be shared by all Profilers in this
			// batch. This enables them to be grouped later.
			ReactProfilerTimer.recordCommitTime();
		}

		// The next phase is the mutation phase, where we mutate the host tree.
		commitMutationEffects(finishedWork, root, renderPriorityLevel);

		if (shouldFireAfterActiveInstanceBlur) {
			HostConfig.afterActiveInstanceBlur?.();
		}
		HostConfig.resetAfterCommit(root.containerInfo);

		// The work-in-progress tree is now the current tree. This must come after
		// the mutation phase, so that the previous tree is still current during
		// componentWillUnmount, but before the layout phase, so that the finished
		// work is current during componentDidMount/Update.
		root.current = finishedWork;

		// The next phase is the layout phase, where we call effects that read
		// the host tree after it's been mutated.
		if (__DEV__) {
			if (enableDebugTracing) {
				DebugTracing.logLayoutEffectsStarted(lanes);
			}
		}
		if (enableSchedulingProfiler) {
			SchedulingProfiler.markLayoutEffectsStarted(lanes);
		}

		if (__DEV__) {
			setCurrentDebugFiberInDEV(finishedWork);
			invokeGuardedCallback(
				undefined,
				recursivelyCommitLayoutEffects,
				undefined,
				finishedWork,
				root,
				captureCommitPhaseError,
				schedulePassiveEffectCallback
			);
			if (hasCaughtError()) {
				const error_ = clearCaughtError();
				captureCommitPhaseErrorOnRoot(finishedWork, finishedWork, error_);
			}
			resetCurrentDebugFiberInDEV();
		} else {
			let ok: boolean;
			let result: unknown;
			if (!__YOLO__) {
				[ok, result] = xpcall(
					recursivelyCommitLayoutEffects,
					describeError,
					finishedWork,
					root,
					captureCommitPhaseError,
					schedulePassiveEffectCallback
				);
			} else {
				ok = true;
				recursivelyCommitLayoutEffects(
					finishedWork,
					root,
					captureCommitPhaseError,
					schedulePassiveEffectCallback
				);
			}

			if (!ok) {
				captureCommitPhaseErrorOnRoot(finishedWork, finishedWork, result);
			}
		}

		if (__DEV__) {
			if (enableDebugTracing) {
				DebugTracing.logLayoutEffectsStopped();
			}
		}
		if (enableSchedulingProfiler) {
			SchedulingProfiler.markLayoutEffectsStopped();
		}

		// If there are pending passive effects, schedule a callback to process them.
		if (
			bit32.band(finishedWork.subtreeFlags, ReactFiberFlags.PassiveMask) !== ReactFiberFlags.NoFlags ||
			bit32.band(finishedWork.flags, ReactFiberFlags.PassiveMask) !== ReactFiberFlags.NoFlags
		) {
			if (!rootDoesHavePassiveEffects) {
				rootDoesHavePassiveEffects = true;
				scheduleCallback(NormalPriority, () => {
					flushPassiveEffects();
				});
			}
		}

		// Tell the host to yield at the end of the frame, so it has an
		// opportunity to paint.
		requestPaint();

		if (enableSchedulerTracing) {
			popInteractions(prevInteractions);
		}
		executionContext = prevExecutionContext;

		if (decoupleUpdatePriorityFromScheduler && previousLanePriority !== undefined) {
			// Reset the priority to the previous non-sync value.
			ReactFiberLane.setCurrentUpdateLanePriority(previousLanePriority);
		}
	} else {
		// No effects.
		root.current = finishedWork;
		if (enableProfilerTimer) {
			ReactProfilerTimer.recordCommitTime();
		}
	}

	const rootDidHavePassiveEffects = rootDoesHavePassiveEffects;

	if (rootDoesHavePassiveEffects) {
		// This commit has passive effects. Stash a reference to them. But don't
		// schedule a callback until after flushing layout work.
		rootDoesHavePassiveEffects = false;
		rootWithPendingPassiveEffects = root;
		pendingPassiveEffectsLanes = lanes;
		pendingPassiveEffectsRenderPriority = renderPriorityLevel;
	}

	// Read this again, since an effect might have updated it.
	remainingLanes = root.pendingLanes;

	// Check if there's remaining work on this root.
	if (remainingLanes !== ReactFiberLane.NoLanes) {
		if (enableSchedulerTracing) {
			if (spawnedWorkDuringRender !== undefined) {
				const expirationTimes = spawnedWorkDuringRender;
				spawnedWorkDuringRender = undefined;
				for (const expirationTime of expirationTimes) {
					scheduleInteractions(root, expirationTime, root.memoizedInteractions);
				}
			}
			schedulePendingInteractions(root, remainingLanes);
		}
	} else {
		// If there's no remaining work, we can clear the set of already failed
		// error boundaries.
		legacyErrorBoundariesThatAlreadyFailed = undefined;
	}

	if (__DEV__ && enableDoubleInvokingEffects) {
		if (!rootDidHavePassiveEffects) {
			commitDoubleInvokeEffectsInDEV(root.current, false);
		}
	}

	if (enableSchedulerTracing) {
		if (!rootDidHavePassiveEffects) {
			// If there are no passive effects, then we can complete the pending
			// interactions. Otherwise, we'll wait until after the passive effects
			// are flushed.
			finishPendingInteractions(root, lanes);
		}
	}

	if (remainingLanes === ReactFiberLane.SyncLane) {
		// Count the number of times the root synchronously re-renders without
		// finishing. If there are too many, it indicates an infinite update loop.
		if (root === rootWithNestedUpdates) {
			nestedUpdateCount += 1;
		} else {
			nestedUpdateCount = 0;
			rootWithNestedUpdates = root;
		}
	} else {
		nestedUpdateCount = 0;
	}

	onCommitRootDevTools(finishedWork.stateNode, renderPriorityLevel);

	if (__DEV__) {
		onCommitRootTestSelector();
	}

	// Always call this before exiting `commitRoot`, to ensure that any
	// additional work on this root is scheduled.
	ensureRootIsScheduled(root, now());

	if (hasUncaughtError) {
		hasUncaughtError = false;
		const error_ = firstUncaughtError;
		firstUncaughtError = undefined;
		error(error_);
	}

	if (bit32.band(executionContext, LegacyUnbatchedContext) !== NoContext) {
		if (__DEV__) {
			if (enableDebugTracing) {
				DebugTracing.logCommitStopped();
			}
		}

		if (enableSchedulingProfiler) {
			SchedulingProfiler.markCommitStopped(root);
		}

		// This is a legacy edge case. We just committed the initial mount of
		// a ReactDOM.render-ed root inside of batchedUpdates. The commit fired
		// synchronously, but layout updates should be deferred until the end
		// of the batch.
		return;
	}

	// If layout work was scheduled, flush it now.
	flushSyncCallbackQueue();

	if (__DEV__) {
		if (enableDebugTracing) {
			DebugTracing.logCommitStopped();
		}
	}

	if (enableSchedulingProfiler) {
		SchedulingProfiler.markCommitStopped(root);
	}
}

function commitBeforeMutationEffects(firstChild: Fiber): void {
	let fiber: Fiber | undefined = firstChild;
	while (fiber !== undefined) {
		if (fiber.deletions !== undefined) {
			commitBeforeMutationEffectsDeletions(fiber.deletions);
		}

		if (fiber.child !== undefined) {
			const primarySubtreeFlags = bit32.band(fiber.subtreeFlags, ReactFiberFlags.BeforeMutationMask);
			if (primarySubtreeFlags !== ReactFiberFlags.NoFlags) {
				commitBeforeMutationEffects(fiber.child);
			}
		}

		if (__DEV__) {
			setCurrentDebugFiberInDEV(fiber);
			invokeGuardedCallback(undefined, commitBeforeMutationEffectsImpl, undefined, fiber);
			if (hasCaughtError()) {
				const error_ = clearCaughtError();
				captureCommitPhaseError(fiber, fiber.return_, error_);
			}
			resetCurrentDebugFiberInDEV();
		} else {
			let ok: boolean;
			let error_: unknown;
			if (!__YOLO__) {
				[ok, error_] = xpcall(commitBeforeMutationEffectsImpl, describeError, fiber);
			} else {
				ok = true;
				commitBeforeMutationEffectsImpl(fiber);
			}

			if (!ok) {
				captureCommitPhaseError(fiber, fiber.return_, error_);
			}
		}
		fiber = fiber.sibling;
	}
}

function commitBeforeMutationEffectsImpl(fiber: Fiber): void {
	const current = fiber.alternate;
	const flags = fiber.flags;

	if (!shouldFireAfterActiveInstanceBlur && focusedInstanceHandle !== undefined) {
		// Check to see if the focused element was inside of a hidden (Suspense)
		// subtree.
		if (
			fiber.tag === ReactWorkTags.SuspenseComponent &&
			isSuspenseBoundaryBeingHidden(current, fiber) &&
			doesFiberContain(fiber, focusedInstanceHandle)
		) {
			shouldFireAfterActiveInstanceBlur = true;
			HostConfig.beforeActiveInstanceBlur?.();
		}
	}

	if (bit32.band(flags, ReactFiberFlags.Snapshot) !== ReactFiberFlags.NoFlags) {
		setCurrentDebugFiberInDEV(fiber);
		commitBeforeMutationLifeCycles(current, fiber);
		resetCurrentDebugFiberInDEV();
	}

	if (bit32.band(flags, ReactFiberFlags.Passive) !== ReactFiberFlags.NoFlags) {
		// If there are passive effects, schedule a callback to flush at the
		// earliest opportunity.
		if (!rootDoesHavePassiveEffects) {
			rootDoesHavePassiveEffects = true;
			scheduleCallback(NormalPriority, () => {
				flushPassiveEffects();
			});
		}
	}
}

function commitBeforeMutationEffectsDeletions(deletions: Fiber[]): void {
	for (const fiber of deletions) {
		if (doesFiberContain(fiber, focusedInstanceHandle as Fiber)) {
			shouldFireAfterActiveInstanceBlur = true;
			HostConfig.beforeActiveInstanceBlur?.();
		}
	}
}

function commitMutationEffects(firstChild: Fiber, root: FiberRoot, renderPriorityLevel: ReactPriorityLevel): void {
	let fiber: Fiber | undefined = firstChild;
	while (fiber !== undefined) {
		const deletions = fiber.deletions;
		if (deletions !== undefined) {
			for (const childToDelete of deletions) {
				const [ok, error_] = xpcall(
					commitDeletion,
					describeError,
					root,
					childToDelete,
					fiber,
					renderPriorityLevel
				);
				if (!ok) {
					captureCommitPhaseError(childToDelete, fiber, error_);
				}
			}
		}

		if (fiber.child !== undefined) {
			const mutationFlags = bit32.band(fiber.subtreeFlags, ReactFiberFlags.MutationMask);
			if (mutationFlags !== ReactFiberFlags.NoFlags) {
				commitMutationEffects(fiber.child, root, renderPriorityLevel);
			}
		}

		if (__DEV__) {
			setCurrentDebugFiberInDEV(fiber);
			invokeGuardedCallback(undefined, commitMutationEffectsImpl, undefined, fiber, root, renderPriorityLevel);
			if (hasCaughtError()) {
				const error_ = clearCaughtError();
				captureCommitPhaseError(fiber, fiber.return_, error_);
			}
			resetCurrentDebugFiberInDEV();
		} else {
			let ok: boolean;
			let result: unknown;
			if (!__YOLO__) {
				[ok, result] = xpcall(commitMutationEffectsImpl, describeError, fiber, root, renderPriorityLevel);
			} else {
				ok = true;
				commitMutationEffectsImpl(fiber, root, renderPriorityLevel);
			}
			if (!ok) {
				captureCommitPhaseError(fiber, fiber.return_, result);
			}
		}
		fiber = fiber.sibling;
	}
}

function commitMutationEffectsImpl(fiber: Fiber, _root: FiberRoot, _renderPriorityLevel: ReactPriorityLevel): void {
	const flags = fiber.flags;

	if (bit32.band(flags, ReactFiberFlags.Ref) !== 0) {
		const current = fiber.alternate;
		if (current !== undefined) {
			commitDetachRef(current);
		}
	}

	// The following switch statement is only concerned about placement,
	// updates, and deletions. To avoid needing to add a case for every possible
	// bitmap value, we remove the secondary effects from the effect tag and
	// switch on that value.
	const primaryFlags = bit32.band(
		flags,
		bit32.bor(ReactFiberFlags.Placement, ReactFiberFlags.Update, ReactFiberFlags.Hydrating)
	);
	if (primaryFlags === ReactFiberFlags.Placement) {
		commitPlacement(fiber);
		// Clear the "placement" from effect tag so that we know that this is
		// inserted, before any life-cycles like componentDidMount gets called.
		fiber.flags = bit32.band(fiber.flags, bit32.bnot(ReactFiberFlags.Placement));
	} else if (primaryFlags === ReactFiberFlags.PlacementAndUpdate) {
		// Placement.
		commitPlacement(fiber);
		fiber.flags = bit32.band(fiber.flags, bit32.bnot(ReactFiberFlags.Placement));

		// Update.
		const current = fiber.alternate;
		commitWork(current, fiber);
	} else if (primaryFlags === ReactFiberFlags.Update) {
		const current = fiber.alternate;
		commitWork(current, fiber);
	}
}

// Passive effects

export function schedulePassiveEffectCallback(): void {
	if (!rootDoesHavePassiveEffects) {
		rootDoesHavePassiveEffects = true;
		scheduleCallback(NormalPriority, () => {
			flushPassiveEffects();
		});
	}
}

function flushPassiveEffectsImpl(): boolean {
	if (rootWithPendingPassiveEffects === undefined) {
		return false;
	}

	const root = rootWithPendingPassiveEffects;
	const lanes = pendingPassiveEffectsLanes;
	rootWithPendingPassiveEffects = undefined;
	pendingPassiveEffectsLanes = ReactFiberLane.NoLanes;

	invariant(
		bit32.band(executionContext, bit32.bor(RenderContext, CommitContext)) === NoContext,
		'Cannot flush passive effects while already rendering.'
	);

	if (__DEV__) {
		if (enableDebugTracing) {
			DebugTracing.logPassiveEffectsStarted(lanes);
		}
	}

	if (enableSchedulingProfiler) {
		SchedulingProfiler.markPassiveEffectsStarted(lanes);
	}

	const prevExecutionContext = executionContext;
	executionContext = bit32.bor(executionContext, CommitContext);
	const prevInteractions = pushInteractions(root);

	// It's important that ALL pending passive effect destroy functions are called
	// before ANY passive effect create functions are called.
	// Otherwise effects in sibling components might interfere with each other.
	flushPassiveUnmountEffects(root.current);
	flushPassiveMountEffects(root, root.current);

	if (__DEV__) {
		if (enableDebugTracing) {
			DebugTracing.logPassiveEffectsStopped();
		}
	}

	if (enableSchedulingProfiler) {
		SchedulingProfiler.markPassiveEffectsStopped(root);
	}

	if (__DEV__ && enableDoubleInvokingEffects) {
		commitDoubleInvokeEffectsInDEV(root.current, true);
	}

	if (enableSchedulerTracing) {
		popInteractions(prevInteractions);
		finishPendingInteractions(root, lanes);
	}

	executionContext = prevExecutionContext;

	flushSyncCallbackQueue();

	// If additional passive effects were scheduled, increment a counter. If this
	// exceeds the limit, we'll fire a warning.
	if (rootWithPendingPassiveEffects === undefined) {
		nestedPassiveUpdateCount = 0;
	} else {
		nestedPassiveUpdateCount = nestedPassiveUpdateCount + 1;
	}

	return true;
}

// Returns whether passive effects were flushed.
export function flushPassiveEffects(): boolean {
	if (pendingPassiveEffectsRenderPriority !== NoPriority) {
		const priorityLevel =
			pendingPassiveEffectsRenderPriority > NormalPriority ? NormalPriority : pendingPassiveEffectsRenderPriority;
		pendingPassiveEffectsRenderPriority = NoPriority;
		if (decoupleUpdatePriorityFromScheduler) {
			const previousLanePriority = ReactFiberLane.getCurrentUpdateLanePriority();

			ReactFiberLane.setCurrentUpdateLanePriority(ReactFiberLane.schedulerPriorityToLanePriority(priorityLevel));
			let ok: boolean;
			let result: unknown;
			if (!__YOLO__) {
				[ok, result] = xpcall(runWithPriority, describeError, priorityLevel, flushPassiveEffectsImpl);
			} else {
				ok = true;
				result = runWithPriority(priorityLevel, flushPassiveEffectsImpl);
			}

			// finally
			ReactFiberLane.setCurrentUpdateLanePriority(previousLanePriority);

			if (!ok) {
				error(result);
			}
			return result as boolean;
		}
		return runWithPriority(priorityLevel, flushPassiveEffectsImpl);
	}
	return false;
}

function flushPassiveMountEffects(root: FiberRoot, firstChild: Fiber): void {
	let fiber: Fiber | undefined = firstChild;
	while (fiber !== undefined) {
		let prevProfilerOnStack: Fiber | undefined;
		if (enableProfilerTimer && enableProfilerCommitHooks) {
			if (fiber.tag === ReactWorkTags.Profiler) {
				prevProfilerOnStack = nearestProfilerOnStack;
				nearestProfilerOnStack = fiber;
			}
		}

		const primarySubtreeFlags = bit32.band(fiber.subtreeFlags, ReactFiberFlags.PassiveMask);

		if (fiber.child !== undefined && primarySubtreeFlags !== ReactFiberFlags.NoFlags) {
			flushPassiveMountEffects(root, fiber.child);
		}

		if (bit32.band(fiber.flags, ReactFiberFlags.Passive) !== ReactFiberFlags.NoFlags) {
			if (__DEV__) {
				setCurrentDebugFiberInDEV(fiber);
				invokeGuardedCallback(undefined, commitPassiveMount, undefined, root, fiber);
				if (hasCaughtError()) {
					const error_ = clearCaughtError();
					captureCommitPhaseError(fiber, fiber.return_, error_);
				}
				resetCurrentDebugFiberInDEV();
			} else {
				let ok: boolean;
				let error_: unknown;
				if (!__YOLO__) {
					[ok, error_] = xpcall(commitPassiveMount, describeError, root, fiber);
				} else {
					ok = true;
					commitPassiveMount(root, fiber);
				}

				if (!ok) {
					captureCommitPhaseError(fiber, fiber.return_, error_);
				}
			}
		}

		if (enableProfilerTimer && enableProfilerCommitHooks) {
			if (fiber.tag === ReactWorkTags.Profiler) {
				// Bubble times to the next nearest ancestor Profiler.
				if (prevProfilerOnStack !== undefined) {
					(prevProfilerOnStack.stateNode as { passiveEffectDuration: number }).passiveEffectDuration += (
						fiber.stateNode as { passiveEffectDuration: number }
					).passiveEffectDuration;
				}

				nearestProfilerOnStack = prevProfilerOnStack;
			}
		}

		fiber = fiber.sibling;
	}
}

function flushPassiveUnmountEffects(firstChild: Fiber): void {
	let fiber: Fiber | undefined = firstChild;
	while (fiber !== undefined) {
		const deletions = fiber.deletions;
		if (deletions !== undefined) {
			for (const fiberToDelete of deletions) {
				flushPassiveUnmountEffectsInsideOfDeletedTree(fiberToDelete, fiber);

				// Now that passive effects have been processed, it's safe to detach
				// lingering pointers.
				detachFiberAfterEffects(fiberToDelete);
			}
		}

		const child = fiber.child;
		if (child !== undefined) {
			// If any children have passive effects then traverse the subtree.
			const passiveFlags = bit32.band(fiber.subtreeFlags, ReactFiberFlags.PassiveMask);
			if (passiveFlags !== ReactFiberFlags.NoFlags) {
				flushPassiveUnmountEffects(child);
			}
		}

		const primaryFlags = bit32.band(fiber.flags, ReactFiberFlags.Passive);
		if (primaryFlags !== ReactFiberFlags.NoFlags) {
			setCurrentDebugFiberInDEV(fiber);
			commitPassiveUnmount(fiber);
			resetCurrentDebugFiberInDEV();
		}

		fiber = fiber.sibling;
	}
}

function flushPassiveUnmountEffectsInsideOfDeletedTree(fiberToDelete: Fiber, nearestMountedAncestor: Fiber): void {
	if (bit32.band(fiberToDelete.subtreeFlags, ReactFiberFlags.PassiveStatic) !== ReactFiberFlags.NoFlags) {
		// If any children have passive effects then traverse the subtree.
		let child = fiberToDelete.child;
		while (child !== undefined) {
			flushPassiveUnmountEffectsInsideOfDeletedTree(child, nearestMountedAncestor);
			child = child.sibling;
		}
	}

	if (bit32.band(fiberToDelete.flags, ReactFiberFlags.PassiveStatic) !== ReactFiberFlags.NoFlags) {
		setCurrentDebugFiberInDEV(fiberToDelete);
		commitPassiveUnmountInsideDeletedTree(fiberToDelete, nearestMountedAncestor);
		resetCurrentDebugFiberInDEV();
	}
}

// Error boundaries and suspense retries

export function isAlreadyFailedLegacyErrorBoundary(instance: any): boolean {
	return legacyErrorBoundariesThatAlreadyFailed?.has(instance) ?? false;
}

export function markLegacyErrorBoundaryAsFailed(instance: any): void {
	if (legacyErrorBoundariesThatAlreadyFailed === undefined) {
		legacyErrorBoundariesThatAlreadyFailed = new Set<any>([instance]);
	} else {
		legacyErrorBoundariesThatAlreadyFailed.add(instance);
	}
}

function prepareToThrowUncaughtError(error_: unknown): void {
	if (!hasUncaughtError) {
		hasUncaughtError = true;
		firstUncaughtError = error_;
	}
}

export function onUncaughtError(error_: unknown): void {
	prepareToThrowUncaughtError(error_);
}

function captureCommitPhaseErrorOnRoot(rootFiber: Fiber, sourceFiber: Fiber, error_: unknown): void {
	const errorInfo = createCapturedValue(error_, sourceFiber);
	const update = createRootErrorUpdate(rootFiber, errorInfo, ReactFiberLane.SyncLane, onUncaughtError);
	enqueueUpdate(rootFiber, update);
	const eventTime = requestEventTime();
	const root = markUpdateLaneFromFiberToRoot(rootFiber, ReactFiberLane.SyncLane);
	if (root !== undefined) {
		ReactFiberLane.markRootUpdated(root, ReactFiberLane.SyncLane, eventTime);
		ensureRootIsScheduled(root, eventTime);
		schedulePendingInteractions(root, ReactFiberLane.SyncLane);
	}
}

export function captureCommitPhaseError(
	sourceFiber: Fiber,
	nearestMountedAncestor: Fiber | undefined,
	error_: unknown
): void {
	if (sourceFiber.tag === ReactWorkTags.HostRoot) {
		// Error was thrown at the root. There is no parent, so the root
		// itself should capture it.
		captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error_);
		return;
	}

	let fiber: Fiber | undefined;
	if (skipUnmountedBoundaries) {
		fiber = nearestMountedAncestor;
	} else {
		fiber = sourceFiber.return_;
	}

	while (fiber !== undefined) {
		if (fiber.tag === ReactWorkTags.HostRoot) {
			captureCommitPhaseErrorOnRoot(fiber, sourceFiber, error_);
			return;
		} else {
			if (fiber.tag === ReactWorkTags.ClassComponent) {
				const ctor = fiber.type as {
					getDerivedStateFromError?: (...args: Array<unknown>) => unknown;
				};
				const instance = fiber.stateNode as {
					componentDidCatch?: (...args: Array<unknown>) => unknown;
				};
				if (
					typeOf(ctor.getDerivedStateFromError) === 'function' ||
					(typeOf(instance.componentDidCatch) === 'function' && !isAlreadyFailedLegacyErrorBoundary(instance))
				) {
					const errorInfo = createCapturedValue(error_, sourceFiber);
					const update = createClassErrorUpdate(fiber, errorInfo, ReactFiberLane.SyncLane);
					enqueueUpdate(fiber, update);
					const eventTime = requestEventTime();
					const root = markUpdateLaneFromFiberToRoot(fiber, ReactFiberLane.SyncLane);
					if (root !== undefined) {
						ReactFiberLane.markRootUpdated(root, ReactFiberLane.SyncLane, eventTime);
						ensureRootIsScheduled(root, eventTime);
						schedulePendingInteractions(root, ReactFiberLane.SyncLane);
					}
					return;
				}
			}
			fiber = fiber.return_;
		}
	}
}

export function pingSuspendedRoot(root: FiberRoot, wakeable: Wakeable, pingedLanes: Lanes): void {
	const pingCache = root.pingCache;
	if (pingCache !== undefined) {
		// The wakeable resolved, so we no longer need to memoize, because it will
		// never be thrown again. Setting the slot to nil removes the key,
		// mirroring the Lua runtime.
		(pingCache as any)[wakeable as any] = undefined;
	}

	const eventTime = requestEventTime();
	ReactFiberLane.markRootPinged(root, pingedLanes, eventTime);

	if (workInProgressRoot === root && ReactFiberLane.isSubsetOfLanes(workInProgressRootRenderLanes, pingedLanes)) {
		// Received a ping at the same priority level at which we're currently
		// rendering. We might want to restart this render.
		if (
			workInProgressRootExitStatus === RootExitStatus.SuspendedWithDelay ||
			(workInProgressRootExitStatus === RootExitStatus.Suspended &&
				ReactFiberLane.includesOnlyRetries(workInProgressRootRenderLanes) &&
				now() - globalMostRecentFallbackTime < FALLBACK_THROTTLE_MS)
		) {
			// Restart from the root.
			prepareFreshStack(root, ReactFiberLane.NoLanes);
		} else {
			// Even though we can't restart right now, we might get an
			// opportunity later. So we mark this render as having a ping.
			workInProgressRootPingedLanes = ReactFiberLane.mergeLanes(workInProgressRootPingedLanes, pingedLanes);
		}
	}

	ensureRootIsScheduled(root, eventTime);
	schedulePendingInteractions(root, pingedLanes);
}

function retryTimedOutBoundary(boundaryFiber: Fiber, retryLane: Lane): void {
	// The boundary fiber (a Suspense component or SuspenseList component)
	// previously was rendered in its fallback state. One of the promises that
	// suspended it has resolved, which means at least part of the tree was
	// likely unblocked. Try rendering again, at a new expiration time.
	if (retryLane === ReactFiberLane.NoLane) {
		retryLane = requestRetryLane(boundaryFiber);
	}
	const eventTime = requestEventTime();
	const root = markUpdateLaneFromFiberToRoot(boundaryFiber, retryLane);
	if (root !== undefined) {
		ReactFiberLane.markRootUpdated(root, retryLane, eventTime);
		ensureRootIsScheduled(root, eventTime);
		schedulePendingInteractions(root, retryLane);
	}
}

export function resolveRetryWakeable(boundaryFiber: Fiber, wakeable: Wakeable): void {
	const retryLane = ReactFiberLane.NoLane; // Default
	let retryCache: Set<Wakeable> | undefined;
	retryCache = boundaryFiber.stateNode;

	if (retryCache !== undefined) {
		// The wakeable resolved, so we no longer need to memoize, because it will
		// never be thrown again.
		retryCache.delete(wakeable);
	}

	retryTimedOutBoundary(boundaryFiber, retryLane);
}

// Computes the next Just Noticeable Difference (JND) boundary.
// The theory is that a person can't tell the difference between small
// differences in time, so waiting a bit longer than necessary won't translate
// to a noticeable difference in the experience. The longer we've already
// waited, the harder it is to tell small differences in time, so the longer we
// can wait additionally. At some point we have to give up though.
function jnd(timeElapsed: number): number {
	if (timeElapsed < 120) {
		return 120;
	} else if (timeElapsed < 480) {
		return 480;
	} else if (timeElapsed < 1080) {
		return 1080;
	} else if (timeElapsed < 1920) {
		return 1920;
	} else if (timeElapsed < 3000) {
		return 3000;
	} else if (timeElapsed < 4320) {
		return 4320;
	}
	return math.ceil(timeElapsed / 1960) * 1960;
}

function checkForNestedUpdates(): void {
	if (nestedUpdateCount > NESTED_UPDATE_LIMIT) {
		nestedUpdateCount = 0;
		rootWithNestedUpdates = undefined;
		invariant(
			false,
			'Maximum update depth exceeded. This can happen when a component ' +
				'repeatedly calls setState inside componentWillUpdate or ' +
				'componentDidUpdate. React limits the number of nested updates to ' +
				'prevent infinite loops.'
		);
	}

	if (__DEV__) {
		if (nestedPassiveUpdateCount > NESTED_PASSIVE_UPDATE_LIMIT) {
			nestedPassiveUpdateCount = 0;
			console.error(
				'Maximum update depth exceeded. This can happen when a component ' +
					"calls setState inside useEffect, but useEffect either doesn't " +
					'have a dependency array, or one of the dependencies changes on ' +
					'every render.'
			);
		}
	}
}

// Suspense hydration retry (upstream has this disabled, but sibling modules
// reach into the work loop for it via the default export).

export function retryDehydratedSuspenseBoundary(boundaryFiber: Fiber): void {
	const retryLane =
		(boundaryFiber.memoizedState as { retryLane?: number } | undefined)?.retryLane ?? ReactFiberLane.NoLane;
	retryTimedOutBoundary(boundaryFiber, retryLane);
}

// Strict-mode warnings + double-invoked effects (DEV only).

function flushRenderPhaseStrictModeWarningsInDEV(): void {
	if (__DEV__) {
		ReactStrictModeWarnings.flushLegacyContextWarning();

		if (warnAboutDeprecatedLifecycles) {
			ReactStrictModeWarnings.flushPendingUnsafeLifecycleWarnings();
		}
	}
}

function commitDoubleInvokeEffectsInDEV(fiber: Fiber, hasPassiveEffects: boolean): void {
	if (__DEV__ && enableDoubleInvokingEffects) {
		setCurrentDebugFiberInDEV(fiber);
		invokeEffectsInDev(fiber, ReactFiberFlags.MountLayoutDev, invokeLayoutEffectUnmountInDEV);
		if (hasPassiveEffects) {
			invokeEffectsInDev(fiber, ReactFiberFlags.MountPassiveDev, invokePassiveEffectUnmountInDEV);
		}

		invokeEffectsInDev(fiber, ReactFiberFlags.MountLayoutDev, invokeLayoutEffectMountInDEV);
		if (hasPassiveEffects) {
			invokeEffectsInDev(fiber, ReactFiberFlags.MountPassiveDev, invokePassiveEffectMountInDEV);
		}
		resetCurrentDebugFiberInDEV();
	}
}

function invokeEffectsInDev(
	firstChild: Fiber,
	fiberFlags: ReactFiberFlags.Flags,
	invokeEffectFn: (fiber: Fiber) => void
): void {
	if (__DEV__ && enableDoubleInvokingEffects) {
		let fiber: Fiber | undefined = firstChild;
		while (fiber !== undefined) {
			const child = fiber.child;
			if (child !== undefined) {
				const primarySubtreeFlag = bit32.band(fiber.subtreeFlags, fiberFlags);
				if (primarySubtreeFlag !== ReactFiberFlags.NoFlags) {
					invokeEffectsInDev(child, fiberFlags, invokeEffectFn);
				}
			}

			if (bit32.band(fiber.flags, fiberFlags) !== ReactFiberFlags.NoFlags) {
				invokeEffectFn(fiber);
			}
			fiber = fiber.sibling;
		}
	}
}

let didWarnStateUpdateForNotYetMountedComponent: Record<string, boolean> | undefined;

function warnAboutUpdateOnNotYetMountedFiberInDEV(fiber: Fiber): void {
	if (__DEV__) {
		if (bit32.band(executionContext, RenderContext) !== NoContext) {
			// We let the other warning about render phase updates deal with this one.
			return;
		}

		if (bit32.band(fiber.mode, bit32.bor(ReactTypeOfMode.BlockingMode, ReactTypeOfMode.ConcurrentMode)) === 0) {
			return;
		}

		const tag = fiber.tag;
		if (
			tag !== ReactWorkTags.IndeterminateComponent &&
			tag !== ReactWorkTags.HostRoot &&
			tag !== ReactWorkTags.ClassComponent &&
			tag !== ReactWorkTags.FunctionComponent &&
			tag !== ReactWorkTags.ForwardRef &&
			tag !== ReactWorkTags.MemoComponent &&
			tag !== ReactWorkTags.SimpleMemoComponent &&
			tag !== ReactWorkTags.Block
		) {
			// Only warn for user-defined components, not internal ones like Suspense.
			return;
		}

		// We show the whole stack but dedupe on the top component's name because
		// the problematic code almost always lies inside that component.
		const componentName = getComponentName(fiber.type) ?? 'ReactComponent';
		if (didWarnStateUpdateForNotYetMountedComponent !== undefined) {
			if (didWarnStateUpdateForNotYetMountedComponent[componentName]) {
				return;
			}
			didWarnStateUpdateForNotYetMountedComponent[componentName] = true;
		} else {
			didWarnStateUpdateForNotYetMountedComponent = { [componentName]: true };
		}

		const previousFiber = ReactCurrentFiber.current;
		const [ok, result] = pcall(() => {
			setCurrentDebugFiberInDEV(fiber);
			console.error(
				"Can't perform a React state update on a component that hasn't mounted yet. " +
					'This indicates that you have a side-effect in your render function that ' +
					'asynchronously later calls tries to update the component. Move this work to ' +
					'useEffect instead.'
			);
		});

		// finally
		if (previousFiber !== undefined) {
			setCurrentDebugFiberInDEV(previousFiber);
		} else {
			resetCurrentDebugFiberInDEV();
		}

		if (!ok) {
			error(result);
		}
	}
}

// In DEV builds with guarded-callback replay, beginWork is reassigned to a
// wrapper that replays a failed unit of work so debuggers see it as an
// uncaught error (mirrors ReactErrorUtils).
if (__DEV__ && replayFailedUnitOfWorkWithInvokeGuardedCallback) {
	beginWork = (current, unitOfWork, lanes) => {
		// Before entering the begin phase, copy the work-in-progress onto a dummy
		// fiber. If beginWork throws, we'll use this to reset the state.
		const originalWorkInProgressCopy = ReactFiber.assignFiberPropertiesInDEV(undefined, unitOfWork);
		const [ok, result] = __YOLO__
			? ([true, originalBeginWork(current, unitOfWork, lanes)] as const)
			: xpcall(originalBeginWork, describeError, current, unitOfWork, lanes);
		if (!ok) {
			const originalError: unknown = result;

			if (
				originalError !== undefined &&
				typeOf(originalError) === 'table' &&
				typeOf((originalError as { andThen?: unknown }).andThen) === 'function'
			) {
				// Don't replay promises. Treat everything else like an error.
				error(originalError);
			}

			// Keep this code in sync with handleError; any changes here must have
			// corresponding changes there.
			resetContextDependencies();
			resetHooksAfterThrow();
			// Don't reset current debug fiber, since we're about to work on the
			// same fiber again.

			// Unwind the failed stack frame.
			ReactFiberUnwindWork.unwindInterruptedWork(unitOfWork);

			// Restore the original properties of the fiber.
			ReactFiber.assignFiberPropertiesInDEV(unitOfWork, originalWorkInProgressCopy);

			if (enableProfilerTimer && bit32.band(unitOfWork.mode, ReactTypeOfMode.ProfileMode) !== 0) {
				// Reset the profiler timer.
				ReactProfilerTimer.startProfilerTimer(unitOfWork);
			}

			// Run beginWork again.
			invokeGuardedCallback(undefined, originalBeginWork, undefined, current, unitOfWork, lanes);

			if (hasCaughtError()) {
				const replayError = clearCaughtError();
				// `invokeGuardedCallback` sometimes sets an expando `_suppressLogging`.
				// Rethrow this error instead of the original one.
				error(replayError);
			} else {
				// This branch is reachable if the render phase is impure.
				error(originalError);
			}
		}

		return result as Fiber | undefined;
	};
}

let didWarnAboutUpdateInRender = false;
let didWarnAboutUpdateInRenderForAnotherComponent: Record<string, boolean | undefined> | undefined;
if (__DEV__) {
	didWarnAboutUpdateInRenderForAnotherComponent = {};
}

function warnAboutRenderPhaseUpdatesInDEV(fiber: Fiber): void {
	if (__DEV__) {
		if (
			ReactCurrentFiber.isRendering &&
			bit32.band(executionContext, RenderContext) !== NoContext &&
			!getIsUpdatingOpaqueValueInRenderPhaseInDEV()
		) {
			if (
				fiber.tag === ReactWorkTags.FunctionComponent ||
				fiber.tag === ReactWorkTags.ForwardRef ||
				fiber.tag === ReactWorkTags.SimpleMemoComponent
			) {
				const renderingComponentName =
					workInProgress !== undefined ? (getComponentName(workInProgress.type) ?? 'Unknown') : 'Unknown';
				// Dedupe by the rendering component because it's the one that needs to be fixed.
				const dedupeKey = renderingComponentName;
				const warnedFor = didWarnAboutUpdateInRenderForAnotherComponent;
				if (warnedFor !== undefined && warnedFor[dedupeKey] === undefined) {
					warnedFor[dedupeKey] = true;
					const setStateComponentName = getComponentName(fiber.type) ?? 'Unknown';
					console.error(
						'Cannot update a component (`%s`) while rendering a ' +
							'different component (`%s`). To locate the bad setState() call inside `%s`, ' +
							'follow the stack trace as described in https://reactjs.org/link/setstate-in-render',
						setStateComponentName,
						renderingComponentName,
						renderingComponentName
					);
				}
			} else if (fiber.tag === ReactWorkTags.ClassComponent) {
				if (!didWarnAboutUpdateInRender) {
					console.error(
						'Cannot update during an existing state transition (such as ' +
							'within `render`). Render methods should be a pure ' +
							'function of props and state.'
					);
					didWarnAboutUpdateInRender = true;
				}
			}
		}
	}
}

// A 'shared' variable that changes when act() opens/closes in tests.
export const IsThisRendererActing: { current: boolean } = { current: false };

export function warnIfNotScopedWithMatchingAct(fiber: Fiber): void {
	if (__DEV__) {
		if (
			HostConfig.warnsIfNotActing === true &&
			IsSomeRendererActing.current === true &&
			IsThisRendererActing.current !== true
		) {
			const previousFiber = ReactCurrentFiber.current;
			const [ok, result] = pcall(() => {
				setCurrentDebugFiberInDEV(fiber);
				console.error(
					"It looks like you're using the wrong act() around your test interactions.\n" +
						'Be sure to use the matching version of act() corresponding to your renderer:\n\n' +
						'-- for react-roblox:\n' +
						'local React = require(Packages.React)\n' +
						'-- ...\n' +
						'React.TestUtils.act(function() ... end)\n\n' +
						'-- for react-test-renderer:\n' +
						'local TestRenderer = require(Packages.ReactTestRenderer)\n' +
						'-- ...\n' +
						'TestRenderer.act(function() ... end)'
				);
			});

			// finally
			if (previousFiber !== undefined) {
				setCurrentDebugFiberInDEV(previousFiber);
			} else {
				resetCurrentDebugFiberInDEV();
			}

			if (!ok) {
				error(result);
			}
		}
	}
}

export function warnIfNotCurrentlyActingEffectsInDEV(fiber: Fiber): void {
	if (__DEV__) {
		if (
			HostConfig.warnsIfNotActing === true &&
			bit32.band(fiber.mode, ReactTypeOfMode.StrictMode) !== ReactTypeOfMode.NoMode &&
			IsSomeRendererActing.current === false &&
			IsThisRendererActing.current === false
		) {
			console.error(
				'An update to %s ran an effect, but was not wrapped in act(...).\n\n' +
					'When testing, code that causes React state updates should be ' +
					'wrapped into act(...):\n\n' +
					'act(function()\n' +
					'  --[[ fire events that update state ]]\n' +
					'end)\n' +
					'--[[ assert on the output ]]\n\n' +
					"This ensures that you're testing the behavior the user would see " +
					'in the real client.' +
					' Learn more at https://reactjs.org/link/wrap-tests-with-act',
				getComponentName(fiber.type)
			);
		}
	}
}

export function warnIfNotCurrentlyActingUpdatesInDEV(fiber: Fiber): void {
	if (__DEV__) {
		if (
			HostConfig.warnsIfNotActing === true &&
			executionContext === NoContext &&
			IsSomeRendererActing.current === false &&
			IsThisRendererActing.current === false
		) {
			const previousFiber = ReactCurrentFiber.current;
			const [ok] = pcall(() => {
				setCurrentDebugFiberInDEV(fiber);
				console.error(
					'An update to %s inside a test was not wrapped in act(...).\n\n' +
						'When testing, code that causes React state updates should be ' +
						'wrapped into act(...):\n\n' +
						'act(function()\n' +
						'  --[[ fire events that update state ]]\n' +
						'end)\n' +
						'--[[ assert on the output ]]\n\n' +
						"This ensures that you're testing the behavior the user would see " +
						'in the client application.' +
						' Learn more at https://reactjs.org/link/wrap-tests-with-act',
					getComponentName(fiber.type)
				);
			});

			// finally
			if (previousFiber !== undefined) {
				setCurrentDebugFiberInDEV(previousFiber);
			} else {
				resetCurrentDebugFiberInDEV();
			}

			if (ok) {
				return;
			}
		}
	}
}

// In tests, we want to enforce a mocked scheduler.
let didWarnAboutUnmockedScheduler = false;

export function warnIfUnmockedScheduler(fiber: Fiber): void {
	if (__DEV__) {
		if (didWarnAboutUnmockedScheduler === false && flushMockScheduler === undefined) {
			if (
				bit32.band(fiber.mode, ReactTypeOfMode.BlockingMode) !== 0 ||
				bit32.band(fiber.mode, ReactTypeOfMode.ConcurrentMode) !== 0
			) {
				didWarnAboutUnmockedScheduler = true;
				console.error(
					"In Concurrent or Sync modes, the 'scheduler' module needs to be mocked " +
						'to guarantee consistent behaviour across tests and client application. ' +
						'For example, with Jest: \n' +
						"jest.mock('scheduler', function() return require(Packages.Scheduler).unstable_mock end)\n\n" +
						'For more info, visit https://reactjs.org/link/mock-scheduler'
				);
			} else if (warnAboutUnmockedScheduler === true) {
				didWarnAboutUnmockedScheduler = true;
				console.error(
					"Starting from React v18, the 'scheduler' module will need to be mocked " +
						'to guarantee consistent behaviour across tests and client applications. ' +
						'For example, with Jest: \n' +
						"jest.mock('scheduler', function() return require(Packages.Scheduler).unstable_mock end)\n\n" +
						'For more info, visit https://reactjs.org/link/mock-scheduler'
				);
			}
		}
	}
}

function computeThreadID(root: FiberRoot, lane: Lane | Lanes): number {
	// Interaction threads are unique per root and expiration time.
	return lane * 1000 + root.interactionThreadID;
}

export function markSpawnedWork(lane: Lane | Lanes): void {
	if (!enableSchedulerTracing) {
		return;
	}
	if (spawnedWorkDuringRender === undefined) {
		spawnedWorkDuringRender = [lane];
	} else {
		spawnedWorkDuringRender.push(lane);
	}
}

function scheduleInteractions(root: FiberRoot, lane: Lane | Lanes, interactions: Set<Interaction>): void {
	if (!enableSchedulerTracing) {
		return;
	}

	if (interactions.size() > 0) {
		const pendingInteractionMap = root.pendingInteractionMap;
		const pendingInteractions = pendingInteractionMap.get(lane);
		if (pendingInteractions !== undefined) {
			interactions.forEach((interaction) => {
				if (!pendingInteractions.has(interaction)) {
					// Update the pending async work count for previously unscheduled interaction.
					interaction.__count += 1;
				}

				pendingInteractions.add(interaction);
			});
		} else {
			const copiedInteractions = new Set<Interaction>();
			interactions.forEach((interaction) => {
				copiedInteractions.add(interaction);
			});
			pendingInteractionMap.set(lane, copiedInteractions);

			// Update the pending async work count for the current interactions.
			interactions.forEach((interaction) => {
				interaction.__count += 1;
			});
		}

		const subscriber = __subscriberRef?.current;
		if (subscriber !== undefined) {
			const threadID = computeThreadID(root, lane);
			subscriber.onWorkScheduled(interactions, threadID);
		}
	}
}

function schedulePendingInteractions(root: FiberRoot, lane: Lane | Lanes): void {
	// This is called when work is scheduled on a root.
	// It associates the current interactions with the newly-scheduled expiration.
	// They will be restored when that expiration is later committed.
	if (!enableSchedulerTracing) {
		return;
	}

	scheduleInteractions(root, lane, __interactionsRef?.current ?? new Set<Interaction>());
}

function startWorkOnPendingInteractions(root: FiberRoot, lanes: Lanes): void {
	// This is called when new work is started on a root.
	if (!enableSchedulerTracing) {
		return;
	}

	// Determine which interactions this batch of work currently includes, so that
	// we can accurately attribute time spent working on it, and so that cascading
	// work triggered during the render phase will be associated with it.
	const interactions = new Set<Interaction>();
	root.pendingInteractionMap.forEach((scheduledInteractions, scheduledLane) => {
		if (ReactFiberLane.includesSomeLane(lanes, scheduledLane)) {
			scheduledInteractions.forEach((interaction) => {
				interactions.add(interaction);
			});
		}
	});

	// Store the current set of interactions on the FiberRoot so hot functions like
	// performConcurrentWorkOnRoot() can re-use it without recalculating, commitWork()
	// can pass it to Profiler onRender() hooks, and DevTools can access it.
	root.memoizedInteractions = interactions;

	if (interactions.size() > 0) {
		const subscriber = __subscriberRef?.current;
		if (subscriber !== undefined) {
			const threadID = computeThreadID(root, lanes);
			const [ok, error_] = xpcall(subscriber.onWorkStarted, describeError, interactions, threadID);
			if (!ok) {
				// If the subscriber throws, rethrow it in a separate task.
				scheduleCallback(ImmediatePriority, () => {
					error(error_);
				});
			}
		}
	}
}

function finishPendingInteractions(root: FiberRoot, committedLanes: Lanes): void {
	if (!enableSchedulerTracing) {
		return;
	}

	const remainingLanesAfterCommit = root.pendingLanes;

	const subscriber = __subscriberRef?.current;

	let ok = true;
	let error_: unknown;
	if (subscriber !== undefined && root.memoizedInteractions.size() > 0) {
		const threadID = computeThreadID(root, committedLanes);
		[ok, error_] = xpcall(subscriber.onWorkStopped, describeError, root.memoizedInteractions, threadID);
	}

	// Clear completed interactions from the pending Map.
	// Unless the render was suspended or cascading work was scheduled,
	// in which case leave pending interactions until the subsequent render.
	const pendingInteractionMap = root.pendingInteractionMap;
	pendingInteractionMap.forEach((scheduledInteractions, lane) => {
		// Only decrement the pending interaction count if we're done.
		// If there's still work at the current priority,
		// that indicates that we are waiting for suspense data.
		if (!ReactFiberLane.includesSomeLane(remainingLanesAfterCommit, lane)) {
			pendingInteractionMap.delete(lane);
			scheduledInteractions.forEach((interaction) => {
				interaction.__count -= 1;

				if (subscriber !== undefined && interaction.__count === 0) {
					const [ok_, error__] = xpcall(
						subscriber.onInteractionScheduledWorkCompleted,
						describeError,
						interaction
					);
					if (!ok_) {
						// If the subscriber throws, rethrow it in a separate task.
						scheduleCallback(ImmediatePriority, () => {
							error(error__);
						});
					}
				}
			});
		}
	});

	if (!ok) {
		// If the subscriber throws, rethrow it in a separate task.
		scheduleCallback(ImmediatePriority, () => {
			error(error_);
		});
	}
}

// `act` testing API.
let isFlushingAct = false;
let isInsideThisAct = false;

const isSchedulerMocked = typeOf(flushMockScheduler) === 'function';

// Returns whether additional work was scheduled. Caller should keep flushing
// until there's no work left.
function flushActWork(): boolean {
	if (flushMockScheduler !== undefined) {
		const prevIsFlushing = isFlushingAct;
		isFlushingAct = true;
		const [ok, result] = xpcall(flushMockScheduler, describeError);

		// finally
		isFlushingAct = prevIsFlushing;

		if (!ok) {
			error(result);
		} else {
			return result as boolean;
		}
	} else {
		// No mock scheduler available. However, the only type of pending work is
		// passive effects, which we control. So we can flush that.
		const prevIsFlushing = isFlushingAct;
		isFlushingAct = true;
		const [ok, result] = xpcall(() => {
			let didFlushWork = false;
			while (flushPassiveEffects()) {
				didFlushWork = true;
			}
			return didFlushWork;
		}, describeError);

		// finally
		isFlushingAct = prevIsFlushing;

		if (!ok) {
			error(result);
		} else {
			return result as boolean;
		}
	}
}

function flushWorkAndMicroTasks(onDone: (err?: any) => void): void {
	let ok = false;
	let result: unknown;
	[ok, result] = xpcall(flushActWork, describeError);
	if (ok) {
		[ok, result] = xpcall(enqueueTask, describeError, () => {
			if (flushActWork()) {
				flushWorkAndMicroTasks(onDone);
			} else {
				onDone();
			}
		});
	}

	if (!ok) {
		onDone(result);
	}
}

export function act(callback: () => Thenable<any>): Thenable<any> {
	// It's only viable to export `act` when we're using mocked scheduling logic.
	// Since there are numerous testing scenarios in which we call `require` on
	// the Roact library _before_ we bootstrap tests, we expose a global to toggle
	// this explicitly.
	if (!(__DEV__ || __ROACT_17_MOCK_SCHEDULER__)) {
		if (didWarnAboutUsingActInProd === false) {
			didWarnAboutUsingActInProd = true;
			console.error('act(...) is not supported in production builds of React, and might not behave as expected.');
		}
	}

	const previousActingUpdatesScopeDepth = actingUpdatesScopeDepth;
	actingUpdatesScopeDepth += 1;

	const previousIsSomeRendererActing = IsSomeRendererActing.current;
	const previousIsThisRendererActing = IsThisRendererActing.current;
	const previousIsInsideThisAct = isInsideThisAct;
	IsSomeRendererActing.current = true;
	IsThisRendererActing.current = true;
	isInsideThisAct = true;

	const onDone = () => {
		actingUpdatesScopeDepth -= 1;
		IsSomeRendererActing.current = previousIsSomeRendererActing;
		IsThisRendererActing.current = previousIsThisRendererActing;
		isInsideThisAct = previousIsInsideThisAct;
		if (__DEV__) {
			if (actingUpdatesScopeDepth > previousActingUpdatesScopeDepth) {
				// If it's less than previousActingUpdatesScopeDepth, we can assume the
				// other act() call has already warned.
				console.error(
					'You seem to have overlapping act() calls, this is not supported. ' +
						'Be sure to await previous act() calls before making a new one. '
				);
			}
		}
	};

	const [ok, result] = xpcall(() => batchedUpdates(callback, undefined), describeError);
	if (!ok) {
		onDone();
		error(result);
	}

	if (
		result !== undefined &&
		typeOf(result) === 'table' &&
		typeOf((result as { andThen?: unknown }).andThen) === 'function'
	) {
		// `Thenable` declares `andThen` with a `self` parameter; this self-less
		// alias is what the reconciler actually calls.
		const thenable = result as Thenable<any> & {
			andThen: (onFulfilled: () => void, onRejected: (err: any) => void) => void;
		};
		// Setup a boolean that gets set to true only once this act() call is awaited.
		let called = false;
		if (__DEV__) {
			if (typeOf(Promise) !== 'nil') {
				Promise.resolve(undefined)
					.andThen(() => {})
					.andThen(() => {
						if (called === false) {
							console.error(
								'You called act(Promise.new(function() --[[ ... ]] end)) without :await() or :expect(). ' +
									'This could lead to unexpected testing behaviour, interleaving multiple act ' +
									'calls and mixing their scopes. You should - act(function() Promise.new(function() --[[ ... ]] end):await() end);'
							);
						}
					});
			}
		}

		// In the async case, the returned thenable runs the callback, flushes
		// effects and microtasks in a loop until flushPassiveEffects() is false,
		// and cleans up.
		return {
			andThen: (_self: unknown, resolve: () => void, reject: (err: unknown) => void) => {
				called = true;
				thenable.andThen(
					() => {
						if (
							actingUpdatesScopeDepth > 1 ||
							(isSchedulerMocked === true && previousIsSomeRendererActing === true)
						) {
							onDone();
							resolve();
							return;
						}
						// We're about to exit the act() scope, now's the time to flush tasks/effects.
						flushWorkAndMicroTasks((err) => {
							onDone();
							if (err) {
								reject(err);
							} else {
								resolve();
							}
						});
					},
					(err: unknown) => {
						onDone();
						reject(err);
					}
				);
			},
		} as unknown as Thenable<any>;
	} else {
		if (__DEV__) {
			if (result !== undefined) {
				console.error(
					'The callback passed to act(...) function ' + 'must return nil, or a Promise. You returned %s',
					tostring(result)
				);
			}
		}

		// Flush effects until none remain, and cleanup.
		const [flushOk, flushResult] = xpcall(() => {
			if (
				actingUpdatesScopeDepth === 1 &&
				(isSchedulerMocked === false || previousIsSomeRendererActing === false)
			) {
				// We're about to exit the act() scope, now's the time to flush effects.
				flushActWork();
			}
			onDone();
		}, describeError);

		if (!flushOk) {
			onDone();
			error(flushResult);
		}

		// In the sync case, the returned thenable only warns if awaited.
		return {
			andThen: (_self: unknown, resolve: () => void) => {
				if (__DEV__) {
					console.error('Do not await the result of calling act(...) with sync logic, it is not a Promise.');
				}
				resolve();
			},
		} as unknown as Thenable<any>;
	}
}

function detachFiberAfterEffects(fiber: Fiber): void {
	// Null out fields to improve GC for references that may be lingering (e.g. DevTools).
	// Note that we already cleared the return pointer in detachFiberMutation().
	fiber.child = undefined;
	fiber.deletions = undefined;
	fiber.dependencies = undefined;
	fiber.memoizedProps = undefined;
	fiber.memoizedState = undefined;
	fiber.pendingProps = undefined;
	fiber.sibling = undefined;
	fiber.stateNode = undefined;
	fiber.updateQueue = undefined;

	if (__DEV__) {
		fiber._debugOwner = undefined;
	}
}

// Default export (mirrors the upstream `exports` table so sibling modules can
// reach into the work loop through a single default import).

export default {
	act,
	batchedEventUpdates,
	batchedUpdates,
	captureCommitPhaseError,
	deferredUpdates,
	discreteUpdates,
	flushControlled,
	flushDiscreteUpdates,
	flushPassiveEffects,
	flushRoot,
	flushSync,
	getExecutionContext,
	getRenderTargetTime,
	getWorkInProgressRoot,
	isAlreadyFailedLegacyErrorBoundary,
	IsThisRendererActing,
	markCommitTimeOfFallback,
	markLegacyErrorBoundaryAsFailed,
	markSkippedUpdateLanes,
	markSpawnedWork,
	NoContext,
	onUncaughtError,
	pingSuspendedRoot,
	popRenderLanes,
	pushRenderLanes,
	renderDidError,
	renderDidSuspend,
	renderDidSuspendDelayIfPossible,
	renderHasNotSuspendedYet,
	requestEventTime,
	requestUpdateLane,
	resolveRetryWakeable,
	retryDehydratedSuspenseBoundary,
	RetryAfterError,
	schedulePassiveEffectCallback,
	scheduleUpdateOnFiber,
	subtreeRenderLanes,
	unbatchedUpdates,
	warnIfNotCurrentlyActingEffectsInDEV,
	warnIfNotCurrentlyActingUpdatesInDEV,
	warnIfNotScopedWithMatchingAct,
	warnIfUnmockedScheduler,
};
