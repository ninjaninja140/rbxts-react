/**
 * Completes work for a fiber after its children have been reconciled.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberCompleteWork.new.lua`.
 */

import { invariant, ReactFeatureFlags } from '@nrbx/react-shared';

import type { Fiber, FiberRoot, Lane, Lanes } from './types';
import type { ChildSet, Container, HostContext, Instance, Props, Type as HostType } from './ReactFiberHostConfig';
import type { OffscreenState } from './ReactFiberOffscreenComponent';
import type { SuspenseState } from './ReactFiberSuspenseComponent.new';
import type { SuspenseContext } from './ReactFiberSuspenseContext.new';

import HostConfig from './ReactFiberHostConfig';
import * as ReactMutableSource from './ReactMutableSource.new';
import * as ReactWorkTags from './ReactWorkTags';
import * as ReactTypeOfMode from './ReactTypeOfMode';
import * as ReactFiberFlags from './ReactFiberFlags';
import * as ReactFiberHostContext from './ReactFiberHostContext.new';
import * as ReactFiberSuspenseContext from './ReactFiberSuspenseContext.new';
import * as ReactFiberContext from './ReactFiberContext.new';
import { popProvider } from './ReactFiberNewContext.new';
import * as ReactFiberHydrationContext from './ReactFiberHydrationContext.new';
import * as ReactFiberWorkLoop from './ReactFiberWorkLoop.new';
import * as ReactFiberLane from './ReactFiberLane';
import * as ReactProfilerTimer from './ReactProfilerTimer.new';

function unimplemented(message: string): never {
	print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	print(`UNIMPLEMENTED ERROR: ${tostring(message)}`);
	error(`FIXME (roblox): ${message} is unimplemented`, 2);
}

const IndeterminateComponent = ReactWorkTags.IndeterminateComponent;
const FunctionComponent = ReactWorkTags.FunctionComponent;
const ClassComponent = ReactWorkTags.ClassComponent;
const HostRoot = ReactWorkTags.HostRoot;
const HostComponent = ReactWorkTags.HostComponent;
const HostText = ReactWorkTags.HostText;
const HostPortal = ReactWorkTags.HostPortal;
const ContextProvider = ReactWorkTags.ContextProvider;
const ContextConsumer = ReactWorkTags.ContextConsumer;
const ForwardRef = ReactWorkTags.ForwardRef;
const Fragment = ReactWorkTags.Fragment;
const Mode = ReactWorkTags.Mode;
const Profiler = ReactWorkTags.Profiler;
const SuspenseComponent = ReactWorkTags.SuspenseComponent;
const SuspenseListComponent = ReactWorkTags.SuspenseListComponent;
const MemoComponent = ReactWorkTags.MemoComponent;
const SimpleMemoComponent = ReactWorkTags.SimpleMemoComponent;
const LazyComponent = ReactWorkTags.LazyComponent;
const IncompleteClassComponent = ReactWorkTags.IncompleteClassComponent;
const FundamentalComponent = ReactWorkTags.FundamentalComponent;
const ScopeComponent = ReactWorkTags.ScopeComponent;
const Block = ReactWorkTags.Block;
const OffscreenComponent = ReactWorkTags.OffscreenComponent;
const LegacyHiddenComponent = ReactWorkTags.LegacyHiddenComponent;

const NoMode = ReactTypeOfMode.NoMode;
const ConcurrentMode = ReactTypeOfMode.ConcurrentMode;
const BlockingMode = ReactTypeOfMode.BlockingMode;
const ProfileMode = ReactTypeOfMode.ProfileMode;

const Ref = ReactFiberFlags.Ref;
const Update = ReactFiberFlags.Update;
const Callback = ReactFiberFlags.Callback;
const Passive = ReactFiberFlags.Passive;
const Deletion = ReactFiberFlags.Deletion;
const NoFlags = ReactFiberFlags.NoFlags;
const DidCapture = ReactFiberFlags.DidCapture;
const Snapshot = ReactFiberFlags.Snapshot;
const MutationMask = ReactFiberFlags.MutationMask;
const LayoutMask = ReactFiberFlags.LayoutMask;
const PassiveMask = ReactFiberFlags.PassiveMask;
const StaticMask = ReactFiberFlags.StaticMask;
const PerformedWork = ReactFiberFlags.PerformedWork;

// Host-config functions are read lazily (at call time) because the renderer
// splices its implementation in via `initialize()` long after this module has
// been `require`d. See ReactFiberHostConfig for details.
function createInstance(
	type_: HostType,
	props: Props,
	rootContainerInstance: Container,
	hostContext: HostContext,
	internalInstanceHandle: Fiber
): Instance {
	return HostConfig.createInstance(type_, props, rootContainerInstance, hostContext, internalInstanceHandle);
}
function createTextInstance(
	text: string,
	rootContainerInstance: Container,
	hostContext: HostContext,
	internalInstanceHandle: Fiber
): Instance {
	return HostConfig.createTextInstance(text, rootContainerInstance, hostContext, internalInstanceHandle);
}
function appendInitialChild(parent: Instance, child: Instance): void {
	HostConfig.appendInitialChild(parent, child);
}
function finalizeInitialChildren(
	instance: Instance,
	type_: HostType,
	props: Props,
	rootContainerInstance: Container,
	hostContext: HostContext
): boolean {
	return HostConfig.finalizeInitialChildren(instance, type_, props, rootContainerInstance, hostContext);
}
function prepareUpdate(
	instance: Instance,
	type_: HostType,
	oldProps: Props,
	newProps: Props,
	rootContainerInstance: Container,
	hostContext: HostContext
): defined {
	return HostConfig.prepareUpdate(instance, type_, oldProps, newProps, rootContainerInstance, hostContext);
}
const supportsMutation = () => HostConfig.supportsMutation;
const supportsPersistence = () => HostConfig.supportsPersistence ?? false;
function createContainerChildSet(container: Container): ChildSet {
	return HostConfig.createContainerChildSet!(container);
}
function finalizeContainerChildren(container: Container, newChildren: ChildSet): void {
	HostConfig.finalizeContainerChildren!(container, newChildren);
}
function preparePortalMount(containerInfo: Container): void {
	HostConfig.preparePortalMount(containerInfo);
}

const getRootHostContainer = ReactFiberHostContext.getRootHostContainer as () => Container;
const popHostContext = ReactFiberHostContext.popHostContext as (workInProgress: Fiber) => void;
const getHostContext = ReactFiberHostContext.getHostContext as () => HostContext;
const popHostContainer = ReactFiberHostContext.popHostContainer as (workInProgress: Fiber) => void;

const popSuspenseContext = ReactFiberSuspenseContext.popSuspenseContext as (workInProgress: Fiber) => void;
const suspenseStackCursor = ReactFiberSuspenseContext.suspenseStackCursor as {
	current: unknown;
};
const InvisibleParentSuspenseContext = ReactFiberSuspenseContext.InvisibleParentSuspenseContext;
const hasSuspenseContext = ReactFiberSuspenseContext.hasSuspenseContext as (
	parentContext: unknown,
	subtreeContext: SuspenseContext
) => boolean;

const isLegacyContextProvider = ReactFiberContext.isContextProvider as (component: defined) => boolean;
const popLegacyContext = ReactFiberContext.popContext as (workInProgress: Fiber) => void;
const popTopLevelLegacyContextObject = ReactFiberContext.popTopLevelContextObject as (workInProgress: Fiber) => void;

const prepareToHydrateHostSuspenseInstance = ReactFiberHydrationContext.prepareToHydrateHostSuspenseInstance as (
	workInProgress: Fiber
) => void;
const popHydrationState = ReactFiberHydrationContext.popHydrationState as (workInProgress: Fiber) => boolean;
const resetHydrationState = ReactFiberHydrationContext.resetHydrationState as () => void;
const prepareToHydrateHostInstance = ReactFiberHydrationContext.prepareToHydrateHostInstance as (
	workInProgress: Fiber,
	rootContainerInstance: Container,
	hostContext: HostContext
) => boolean;
const prepareToHydrateHostTextInstance = ReactFiberHydrationContext.prepareToHydrateHostTextInstance as (
	workInProgress: Fiber
) => boolean;

const enableSchedulerTracing = ReactFeatureFlags.enableSchedulerTracing;
const enableSuspenseCallback = ReactFeatureFlags.enableSuspenseCallback;
const enableSuspenseServerRenderer = ReactFeatureFlags.enableSuspenseServerRenderer;
const enableFundamentalAPI = ReactFeatureFlags.enableFundamentalAPI;
const enableProfilerTimer = ReactFeatureFlags.enableProfilerTimer;

const popRenderLanes = ReactFiberWorkLoop.popRenderLanes as (workInProgress: Fiber) => void;
const markSpawnedWork = ReactFiberWorkLoop.markSpawnedWork as (lane: Lanes) => void;
const renderDidSuspend = ReactFiberWorkLoop.renderDidSuspend as () => void;
const renderDidSuspendDelayIfPossible = ReactFiberWorkLoop.renderDidSuspendDelayIfPossible as () => void;

const OffscreenLane = ReactFiberLane.OffscreenLane;
const NoLanes = ReactFiberLane.NoLanes;
const includesSomeLane = ReactFiberLane.includesSomeLane;
const mergeLanes = ReactFiberLane.mergeLanes;

const transferActualDuration = ReactProfilerTimer.transferActualDuration as (fiber: Fiber) => void;
const resetMutableSourceWorkInProgressVersions = ReactMutableSource.resetWorkInProgressVersions as () => void;

function markUpdate(workInProgress: Fiber): void {
	workInProgress.flags = bit32.bor(workInProgress.flags, Update);
}

function markRef(workInProgress: Fiber): void {
	workInProgress.flags = bit32.bor(workInProgress.flags, Ref);
}

function hadNoMutationsEffects(current: Fiber | undefined, completedWork: Fiber): boolean {
	const didBailout = current !== undefined && current.child === completedWork.child;
	if (didBailout) {
		return true;
	}

	let child = completedWork.child;
	while (child !== undefined) {
		if (bit32.band(child.flags, MutationMask) !== NoFlags) {
			return false;
		}
		if (bit32.band(child.subtreeFlags, MutationMask) !== NoFlags) {
			return false;
		}
		child = child.sibling;
	}
	return true;
}

let appendAllChildren = undefined as unknown as (
	parent: Instance,
	workInProgress: Fiber,
	needsVisibilityToggle: boolean,
	isHidden: boolean
) => void;
let updateHostContainer = undefined as unknown as (current: Fiber | undefined, workInProgress: Fiber) => void;
let updateHostComponent = undefined as unknown as (
	current: Fiber,
	workInProgress: Fiber,
	type_: HostType,
	newProps: Props,
	rootContainerInstance: Container
) => void;
let updateHostText = undefined as unknown as (
	current: Fiber,
	workInProgress: Fiber,
	oldText: string,
	newText: string
) => void;

if (supportsMutation()) {
	appendAllChildren = (
		parent: Instance,
		workInProgress: Fiber,
		_needsVisibilityToggle: boolean,
		_isHidden: boolean
	): void => {
		let node = workInProgress.child;
		while (node !== undefined) {
			if (node.tag === HostComponent || node.tag === HostText) {
				appendInitialChild(parent, node.stateNode as Instance);
			} else if (enableFundamentalAPI && node.tag === FundamentalComponent) {
				const stateNode = node.stateNode as { instance: Instance };
				appendInitialChild(parent, stateNode.instance);
			} else if (node.tag === HostPortal) {
				// If we have a portal child, then we don't want to traverse down its
				// children. Instead, we'll get insertions from each child in the
				// portal directly.
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
			const sibling = node.sibling as Fiber;
			sibling.return_ = node.return_;
			node = sibling;
		}
	};

	updateHostContainer = (_current: Fiber | undefined, _workInProgress: Fiber): void => {
		// Noop
	};

	updateHostComponent = (
		current: Fiber,
		workInProgress: Fiber,
		type_: HostType,
		newProps: Props,
		rootContainerInstance: Container
	): void => {
		const oldProps = current.memoizedProps as Props;
		if (oldProps === newProps) {
			return;
		}

		const instance = workInProgress.stateNode as Instance;
		const currentHostContext = getHostContext();
		const updatePayload = prepareUpdate(
			instance,
			type_,
			oldProps,
			newProps,
			rootContainerInstance,
			currentHostContext
		);
		workInProgress.updateQueue = updatePayload;
		if (updatePayload) {
			markUpdate(workInProgress);
		}
	};

	updateHostText = (_current: Fiber, workInProgress: Fiber, oldText: string, newText: string): void => {
		if (oldText !== newText) {
			markUpdate(workInProgress);
		}
	};
} else if (supportsPersistence()) {
	appendAllChildren = (
		_parent: Instance,
		_workInProgress: Fiber,
		_needsVisibilityToggle: boolean,
		_isHidden: boolean
	): void => {
		unimplemented('appendAllChildren');
	};

	const appendAllChildrenToContainer = (
		_containerChildSet: ChildSet,
		_workInProgress: Fiber,
		_needsVisibilityToggle: boolean,
		_isHidden: boolean
	): void => {
		unimplemented('appendAllChildrenToContainer');
	};

	updateHostContainer = (current: Fiber | undefined, workInProgress: Fiber): void => {
		const portalOrRoot = workInProgress.stateNode as {
			containerInfo: Container;
			pendingChildren: ChildSet;
			[key: string]: defined;
		};
		const childrenUnchanged = hadNoMutationsEffects(current, workInProgress);
		if (!childrenUnchanged) {
			const container = portalOrRoot.containerInfo;
			const newChildSet = createContainerChildSet(container);
			appendAllChildrenToContainer(newChildSet, workInProgress, false, false);
			portalOrRoot.pendingChildren = newChildSet;
			markUpdate(workInProgress);
			finalizeContainerChildren(container, newChildSet);
		}
	};
} else {
	updateHostContainer = (_current: Fiber | undefined, _workInProgress: Fiber): void => {
		// Noop
	};
}

function bubbleProperties(completedWork: Fiber): boolean {
	const didBailout = completedWork.alternate !== undefined && completedWork.alternate.child === completedWork.child;

	let newChildLanes = NoLanes;
	let subtreeFlags = NoFlags;

	if (!didBailout) {
		if (enableProfilerTimer && bit32.band(completedWork.mode, ProfileMode) !== NoMode) {
			let actualDuration = (completedWork.actualDuration as number | undefined) ?? 0;
			let treeBaseDuration = (completedWork.selfBaseDuration as number | undefined) ?? 0;

			let child = completedWork.child;
			while (child !== undefined) {
				newChildLanes = mergeLanes(newChildLanes, mergeLanes(child.lanes, child.childLanes));

				subtreeFlags = bit32.bor(subtreeFlags, child.subtreeFlags);
				subtreeFlags = bit32.bor(subtreeFlags, child.flags);

				actualDuration += (child.actualDuration as number | undefined) ?? 0;
				treeBaseDuration += (child.treeBaseDuration as number | undefined) ?? 0;
				child = child.sibling;
			}

			completedWork.actualDuration = actualDuration;
			completedWork.treeBaseDuration = treeBaseDuration;
		} else {
			let child = completedWork.child;
			while (child !== undefined) {
				newChildLanes = bit32.bor(newChildLanes, bit32.bor(child.lanes, child.childLanes));

				subtreeFlags = bit32.bor(subtreeFlags, child.subtreeFlags);
				subtreeFlags = bit32.bor(subtreeFlags, child.flags);

				child.return_ = completedWork;
				child = child.sibling;
			}
		}

		completedWork.subtreeFlags = bit32.bor(completedWork.subtreeFlags, subtreeFlags);
	} else {
		if (enableProfilerTimer && bit32.band(completedWork.mode, ProfileMode) !== NoMode) {
			let treeBaseDuration = (completedWork.selfBaseDuration as number | undefined) ?? 0;

			let child = completedWork.child;
			while (child !== undefined) {
				newChildLanes = mergeLanes(newChildLanes, mergeLanes(child.lanes, child.childLanes));

				subtreeFlags = bit32.bor(subtreeFlags, bit32.band(child.subtreeFlags, StaticMask));
				subtreeFlags = bit32.bor(subtreeFlags, bit32.band(child.flags, StaticMask));

				treeBaseDuration += (child.treeBaseDuration as number | undefined) ?? 0;
				child = child.sibling;
			}

			completedWork.treeBaseDuration = treeBaseDuration;
		} else {
			let child = completedWork.child;
			while (child !== undefined) {
				newChildLanes = bit32.bor(newChildLanes, bit32.bor(child.lanes, child.childLanes));

				subtreeFlags = bit32.bor(subtreeFlags, bit32.band(child.subtreeFlags, StaticMask));
				subtreeFlags = bit32.bor(subtreeFlags, bit32.band(child.flags, StaticMask));

				child.return_ = completedWork;
				child = child.sibling;
			}
		}

		completedWork.subtreeFlags = bit32.bor(completedWork.subtreeFlags, subtreeFlags);
	}

	completedWork.childLanes = newChildLanes;
	return didBailout;
}

export function completeWork(current: Fiber | undefined, workInProgress: Fiber, renderLanes: Lanes): Fiber | undefined {
	const newProps = workInProgress.pendingProps;

	if (
		workInProgress.tag === IndeterminateComponent ||
		workInProgress.tag === LazyComponent ||
		workInProgress.tag === SimpleMemoComponent ||
		workInProgress.tag === FunctionComponent ||
		workInProgress.tag === ForwardRef ||
		workInProgress.tag === Fragment ||
		workInProgress.tag === Mode ||
		workInProgress.tag === ContextConsumer ||
		workInProgress.tag === MemoComponent
	) {
		bubbleProperties(workInProgress);
		return undefined;
	} else if (workInProgress.tag === ClassComponent) {
		const component = workInProgress.type;
		if (isLegacyContextProvider(component)) {
			popLegacyContext(workInProgress);
		}
		bubbleProperties(workInProgress);
		return undefined;
	} else if (workInProgress.tag === HostRoot) {
		popHostContainer(workInProgress);
		popTopLevelLegacyContextObject(workInProgress);
		resetMutableSourceWorkInProgressVersions();
		const fiberRoot = workInProgress.stateNode as FiberRoot;
		if (fiberRoot.pendingContext !== undefined) {
			fiberRoot.context = fiberRoot.pendingContext;
			fiberRoot.pendingContext = undefined;
		}
		if (current === undefined || current.child === undefined) {
			const wasHydrated = popHydrationState(workInProgress);
			if (wasHydrated) {
				markUpdate(workInProgress);
			} else if (!fiberRoot.hydrate) {
				workInProgress.flags = bit32.bor(workInProgress.flags, Snapshot);
			}
		}
		updateHostContainer(current, workInProgress);
		bubbleProperties(workInProgress);
		return undefined;
	} else if (workInProgress.tag === HostComponent) {
		popHostContext(workInProgress);
		const rootContainerInstance = getRootHostContainer();
		const fiberType = workInProgress.type as HostType;
		if (current !== undefined && (workInProgress.stateNode as unknown) !== undefined) {
			updateHostComponent(current, workInProgress, fiberType, newProps as Props, rootContainerInstance);

			if (current.ref !== workInProgress.ref) {
				markRef(workInProgress);
			}
		} else {
			if ((newProps as unknown) === undefined) {
				invariant(
					(workInProgress.stateNode as unknown) !== undefined,
					'We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue.'
				);
				bubbleProperties(workInProgress);
				return undefined;
			}

			const currentHostContext = getHostContext();
			const wasHydrated = popHydrationState(workInProgress);
			if (wasHydrated) {
				if (prepareToHydrateHostInstance(workInProgress, rootContainerInstance, currentHostContext)) {
					markUpdate(workInProgress);
				}
			} else {
				const instance = createInstance(
					fiberType,
					newProps as Props,
					rootContainerInstance,
					currentHostContext,
					workInProgress
				);

				appendAllChildren(instance, workInProgress, false, false);
				workInProgress.stateNode = instance;

				if (
					finalizeInitialChildren(
						instance,
						fiberType,
						newProps as Props,
						rootContainerInstance,
						currentHostContext
					)
				) {
					markUpdate(workInProgress);
				}
			}

			if (workInProgress.ref !== undefined) {
				markRef(workInProgress);
			}
		}
		bubbleProperties(workInProgress);
		return undefined;
	} else if (workInProgress.tag === HostText) {
		const newText = newProps as string;
		if (current !== undefined && (workInProgress.stateNode as unknown) !== undefined) {
			const oldText = current.memoizedProps as string;
			updateHostText(current, workInProgress, oldText, newText);
		} else {
			if (typeOf(newText) !== 'string') {
				invariant(
					(workInProgress.stateNode as unknown) !== undefined,
					'We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue.'
				);
			}
			const rootContainerInstance = getRootHostContainer();
			const currentHostContext = getHostContext();
			const wasHydrated = popHydrationState(workInProgress);
			if (wasHydrated) {
				if (prepareToHydrateHostTextInstance(workInProgress)) {
					markUpdate(workInProgress);
				}
			} else {
				workInProgress.stateNode = createTextInstance(
					newText,
					rootContainerInstance,
					currentHostContext,
					workInProgress
				);
			}
		}
		bubbleProperties(workInProgress);
		return undefined;
	} else if (workInProgress.tag === Profiler) {
		const didBailout = bubbleProperties(workInProgress);
		if (!didBailout) {
			const OnRenderFlag = Update;
			const OnCommitFlag = Callback;
			const OnPostCommitFlag = Passive;
			const subtreeFlags = workInProgress.subtreeFlags;
			const flags = workInProgress.flags;
			let newFlags = flags;

			if (bit32.band(flags, PerformedWork) !== NoFlags || bit32.band(subtreeFlags, PerformedWork) !== NoFlags) {
				newFlags = bit32.bor(newFlags, OnRenderFlag);
			}

			if (
				bit32.band(flags, bit32.bor(LayoutMask, Deletion)) !== NoFlags ||
				bit32.band(subtreeFlags, bit32.bor(LayoutMask, Deletion)) !== NoFlags
			) {
				newFlags = bit32.bor(newFlags, OnCommitFlag);
			}

			if (bit32.band(flags, PassiveMask) !== NoFlags || bit32.band(subtreeFlags, PassiveMask) !== NoFlags) {
				newFlags = bit32.bor(newFlags, OnPostCommitFlag);
			}
			workInProgress.flags = newFlags;
		}

		return undefined;
	} else if (workInProgress.tag === SuspenseComponent) {
		popSuspenseContext(workInProgress);
		const nextState = workInProgress.memoizedState as SuspenseState | undefined;

		if (enableSuspenseServerRenderer) {
			if (nextState !== undefined && nextState.dehydrated !== undefined) {
				if (current === undefined) {
					const wasHydrated = popHydrationState(workInProgress);
					invariant(
						wasHydrated,
						'A dehydrated suspense component was completed without a hydrated node. This is probably a bug in React.'
					);
					prepareToHydrateHostSuspenseInstance(workInProgress);
					if (enableSchedulerTracing) {
						markSpawnedWork(OffscreenLane);
					}
					bubbleProperties(workInProgress);
					if (enableProfilerTimer) {
						if (bit32.band(workInProgress.mode, ProfileMode) !== NoMode) {
							const isTimedOutSuspense = nextState !== undefined;
							if (isTimedOutSuspense) {
								const primaryChildFragment = workInProgress.child;
								if (primaryChildFragment !== undefined) {
									workInProgress.treeBaseDuration = primaryChildFragment.treeBaseDuration as number;
								}
							}
						}
					}
					return undefined;
				} else {
					resetHydrationState();
					if (bit32.band(workInProgress.flags, DidCapture) === NoFlags) {
						workInProgress.memoizedState = undefined;
					}
					workInProgress.flags = bit32.bor(workInProgress.flags, Update);
					bubbleProperties(workInProgress);
					if (enableProfilerTimer) {
						if (bit32.band(workInProgress.mode, ProfileMode) !== NoMode) {
							const isTimedOutSuspense = nextState !== undefined;
							if (isTimedOutSuspense) {
								const primaryChildFragment = workInProgress.child;
								if (primaryChildFragment !== undefined) {
									workInProgress.treeBaseDuration =
										((workInProgress.treeBaseDuration as number | undefined) ?? 0) -
										((primaryChildFragment.treeBaseDuration as number | undefined) ?? 0);
								}
							}
						}
					}
					return undefined;
				}
			}
		}

		if (bit32.band(workInProgress.flags, DidCapture) !== NoFlags) {
			workInProgress.lanes = renderLanes;
			if (enableProfilerTimer && bit32.band(workInProgress.mode, ProfileMode) !== NoMode) {
				transferActualDuration(workInProgress);
			}
			return workInProgress;
		}

		const nextDidTimeout = nextState !== undefined;
		let prevDidTimeout = false;
		if (current === undefined) {
			if ((workInProgress.memoizedProps as { fallback?: defined }).fallback !== undefined) {
				popHydrationState(workInProgress);
			}
		} else {
			const prevState = current.memoizedState as SuspenseState | undefined;
			prevDidTimeout = prevState !== undefined;
		}

		if (nextDidTimeout && !prevDidTimeout) {
			if (bit32.band(workInProgress.mode, BlockingMode) !== NoMode) {
				const hasInvisibleChildContext =
					current === undefined &&
					(workInProgress.memoizedProps as { unstable_avoidThisFallback?: boolean })
						.unstable_avoidThisFallback !== true;
				if (
					hasInvisibleChildContext ||
					hasSuspenseContext(suspenseStackCursor.current, InvisibleParentSuspenseContext as SuspenseContext)
				) {
					renderDidSuspend();
				} else {
					renderDidSuspendDelayIfPossible();
				}
			}
		}

		if (supportsPersistence()) {
			if (nextDidTimeout) {
				workInProgress.flags = bit32.bor(workInProgress.flags, Update);
			}
		}
		if (supportsMutation()) {
			if (nextDidTimeout || prevDidTimeout) {
				workInProgress.flags = bit32.bor(workInProgress.flags, Update);
			}
		}
		if (
			enableSuspenseCallback &&
			(workInProgress.updateQueue as unknown) !== undefined &&
			(workInProgress.memoizedProps as { suspenseCallback?: defined }).suspenseCallback !== undefined
		) {
			workInProgress.flags = bit32.bor(workInProgress.flags, Update);
		}
		bubbleProperties(workInProgress);
		if (enableProfilerTimer && bit32.band(workInProgress.mode, ProfileMode) !== NoMode) {
			if (nextDidTimeout) {
				const primaryChildFragment = workInProgress.child;
				if (primaryChildFragment !== undefined) {
					workInProgress.treeBaseDuration =
						((workInProgress.treeBaseDuration as number | undefined) ?? 0) -
						((primaryChildFragment.treeBaseDuration as number | undefined) ?? 0);
				}
			}
		}
		return undefined;
	} else if (workInProgress.tag === HostPortal) {
		popHostContainer(workInProgress);
		updateHostContainer(current, workInProgress);
		if (current === undefined) {
			preparePortalMount((workInProgress.stateNode as { containerInfo: Container }).containerInfo);
		}
		bubbleProperties(workInProgress);
		return undefined;
	} else if (workInProgress.tag === ContextProvider) {
		popProvider(workInProgress);
		bubbleProperties(workInProgress);
		return undefined;
	} else if (workInProgress.tag === IncompleteClassComponent) {
		const component = workInProgress.type;
		if (isLegacyContextProvider(component)) {
			popLegacyContext(workInProgress);
		}
		bubbleProperties(workInProgress);
		return undefined;
	} else if (workInProgress.tag === SuspenseListComponent) {
		unimplemented('SuspenseListComponent');
	} else if (workInProgress.tag === FundamentalComponent) {
		unimplemented('FundamentalComponent');
	} else if (workInProgress.tag === ScopeComponent) {
		unimplemented('ScopeComponent');
	} else if (workInProgress.tag === Block) {
		unimplemented('Block');
	} else if (workInProgress.tag === OffscreenComponent || workInProgress.tag === LegacyHiddenComponent) {
		popRenderLanes(workInProgress);
		const nextState = workInProgress.memoizedState as OffscreenState | undefined;
		const nextIsHidden = nextState !== undefined;

		if (current !== undefined) {
			const prevState = current.memoizedState as OffscreenState | undefined;
			const prevIsHidden = prevState !== undefined;
			if (
				prevIsHidden !== nextIsHidden &&
				(newProps as { mode?: string }).mode !== 'unstable-defer-without-hiding'
			) {
				workInProgress.flags = bit32.bor(workInProgress.flags, Update);
			}
		}

		if (
			!nextIsHidden ||
			includesSomeLane(
				(ReactFiberWorkLoop as { subtreeRenderLanes: Lanes }).subtreeRenderLanes,
				OffscreenLane as Lane
			) ||
			bit32.band(workInProgress.mode, ConcurrentMode) === NoMode
		) {
			bubbleProperties(workInProgress);
		}

		return undefined;
	}

	invariant(
		false,
		'Unknown unit of work tag (%s). This error is likely caused by a bug in React. Please file an issue.',
		tostring(workInProgress.tag)
	);
	return undefined;
}

export default {
	completeWork,
};
