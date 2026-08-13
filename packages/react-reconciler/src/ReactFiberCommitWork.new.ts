import { __DEV__, __YOLO__ } from '@nrbx/react-globals';
import {
	console,
	describeError,
	getComponentName,
	invariant,
	ReactErrorUtils,
	ReactFeatureFlags,
} from '@nrbx/react-shared';
import type { Wakeable } from '@nrbx/react-shared';
import { tracing } from '@nrbx/scheduler';
import HostConfig, {
	type Container,
	type Instance,
	type Props,
	type SuspenseInstance,
	type TextInstance,
} from './ReactFiberHostConfig';
import {
	Block,
	ClassComponent,
	DehydratedFragment,
	ForwardRef,
	FunctionComponent,
	FundamentalComponent,
	HostComponent,
	HostPortal,
	HostRoot,
	HostText,
	IncompleteClassComponent,
	LegacyHiddenComponent,
	MemoComponent,
	OffscreenComponent,
	Profiler,
	ScopeComponent,
	SimpleMemoComponent,
	SuspenseComponent,
	SuspenseListComponent,
} from './ReactWorkTags';
import {
	Callback,
	ContentReset,
	LayoutMask,
	NoFlags,
	PassiveMask,
	Placement,
	Ref,
	Snapshot,
	Update,
} from './ReactFiberFlags';
import * as ReactCurrentFiber from './ReactCurrentFiber';
import { onCommitUnmount } from './ReactFiberDevToolsHook.new';
import { resolveDefaultProps } from './ReactFiberLazyComponent.new';
import {
	getCommitTime,
	recordLayoutEffectDuration,
	recordPassiveEffectDuration,
	startLayoutEffectTimer,
	startPassiveEffectTimer,
} from './ReactProfilerTimer.new';
import { ProfileMode } from './ReactTypeOfMode';
import { commitUpdateQueue } from './ReactUpdateQueue.new';
import {
	HasEffect as HookHasEffect,
	Layout as HookLayout,
	NoFlags as NoHookEffect,
	Passive as HookPassive,
	type HookFlags,
} from './ReactHookEffectTags';
import type { OffscreenState } from './ReactFiberOffscreenComponent';
import type { SuspenseState } from './ReactFiberSuspenseComponent.new';
import type { Fiber, FiberRoot, ReactPriorityLevel, UpdateQueue } from './types';

type UpdatePayload = Array<defined>;

type Effect = {
	tag: HookFlags;
	create: () => (() => void) | void;
	destroy: (() => void) | undefined;
	deps: Array<unknown> | undefined;
	next: Effect;
};

type FunctionComponentUpdateQueue = {
	lastEffect: Effect | undefined;
};

type ClassLikeInstance = {
	props: unknown;
	state: unknown;
	componentWillUnmount?: () => void;
	componentDidMount?: () => void;
	componentDidUpdate?: (prevProps: unknown, prevState: unknown, snapshot: unknown) => void;
	getSnapshotBeforeUpdate?: (prevProps: unknown, prevState: unknown) => unknown;
	__reactInternalSnapshotBeforeUpdate?: unknown;
	[key: string]: unknown;
};

type WakeableWithThen = Wakeable & {
	andThen: (resolve: () => void, reject: () => void) => void;
	__reactDoNotTraceInteractions?: boolean;
};

const {
	enableDoubleInvokingEffects,
	enableProfilerCommitHooks,
	enableProfilerTimer,
	enableSchedulerTracing,
	enableSuspenseCallback,
} = ReactFeatureFlags;

const { clearCaughtError, hasCaughtError, invokeGuardedCallback } = ReactErrorUtils;
const Schedule_tracing_wrap = tracing.unstable_wrap as unknown as (
	callback: (...args: Array<unknown>) => void
) => (...args: Array<unknown>) => void;

const currentDebugFiberInDEV = ReactCurrentFiber.current;
const resetCurrentDebugFiberInDEV = ReactCurrentFiber.resetCurrentFiber;
const setCurrentDebugFiberInDEV = ReactCurrentFiber.setCurrentFiber;

// Host-config functions are read lazily (at call time) because the renderer
// splices its implementation in via `initialize()` long after this module has
// been `require`d. See ReactFiberHostConfig for details.
function getPublicInstance(instance: Instance): unknown {
	return HostConfig.getPublicInstance(instance);
}
const supportsMutation = () => HostConfig.supportsMutation;
const supportsPersistence = () => HostConfig.supportsPersistence ?? false;
const supportsHydration = () => HostConfig.supportsHydration ?? false;
function commitMount(instance: Instance, type_: string, props: Props, internalInstanceHandle: Fiber): void {
	HostConfig.commitMount(instance, type_, props, internalInstanceHandle);
}
function commitUpdate(
	instance: Instance,
	updatePayload: UpdatePayload,
	type_: string,
	oldProps: Props,
	newProps: Props,
	internalInstanceHandle: Fiber
): void {
	HostConfig.commitUpdate(instance, updatePayload, type_, oldProps, newProps, internalInstanceHandle);
}
function resetTextContent(instance: Instance | Container): void {
	HostConfig.resetTextContent!(instance);
}
function commitTextUpdate(textInstance: TextInstance, oldText: string, newText: string): void {
	HostConfig.commitTextUpdate!(textInstance, oldText, newText);
}
function appendChild(parentInstance: Instance, child: Instance | TextInstance): void {
	HostConfig.appendChild(parentInstance, child);
}
function appendChildToContainer(container: Container, child: Instance | TextInstance): void {
	HostConfig.appendChildToContainer(container, child);
}
function insertBefore(
	parentInstance: Instance,
	child: Instance | TextInstance,
	beforeChild: Instance | TextInstance
): void {
	HostConfig.insertBefore(parentInstance, child, beforeChild);
}
function insertInContainerBefore(
	container: Container,
	child: Instance | TextInstance,
	beforeChild: Instance | TextInstance
): void {
	HostConfig.insertInContainerBefore(container, child, beforeChild);
}
function removeChild(parentInstance: Instance, child: Instance | TextInstance): void {
	HostConfig.removeChild(parentInstance, child);
}
function removeChildFromContainer(container: Container, child: Instance | TextInstance): void {
	HostConfig.removeChildFromContainer(container, child);
}
function hideInstance(instance: Instance): void {
	HostConfig.hideInstance!(instance);
}
function hideTextInstance(instance: TextInstance): void {
	HostConfig.hideTextInstance!(instance);
}
function unhideInstance(instance: Instance, props: Props): void {
	HostConfig.unhideInstance!(instance, props);
}
function unhideTextInstance(instance: TextInstance, text: string): void {
	HostConfig.unhideTextInstance!(instance, text);
}
function commitHydratedSuspenseInstance(suspenseInstance: SuspenseInstance): void {
	HostConfig.commitHydratedSuspenseInstance!(suspenseInstance);
}
function clearContainer(container: Container): void {
	HostConfig.clearContainer(container);
}

function unimplemented(message: string): never {
	print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	print(`UNIMPLEMENTED ERROR: ${tostring(message)}`);
	error(`FIXME (roblox): ${message} is unimplemented`, 2);
}

let runDepth = 0;
const MAX_RUN_DEPTH = 20;

function isCallable(value: unknown): boolean {
	if (typeOf(value) === 'function') {
		return true;
	}
	if (typeOf(value) === 'table') {
		const mt = getmetatable(value as object) as { __call?: unknown } | undefined;
		if (mt !== undefined && rawget(mt as object, '__call') !== undefined) {
			return true;
		}
		if ((value as { _isMockFunction?: boolean })._isMockFunction) {
			return true;
		}
	}
	return false;
}

let ReactFiberWorkLoop:
	| {
			resolveRetryWakeable: (boundaryFiber: Fiber, wakeable: Wakeable) => void;
			markCommitTimeOfFallback: () => void;
	  }
	| undefined;

function getSiblingModule(moduleName: string): unknown {
	const parent = (script as ModuleScript).Parent;
	invariant(parent !== undefined, 'Expected module parent to exist.');
	const child = parent.FindFirstChild(moduleName);
	invariant(child?.IsA('ModuleScript') === true, "Expected sibling module '%s' to exist.", moduleName);
	return require(child as ModuleScript);
}

function resolveRetryWakeable(boundaryFiber: Fiber, wakeable: Wakeable): void {
	if (ReactFiberWorkLoop === undefined) {
		ReactFiberWorkLoop = getSiblingModule('ReactFiberWorkLoop.new') as {
			resolveRetryWakeable: (fiber: Fiber, retryWakeable: Wakeable) => void;
			markCommitTimeOfFallback: () => void;
		};
	}
	ReactFiberWorkLoop.resolveRetryWakeable(boundaryFiber, wakeable);
}

function markCommitTimeOfFallback(): void {
	if (ReactFiberWorkLoop === undefined) {
		ReactFiberWorkLoop = getSiblingModule('ReactFiberWorkLoop.new') as {
			resolveRetryWakeable: (fiber: Fiber, retryWakeable: Wakeable) => void;
			markCommitTimeOfFallback: () => void;
		};
	}
	ReactFiberWorkLoop.markCommitTimeOfFallback();
}

let schedulePassiveEffectCallback = (): void => {
	console.warn(`ReactFiberCommitWork: schedulePassiveEffectCallback causes a dependency cycle\n${debug.traceback()}`);
};

let captureCommitPhaseError = (_rootFiber: Fiber, _sourceFiber: Fiber | undefined, errorValue: unknown): void => {
	console.warn('ReactFiberCommitWork: captureCommitPhaseError causes a dependency cycle');
	error(errorValue);
};

let didWarnAboutReassigningPropsRef: unknown;
const didWarnAboutReassigningProps = () => {
	if (didWarnAboutReassigningPropsRef === undefined) {
		didWarnAboutReassigningPropsRef = (
			getSiblingModule('ReactFiberBeginWork.new') as {
				didWarnAboutReassigningProps: unknown;
			}
		).didWarnAboutReassigningProps;
	}
	return didWarnAboutReassigningPropsRef;
};

let nearestProfilerOnStack: Fiber | undefined;

function callComponentWillUnmountWithTimer(current: Fiber, instance: ClassLikeInstance): void {
	instance.props = current.memoizedProps;
	instance.state = current.memoizedState;
	if (enableProfilerTimer && enableProfilerCommitHooks && bit32.band(current.mode, ProfileMode) !== 0) {
		const [ok, exception] = xpcall(() => {
			startLayoutEffectTimer();
			(instance.componentWillUnmount as () => void)();
		}, describeError);
		recordLayoutEffectDuration(current);
		if (!ok) {
			error(exception);
		}
	} else {
		(instance.componentWillUnmount as () => void)();
	}
}

function safelyCallComponentWillUnmount(
	current: Fiber,
	instance: ClassLikeInstance,
	nearestMountedAncestor: Fiber | undefined
): void {
	const [ok, errorValue] = xpcall(callComponentWillUnmountWithTimer, describeError, current, instance);
	if (!ok) {
		captureCommitPhaseError(current, nearestMountedAncestor, errorValue);
	}
}

function safelyDetachRef(current: Fiber, nearestMountedAncestor: Fiber): void {
	const ref = current.ref;
	if (ref !== undefined) {
		if (typeOf(ref) === 'function') {
			const [ok, errorValue] = xpcall(ref as (...args: Array<unknown>) => unknown, describeError);
			if (!ok) {
				captureCommitPhaseError(current, nearestMountedAncestor, errorValue);
			}
		} else {
			(ref as { current?: unknown }).current = undefined;
		}
	}
}

export function safelyCallDestroy(
	current: Fiber,
	nearestMountedAncestor: Fiber | undefined,
	destroy: () => void
): void {
	const [ok, errorValue] = xpcall(destroy, describeError);
	if (!ok) {
		captureCommitPhaseError(current, nearestMountedAncestor, errorValue);
	}
}

export function commitBeforeMutationLifeCycles(current: Fiber | undefined, finishedWork: Fiber): void {
	if (
		finishedWork.tag === FunctionComponent ||
		finishedWork.tag === ForwardRef ||
		finishedWork.tag === SimpleMemoComponent ||
		finishedWork.tag === Block
	) {
		return;
	} else if (finishedWork.tag === ClassComponent) {
		if (bit32.band(finishedWork.flags, Snapshot) !== 0) {
			if (current !== undefined) {
				const prevProps = current.memoizedProps;
				const prevState = current.memoizedState;
				const instance = finishedWork.stateNode as ClassLikeInstance;
				if (__DEV__) {
					if (
						(finishedWork.type as unknown) === (finishedWork.elementType as unknown) &&
						!didWarnAboutReassigningProps
					) {
						if (instance.props !== (finishedWork.memoizedProps as unknown)) {
							console.error(
								'Expected %s props to match memoized props before ' +
									'getSnapshotBeforeUpdate. ' +
									'This might either be because of a bug in React, or because ' +
									'a component reassigns its own `this.props`. ' +
									'Please file an issue.',
								getComponentName(finishedWork.type) || 'instance'
							);
						}
						if (instance.state !== (finishedWork.memoizedState as unknown)) {
							console.error(
								'Expected %s state to match memoized state before ' +
									'getSnapshotBeforeUpdate. ' +
									'This might either be because of a bug in React, or because ' +
									'a component reassigns its own `this.state`. ' +
									'Please file an issue.',
								getComponentName(finishedWork.type) || 'instance'
							);
						}
					}
				}
				const snapshot = (
					instance.getSnapshotBeforeUpdate as (prevProps: unknown, prevState: unknown) => unknown
				)(
					(finishedWork.elementType as unknown) === (finishedWork.type as unknown)
						? prevProps
						: resolveDefaultProps(finishedWork.type, prevProps),
					prevState
				);
				instance.__reactInternalSnapshotBeforeUpdate = snapshot;
			}
		}
		return;
	} else if (finishedWork.tag === HostRoot) {
		if (supportsMutation()) {
			if (bit32.band(finishedWork.flags, Snapshot) !== 0) {
				const root = finishedWork.stateNode as FiberRoot;
				clearContainer(root.containerInfo as Container);
			}
		}
		return;
	} else if (
		finishedWork.tag === HostComponent ||
		finishedWork.tag === HostText ||
		finishedWork.tag === HostPortal ||
		finishedWork.tag === IncompleteClassComponent
	) {
		return;
	}
	invariant(
		false,
		'This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue.'
	);
}

function commitHookEffectListUnmount(
	flags: HookFlags,
	finishedWork: Fiber,
	nearestMountedAncestor: Fiber | undefined
): void {
	const updateQueue = finishedWork.updateQueue as FunctionComponentUpdateQueue | undefined;
	const lastEffect = updateQueue !== undefined ? updateQueue.lastEffect : undefined;
	if (lastEffect !== undefined) {
		const firstEffect = lastEffect.next;
		let effect = firstEffect;
		do {
			if (bit32.band(effect.tag, flags) === flags) {
				const destroy = effect.destroy;
				effect.destroy = undefined;
				if (destroy !== undefined) {
					safelyCallDestroy(finishedWork, nearestMountedAncestor, destroy);
				}
			}
			effect = effect.next;
		} while (effect !== firstEffect);
	}
}

function commitHookEffectListMount(flags: HookFlags, finishedWork: Fiber): void {
	const updateQueue = finishedWork.updateQueue as FunctionComponentUpdateQueue | undefined;
	const lastEffect = updateQueue !== undefined ? updateQueue.lastEffect : undefined;
	if (lastEffect !== undefined) {
		const firstEffect = lastEffect.next;
		let effect = firstEffect;
		do {
			if (bit32.band(effect.tag, flags) === flags) {
				const create = effect.create;
				effect.destroy = create() as (() => void) | undefined;

				if (__DEV__) {
					const destroy = effect.destroy;
					if (destroy !== undefined && typeOf(destroy) !== 'function') {
						let addendum: string;
						if (destroy === undefined) {
							addendum =
								' You returned nil. If your effect does not require clean up, return nil (or nothing).';
						} else if (typeOf((destroy as { andThen?: unknown }).andThen) === 'function') {
							addendum =
								'\n\nIt looks like you wrote useEffect(Promise.new(function() --[[...]] end) or returned a Promise. ' +
								'Instead, write the async function inside your effect and call it immediately:\n\n' +
								'useEffect(function()\n' +
								'  function fetchData()\n' +
								'    -- You can await here\n' +
								'    local response = MyAPI.getData(someId):await()\n' +
								'    -- ...\n' +
								'  end\n' +
								'  fetchData()\n' +
								"end, {someId}) -- Or {} if effect doesn't need props or state\n\n" +
								'Learn more about data fetching with Hooks: https://reactjs.org/link/hooks-data-fetching';
						} else {
							addendum = ` You returned: ${destroy}`;
						}
						console.error(
							'An effect function must not return anything besides a function, which is used for clean-up.%s',
							addendum
						);
					}
				}
			}
			effect = effect.next;
		} while (effect !== firstEffect);
	}
}

function commitProfilerPassiveEffect(finishedRoot: FiberRoot, finishedWork: Fiber): void {
	if (enableProfilerTimer && enableProfilerCommitHooks) {
		if (finishedWork.tag === Profiler) {
			const passiveEffectDuration = (finishedWork.stateNode as { passiveEffectDuration: number })
				.passiveEffectDuration;
			const id = (finishedWork.memoizedProps as { id: unknown }).id;
			const onPostCommit = (finishedWork.memoizedProps as { onPostCommit?: unknown }).onPostCommit;
			const commitTime = getCommitTime();
			if (typeOf(onPostCommit) === 'function') {
				if (enableSchedulerTracing) {
					(onPostCommit as (...args: Array<unknown>) => void)(
						id,
						finishedWork.alternate === undefined ? 'mount' : 'update',
						passiveEffectDuration,
						commitTime,
						finishedRoot.memoizedInteractions
					);
				} else {
					(onPostCommit as (...args: Array<unknown>) => void)(
						id,
						finishedWork.alternate === undefined ? 'mount' : 'update',
						passiveEffectDuration,
						commitTime
					);
				}
			}
		}
	}
}

export function recursivelyCommitLayoutEffects(
	finishedWork: Fiber,
	finishedRoot: FiberRoot,
	_captureCommitPhaseError?: (
		sourceFiber: Fiber,
		nearestMountedAncestor: Fiber | undefined,
		errorValue: unknown
	) => void,
	_schedulePassiveEffectCallback?: () => void
): void {
	if (_captureCommitPhaseError !== undefined) {
		captureCommitPhaseError = _captureCommitPhaseError;
	}
	if (_schedulePassiveEffectCallback !== undefined) {
		schedulePassiveEffectCallback = _schedulePassiveEffectCallback;
	}

	const flags = finishedWork.flags;
	const tag = finishedWork.tag;

	if (tag === Profiler) {
		let prevProfilerOnStack: Fiber | undefined;
		if (enableProfilerTimer && enableProfilerCommitHooks) {
			prevProfilerOnStack = nearestProfilerOnStack;
			nearestProfilerOnStack = finishedWork;
		}

		let child = finishedWork.child;
		while (child !== undefined) {
			const primarySubtreeFlags = bit32.band(finishedWork.subtreeFlags, LayoutMask);
			if (primarySubtreeFlags !== NoFlags) {
				if (__DEV__) {
					const prevCurrentFiberInDEV = currentDebugFiberInDEV;
					setCurrentDebugFiberInDEV(child);
					invokeGuardedCallback(
						undefined,
						recursivelyCommitLayoutEffects,
						undefined,
						child,
						finishedRoot,
						captureCommitPhaseError,
						schedulePassiveEffectCallback
					);
					if (hasCaughtError()) {
						const errorValue = clearCaughtError();
						captureCommitPhaseError(child, finishedWork, errorValue);
					}
					if (prevCurrentFiberInDEV !== undefined) {
						setCurrentDebugFiberInDEV(prevCurrentFiberInDEV);
					} else {
						resetCurrentDebugFiberInDEV();
					}
				} else {
					const [ok, errorValue] = xpcall(
						recursivelyCommitLayoutEffects,
						describeError,
						child,
						finishedRoot,
						captureCommitPhaseError,
						schedulePassiveEffectCallback
					);
					if (!ok) {
						captureCommitPhaseError(child, finishedWork, errorValue);
					}
				}
			}
			child = child.sibling;
		}

		const primaryFlags = bit32.band(flags, bit32.bor(Update, Callback));
		if (primaryFlags !== NoFlags) {
			if (enableProfilerTimer) {
				if (__DEV__) {
					const prevCurrentFiberInDEV = currentDebugFiberInDEV;
					setCurrentDebugFiberInDEV(finishedWork);
					invokeGuardedCallback(
						undefined,
						commitLayoutEffectsForProfiler,
						undefined,
						finishedWork,
						finishedRoot
					);
					if (hasCaughtError()) {
						const errorValue = clearCaughtError();
						captureCommitPhaseError(finishedWork, finishedWork.return_, errorValue);
					}
					if (prevCurrentFiberInDEV !== undefined) {
						setCurrentDebugFiberInDEV(prevCurrentFiberInDEV);
					} else {
						resetCurrentDebugFiberInDEV();
					}
				} else {
					const [ok, errorValue] = xpcall(
						commitLayoutEffectsForProfiler,
						describeError,
						finishedWork,
						finishedRoot
					);
					if (!ok) {
						captureCommitPhaseError(finishedWork, finishedWork.return_, errorValue);
					}
				}
			}
		}

		if (enableProfilerTimer && enableProfilerCommitHooks) {
			if (prevProfilerOnStack !== undefined) {
				(prevProfilerOnStack.stateNode as { effectDuration: number }).effectDuration += (
					finishedWork.stateNode as { effectDuration: number }
				).effectDuration;
			}
			nearestProfilerOnStack = prevProfilerOnStack;
		}
	} else {
		let child = finishedWork.child;
		while (child !== undefined) {
			const primarySubtreeFlags = bit32.band(finishedWork.subtreeFlags, LayoutMask);
			if (primarySubtreeFlags !== NoFlags) {
				if (__DEV__) {
					const prevCurrentFiberInDEV = ReactCurrentFiber.current;
					setCurrentDebugFiberInDEV(child);
					if (runDepth < MAX_RUN_DEPTH) {
						runDepth += 1;
						invokeGuardedCallback(
							undefined,
							recursivelyCommitLayoutEffects,
							undefined,
							child,
							finishedRoot,
							captureCommitPhaseError,
							schedulePassiveEffectCallback
						);
						runDepth -= 1;

						if (hasCaughtError()) {
							const errorValue = clearCaughtError();
							captureCommitPhaseError(child, finishedWork, errorValue);
						}
					} else {
						recursivelyCommitLayoutEffects(
							child,
							finishedRoot,
							captureCommitPhaseError,
							schedulePassiveEffectCallback
						);
					}
					if (prevCurrentFiberInDEV !== undefined) {
						setCurrentDebugFiberInDEV(prevCurrentFiberInDEV);
					} else {
						resetCurrentDebugFiberInDEV();
					}
				} else {
					let ok: boolean;
					let errorValue: unknown;
					if (!__YOLO__ && runDepth < MAX_RUN_DEPTH) {
						runDepth += 1;
						[ok, errorValue] = xpcall(
							recursivelyCommitLayoutEffects,
							describeError,
							child,
							finishedRoot,
							captureCommitPhaseError,
							schedulePassiveEffectCallback
						);
						runDepth -= 1;
					} else {
						ok = true;
						recursivelyCommitLayoutEffects(
							child,
							finishedRoot,
							captureCommitPhaseError,
							schedulePassiveEffectCallback
						);
					}
					if (!ok) {
						captureCommitPhaseError(child, finishedWork, errorValue);
					}
				}
			}
			child = child.sibling;
		}

		const primaryFlags = bit32.band(flags, bit32.bor(Update, Callback));
		if (primaryFlags !== NoFlags) {
			if (tag === FunctionComponent || tag === ForwardRef || tag === SimpleMemoComponent || tag === Block) {
				if (
					enableProfilerTimer &&
					enableProfilerCommitHooks &&
					bit32.band(finishedWork.mode, ProfileMode) !== 0
				) {
					const [ok, errorValue] = xpcall(() => {
						startLayoutEffectTimer();
						commitHookEffectListMount(bit32.bor(HookLayout, HookHasEffect), finishedWork);
					}, describeError);
					recordLayoutEffectDuration(finishedWork);
					if (!ok) {
						error(errorValue);
					}
				} else {
					commitHookEffectListMount(bit32.bor(HookLayout, HookHasEffect), finishedWork);
				}

				if (bit32.band(finishedWork.subtreeFlags, PassiveMask) !== NoFlags) {
					schedulePassiveEffectCallback();
				}
			} else if (tag === ClassComponent) {
				commitLayoutEffectsForClassComponent(finishedWork);
			} else if (tag === HostRoot) {
				commitLayoutEffectsForHostRoot(finishedWork);
			} else if (tag === HostComponent) {
				commitLayoutEffectsForHostComponent(finishedWork);
			} else if (tag === SuspenseComponent) {
				commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
			} else if (
				tag === FundamentalComponent ||
				tag === HostPortal ||
				tag === HostText ||
				tag === IncompleteClassComponent ||
				tag === LegacyHiddenComponent ||
				tag === OffscreenComponent ||
				tag === ScopeComponent ||
				tag === SuspenseListComponent
			) {
				// noop
			} else {
				invariant(
					false,
					'This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue.'
				);
			}
		}

		if (bit32.band(flags, Ref) !== 0) {
			commitAttachRef(finishedWork);
		}
	}
}

function commitLayoutEffectsForProfiler(finishedWork: Fiber, finishedRoot: FiberRoot): void {
	if (enableProfilerTimer) {
		const flags = finishedWork.flags;
		const current = finishedWork.alternate;
		const onCommit = (finishedWork.memoizedProps as { onCommit?: unknown }).onCommit;
		const onRender = (finishedWork.memoizedProps as { onRender?: unknown }).onRender;
		const effectDuration = (finishedWork.stateNode as { effectDuration: number }).effectDuration;
		const commitTime = getCommitTime();
		const OnRenderFlag = Update;
		const OnCommitFlag = Callback;

		if (bit32.band(flags, OnRenderFlag) !== NoFlags && isCallable(onRender)) {
			if (enableSchedulerTracing) {
				(onRender as (...args: Array<unknown>) => void)(
					(finishedWork.memoizedProps as { id: unknown }).id,
					current === undefined ? 'mount' : 'update',
					finishedWork.actualDuration,
					finishedWork.treeBaseDuration,
					finishedWork.actualStartTime,
					commitTime,
					finishedRoot.memoizedInteractions
				);
			} else {
				(onRender as (...args: Array<unknown>) => void)(
					(finishedWork.memoizedProps as { id: unknown }).id,
					current === undefined ? 'mount' : 'update',
					finishedWork.actualDuration,
					finishedWork.treeBaseDuration,
					finishedWork.actualStartTime,
					commitTime
				);
			}
		}

		if (enableProfilerCommitHooks) {
			if (bit32.band(flags, OnCommitFlag) !== NoFlags && isCallable(onCommit)) {
				if (enableSchedulerTracing) {
					(onCommit as (...args: Array<unknown>) => void)(
						(finishedWork.memoizedProps as { id: unknown }).id,
						current === undefined ? 'mount' : 'update',
						effectDuration,
						commitTime,
						finishedRoot.memoizedInteractions
					);
				} else {
					(onCommit as (...args: Array<unknown>) => void)(
						(finishedWork.memoizedProps as { id: unknown }).id,
						current === undefined ? 'mount' : 'update',
						effectDuration,
						commitTime
					);
				}
			}
		}
	}
}

function commitLayoutEffectsForClassComponent(finishedWork: Fiber): void {
	const instance = finishedWork.stateNode as ClassLikeInstance;
	const current = finishedWork.alternate;
	if (bit32.band(finishedWork.flags, Update) !== 0) {
		if (current === undefined) {
			if (__DEV__) {
				if (
					(finishedWork.type as unknown) === (finishedWork.elementType as unknown) &&
					!didWarnAboutReassigningProps
				) {
					if (instance.props !== (finishedWork.memoizedProps as unknown)) {
						console.error(
							'Expected %s props to match memoized props before componentDidMount. ' +
								'This might either be because of a bug in React, or because ' +
								'a component reassigns its own `this.props`. ' +
								'Please file an issue.',
							getComponentName(finishedWork.type) || 'instance'
						);
					}
					if (instance.state !== (finishedWork.memoizedState as unknown)) {
						console.error(
							'Expected %s state to match memoized state before componentDidMount. ' +
								'This might either be because of a bug in React, or because ' +
								'a component reassigns its own `this.state`. ' +
								'Please file an issue.',
							getComponentName(finishedWork.type) || 'instance'
						);
					}
				}
			}
			if (enableProfilerTimer && enableProfilerCommitHooks && bit32.band(finishedWork.mode, ProfileMode) !== 0) {
				const [ok, result] = xpcall(() => {
					startLayoutEffectTimer();
					(instance.componentDidMount as () => void)();
				}, describeError);
				recordLayoutEffectDuration(finishedWork);
				if (!ok) {
					error(result);
				}
			} else {
				(instance.componentDidMount as () => void)();
			}
		} else {
			const prevProps =
				(finishedWork.elementType as unknown) === (finishedWork.type as unknown)
					? current.memoizedProps
					: resolveDefaultProps(finishedWork.type, current.memoizedProps);
			const prevState = current.memoizedState;
			if (__DEV__) {
				if (
					(finishedWork.type as unknown) === (finishedWork.elementType as unknown) &&
					!didWarnAboutReassigningProps
				) {
					if (instance.props !== (finishedWork.memoizedProps as unknown)) {
						console.error(
							'Expected %s props to match memoized props before componentDidUpdate. ' +
								'This might either be because of a bug in React, or because ' +
								'a component reassigns its own `this.props`. ' +
								'Please file an issue.',
							getComponentName(finishedWork.type) || 'instance'
						);
					}
					if (instance.state !== (finishedWork.memoizedState as unknown)) {
						console.error(
							'Expected %s state to match memoized state before componentDidUpdate. ' +
								'This might either be because of a bug in React, or because ' +
								'a component reassigns its own `this.state`. ' +
								'Please file an issue.',
							getComponentName(finishedWork.type) || 'instance'
						);
					}
				}
			}
			if (enableProfilerTimer && enableProfilerCommitHooks && bit32.band(finishedWork.mode, ProfileMode) !== 0) {
				const [ok, result] = xpcall(() => {
					startLayoutEffectTimer();
					(
						instance.componentDidUpdate as (
							prevProps: unknown,
							prevState: unknown,
							snapshot: unknown
						) => void
					)(prevProps, prevState, instance.__reactInternalSnapshotBeforeUpdate);
				}, describeError);
				recordLayoutEffectDuration(finishedWork);
				if (!ok) {
					error(result);
				}
			} else {
				(instance.componentDidUpdate as (prevProps: unknown, prevState: unknown, snapshot: unknown) => void)(
					prevProps,
					prevState,
					instance.__reactInternalSnapshotBeforeUpdate
				);
			}
		}
	}

	const updateQueue = finishedWork.updateQueue as UpdateQueue<unknown> | undefined;
	if (updateQueue !== undefined) {
		if (__DEV__) {
			if (
				(finishedWork.type as unknown) === (finishedWork.elementType as unknown) &&
				!didWarnAboutReassigningProps
			) {
				if (instance.props !== (finishedWork.memoizedProps as unknown)) {
					console.error(
						'Expected %s props to match memoized props before processing the update queue. ' +
							'This might either be because of a bug in React, or because ' +
							'a component reassigns its own `this.props`. ' +
							'Please file an issue.',
						getComponentName(finishedWork.type) || 'instance'
					);
				}
				if (instance.state !== (finishedWork.memoizedState as unknown)) {
					console.error(
						'Expected %s state to match memoized state before processing the update queue. ' +
							'This might either be because of a bug in React, or because ' +
							'a component reassigns its own `this.state`. ' +
							'Please file an issue.',
						getComponentName(finishedWork.type) || 'instance'
					);
				}
			}
		}
		commitUpdateQueue(finishedWork, updateQueue, instance);
	}
}

function commitLayoutEffectsForHostRoot(finishedWork: Fiber): void {
	const updateQueue = finishedWork.updateQueue as UpdateQueue<unknown> | undefined;
	if (updateQueue !== undefined) {
		let instance: unknown;
		if (finishedWork.child !== undefined) {
			const child = finishedWork.child;
			if (child.tag === HostComponent) {
				instance = getPublicInstance(child.stateNode as Instance);
			} else if (child.tag === ClassComponent) {
				instance = child.stateNode;
			}
		}
		commitUpdateQueue(finishedWork, updateQueue, instance);
	}
}

function commitLayoutEffectsForHostComponent(finishedWork: Fiber): void {
	const instance = finishedWork.stateNode as Instance;
	const current = finishedWork.alternate;
	if (current === undefined && bit32.band(finishedWork.flags, Update) !== 0) {
		const type_ = finishedWork.type as string;
		const props = finishedWork.memoizedProps;
		commitMount(instance, type_, props, finishedWork);
	}
}

function hideOrUnhideAllChildren(finishedWork: Fiber, isHidden: boolean): void {
	if (supportsMutation()) {
		let node = finishedWork;
		while (true) {
			if (node.tag === HostComponent) {
				const instance = node.stateNode as Instance;
				if (isHidden) {
					hideInstance(instance);
				} else {
					unhideInstance(node.stateNode as Instance, node.memoizedProps);
				}
			} else if (node.tag === HostText) {
				const instance = node.stateNode as TextInstance;
				if (isHidden) {
					hideTextInstance(instance);
				} else {
					unhideTextInstance(instance, node.memoizedProps as string);
				}
			} else if (
				(node.tag === OffscreenComponent || node.tag === LegacyHiddenComponent) &&
				(node.memoizedState as OffscreenState | undefined) !== undefined &&
				node !== finishedWork
			) {
				// skip hidden nested subtree
			} else if (node.child !== undefined) {
				node.child.return_ = node;
				node = node.child;
				continue;
			}
			if (node === finishedWork) {
				return;
			}
			while (node.sibling === undefined) {
				if (node.return_ === undefined || node.return_ === finishedWork) {
					return;
				}
				node = node.return_;
			}
			node.sibling.return_ = node.return_;
			node = node.sibling;
		}
	}
}

export function commitAttachRef(finishedWork: Fiber): void {
	const ref = finishedWork.ref;
	if (ref !== undefined) {
		const instance = finishedWork.stateNode;
		let instanceToUse: unknown;
		if (finishedWork.tag === HostComponent) {
			instanceToUse = getPublicInstance(instance as Instance);
		} else {
			instanceToUse = instance;
		}

		if (typeOf(ref) === 'function') {
			(ref as (value: unknown) => void)(instanceToUse);
		} else {
			if (__DEV__) {
				if (typeOf(ref) !== 'table') {
					console.error(
						'Unexpected ref object provided for %s. Use either a ref-setter function or React.createRef().',
						getComponentName(finishedWork.type) || 'instance'
					);
					return;
				}
			}
			(ref as { current?: unknown }).current = instanceToUse;
		}
	}
}

export function commitDetachRef(current: Fiber): void {
	const currentRef = current.ref;
	if (currentRef !== undefined) {
		if (typeOf(currentRef) === 'function') {
			(currentRef as (value: unknown) => void)(undefined);
		} else {
			(currentRef as { current?: unknown }).current = undefined;
		}
	}
}

function commitUnmount(
	finishedRoot: FiberRoot,
	current: Fiber,
	nearestMountedAncestor: Fiber,
	renderPriorityLevel: ReactPriorityLevel
): void {
	onCommitUnmount(current);

	if (
		current.tag === FunctionComponent ||
		current.tag === ForwardRef ||
		current.tag === MemoComponent ||
		current.tag === SimpleMemoComponent ||
		current.tag === Block
	) {
		const updateQueue = current.updateQueue as FunctionComponentUpdateQueue | undefined;
		if (updateQueue !== undefined) {
			const lastEffect = updateQueue.lastEffect;
			if (lastEffect !== undefined) {
				const firstEffect = lastEffect.next;
				let effect = firstEffect;
				do {
					if (effect.destroy !== undefined) {
						if (bit32.band(effect.tag, HookLayout) !== NoHookEffect) {
							if (
								enableProfilerTimer &&
								enableProfilerCommitHooks &&
								bit32.band(current.mode, ProfileMode) !== 0
							) {
								startLayoutEffectTimer();
								safelyCallDestroy(current, nearestMountedAncestor, effect.destroy);
								recordLayoutEffectDuration(current);
							} else {
								safelyCallDestroy(current, nearestMountedAncestor, effect.destroy);
							}
						}
					}
					effect = effect.next;
				} while (effect !== firstEffect);
			}
		}
		return;
	} else if (current.tag === ClassComponent) {
		safelyDetachRef(current, nearestMountedAncestor);
		const instance = current.stateNode as ClassLikeInstance;
		if (typeOf(instance.componentWillUnmount) === 'function') {
			safelyCallComponentWillUnmount(current, instance, nearestMountedAncestor);
		}
		return;
	} else if (current.tag === HostComponent) {
		safelyDetachRef(current, nearestMountedAncestor);
		return;
	} else if (current.tag === HostPortal) {
		if (supportsMutation()) {
			unmountHostComponents(finishedRoot, current, nearestMountedAncestor, renderPriorityLevel);
		} else if (supportsPersistence()) {
			unimplemented('emptyPortalContainer');
		}
		return;
	}
}

function commitNestedUnmounts(
	finishedRoot: FiberRoot,
	root: Fiber,
	nearestMountedAncestor: Fiber,
	renderPriorityLevel: ReactPriorityLevel
): void {
	let node = root;
	while (true) {
		commitUnmount(finishedRoot, node, nearestMountedAncestor, renderPriorityLevel);
		if (node.child !== undefined && (!supportsMutation() || node.tag !== HostPortal)) {
			node.child.return_ = node;
			node = node.child;
			continue;
		}
		if (node === root) {
			return;
		}
		while (node.sibling === undefined) {
			if (node.return_ === undefined || node.return_ === root) {
				return;
			}
			node = node.return_;
		}
		node.sibling.return_ = node.return_;
		node = node.sibling;
	}
}

function detachFiberMutation(fiber: Fiber): void {
	const alternate = fiber.alternate;
	if (alternate !== undefined) {
		alternate.return_ = undefined;
		fiber.alternate = undefined;
	}
	fiber.return_ = undefined;
}

function getHostParentFiber(fiber: Fiber): Fiber {
	let parent = fiber.return_;
	while (parent !== undefined) {
		if (isHostParent(parent)) {
			return parent;
		}
		parent = parent.return_;
	}
	error('Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue.');
}

function isHostParent(fiber: Fiber): boolean {
	return fiber.tag === HostComponent || fiber.tag === HostRoot || fiber.tag === HostPortal;
}

function getHostSibling(fiber: Fiber): Instance | TextInstance | undefined {
	let node = fiber;
	while (true) {
		let continueOuter = false;
		while (node.sibling === undefined) {
			if (node.return_ === undefined || isHostParent(node.return_)) {
				return undefined;
			}
			node = node.return_;
		}
		node.sibling.return_ = node.return_;
		node = node.sibling;

		while (node.tag !== HostComponent && node.tag !== HostText && node.tag !== DehydratedFragment) {
			if (bit32.band(node.flags, Placement) !== 0) {
				continueOuter = true;
				break;
			}
			if (node.child === undefined || node.tag === HostPortal) {
				continueOuter = true;
				break;
			} else {
				node.child.return_ = node;
				node = node.child;
			}
		}
		if (continueOuter) {
			continue;
		}
		if (bit32.band(node.flags, Placement) === 0) {
			return node.stateNode as Instance | TextInstance;
		}
	}
}

export function commitPlacement(finishedWork: Fiber): void {
	if (!supportsMutation()) {
		return;
	}

	const parentFiber = getHostParentFiber(finishedWork);
	let parent: Instance | Container;
	let isContainer: boolean;
	const parentStateNode = parentFiber.stateNode;
	if (parentFiber.tag === HostComponent) {
		parent = parentStateNode as Instance;
		isContainer = false;
	} else if (parentFiber.tag === HostRoot) {
		parent = (parentStateNode as FiberRoot).containerInfo as Container;
		isContainer = true;
	} else if (parentFiber.tag === HostPortal) {
		parent = (parentStateNode as { containerInfo: Container }).containerInfo;
		isContainer = true;
	} else {
		invariant(
			false,
			'Invalid host parent fiber. This error is likely caused by a bug in React. Please file an issue.'
		);
	}

	if (bit32.band(parentFiber.flags, ContentReset) !== 0) {
		resetTextContent(parent);
		parentFiber.flags = bit32.band(parentFiber.flags, bit32.bnot(ContentReset));
	}

	const before = getHostSibling(finishedWork);
	if (isContainer) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent as Container);
	} else {
		insertOrAppendPlacementNode(finishedWork, before, parent as Instance);
	}
}

function insertOrAppendPlacementNodeIntoContainer(
	node: Fiber,
	before: Instance | TextInstance | undefined,
	parent: Container
): void {
	const tag = node.tag;
	const isHost = tag === HostComponent || tag === HostText;
	if (isHost) {
		const stateNode = node.stateNode as Instance | TextInstance;
		if (before !== undefined) {
			insertInContainerBefore(parent, stateNode, before);
		} else {
			appendChildToContainer(parent, stateNode);
		}
	} else if (tag === HostPortal) {
		return;
	} else {
		const child = node.child;
		if (child !== undefined) {
			insertOrAppendPlacementNodeIntoContainer(child, before, parent);
			let sibling = child.sibling;
			while (sibling !== undefined) {
				insertOrAppendPlacementNodeIntoContainer(sibling, before, parent);
				sibling = sibling.sibling;
			}
		}
	}
}

function insertOrAppendPlacementNode(node: Fiber, before: Instance | TextInstance | undefined, parent: Instance): void {
	const tag = node.tag;
	const isHost = tag === HostComponent || tag === HostText;
	if (isHost) {
		const stateNode = node.stateNode as Instance | TextInstance;
		if (before !== undefined) {
			insertBefore(parent, stateNode, before);
		} else {
			appendChild(parent, stateNode);
		}
	} else if (tag === HostPortal) {
		return;
	} else {
		const child = node.child;
		if (child !== undefined) {
			insertOrAppendPlacementNode(child, before, parent);
			let sibling = child.sibling;
			while (sibling !== undefined) {
				insertOrAppendPlacementNode(sibling, before, parent);
				sibling = sibling.sibling;
			}
		}
	}
}

function unmountHostComponents(
	finishedRoot: FiberRoot,
	current: Fiber,
	nearestMountedAncestor: Fiber,
	renderPriorityLevel: ReactPriorityLevel
): void {
	let node = current;
	let currentParentIsValid = false;
	let currentParent: Instance | Container | undefined;
	let currentParentIsContainer = false;

	while (true) {
		if (!currentParentIsValid) {
			let parent = node.return_;
			while (true) {
				if (parent === undefined) {
					error(
						'Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue.'
					);
				}
				const parentStateNode = parent.stateNode;
				if (parent.tag === HostComponent) {
					currentParent = parentStateNode as Instance;
					currentParentIsContainer = false;
					break;
				} else if (parent.tag === HostRoot) {
					currentParent = (parentStateNode as FiberRoot).containerInfo as Container;
					currentParentIsContainer = true;
					break;
				} else if (parent.tag === HostPortal) {
					currentParent = (parentStateNode as { containerInfo: Container }).containerInfo;
					currentParentIsContainer = true;
					break;
				}
				parent = parent.return_;
			}
			currentParentIsValid = true;
		}

		if (node.tag === HostComponent || node.tag === HostText) {
			commitNestedUnmounts(finishedRoot, node, nearestMountedAncestor, renderPriorityLevel);
			if (currentParentIsContainer) {
				removeChildFromContainer(currentParent as Container, node.stateNode as Instance | TextInstance);
			} else {
				removeChild(currentParent as Instance, node.stateNode as Instance | TextInstance);
			}
		} else if (node.tag === HostPortal) {
			if (node.child !== undefined) {
				currentParent = (node.stateNode as { containerInfo: Container }).containerInfo;
				currentParentIsContainer = true;
				node.child.return_ = node;
				node = node.child;
				continue;
			}
		} else {
			commitUnmount(finishedRoot, node, nearestMountedAncestor, renderPriorityLevel);
			if (node.child !== undefined) {
				node.child.return_ = node;
				node = node.child;
				continue;
			}
		}

		if (node === current) {
			return;
		}

		while (node.sibling === undefined) {
			if (node.return_ === undefined || node.return_ === current) {
				return;
			}
			node = node.return_;
			if (node.tag === HostPortal) {
				currentParentIsValid = false;
			}
		}
		node.sibling.return_ = node.return_;
		node = node.sibling;
	}
}

export function commitDeletion(
	finishedRoot: FiberRoot,
	current: Fiber,
	nearestMountedAncestor: Fiber,
	renderPriorityLevel: ReactPriorityLevel
): void {
	unmountHostComponents(finishedRoot, current, nearestMountedAncestor, renderPriorityLevel);
	const alternate = current.alternate;
	detachFiberMutation(current);
	if (alternate !== undefined) {
		detachFiberMutation(alternate);
	}
}

export function commitWork(current: Fiber | undefined, finishedWork: Fiber): void {
	if (
		finishedWork.tag === FunctionComponent ||
		finishedWork.tag === ForwardRef ||
		finishedWork.tag === MemoComponent ||
		finishedWork.tag === SimpleMemoComponent ||
		finishedWork.tag === Block
	) {
		if (enableProfilerTimer && enableProfilerCommitHooks && bit32.band(finishedWork.mode, ProfileMode) !== 0) {
			const [ok, result] = xpcall(() => {
				startLayoutEffectTimer();
				commitHookEffectListUnmount(bit32.bor(HookLayout, HookHasEffect), finishedWork, finishedWork.return_);
			}, describeError);
			recordLayoutEffectDuration(finishedWork);
			if (!ok) {
				error(result);
			}
		} else {
			commitHookEffectListUnmount(bit32.bor(HookLayout, HookHasEffect), finishedWork, finishedWork.return_);
		}
		return;
	} else if (finishedWork.tag === ClassComponent) {
		return;
	} else if (finishedWork.tag === HostComponent) {
		const instance = finishedWork.stateNode as Instance | undefined;
		if (instance !== undefined) {
			const newProps = finishedWork.memoizedProps;
			const oldProps = current !== undefined ? current.memoizedProps : newProps;
			const type_ = finishedWork.type as string;
			const updatePayload = finishedWork.updateQueue as UpdatePayload | undefined;
			finishedWork.updateQueue = undefined;
			if (updatePayload !== undefined) {
				commitUpdate(instance, updatePayload, type_, oldProps, newProps, finishedWork);
			}
		}
		return;
	} else if (finishedWork.tag === HostText) {
		invariant(
			(finishedWork.stateNode as unknown) !== undefined,
			'This should have a text node initialized. This error is likely caused by a bug in React. Please file an issue.'
		);
		const textInstance = finishedWork.stateNode as TextInstance;
		const newText = finishedWork.memoizedProps as string;
		let oldText = undefined as unknown as string;
		if (current !== undefined) {
			oldText = current.memoizedProps as string;
			oldText = newText;
		}
		commitTextUpdate(textInstance, oldText, newText);
		return;
	} else if (finishedWork.tag === HostRoot) {
		if (supportsHydration()) {
			const root = finishedWork.stateNode as FiberRoot;
			if (root.hydrate) {
				root.hydrate = false;
				unimplemented('commitWork: HostRoot: commitHydratedContainer');
			}
		}
		return;
	} else if (finishedWork.tag === Profiler) {
		return;
	} else if (finishedWork.tag === SuspenseComponent) {
		commitSuspenseComponent(finishedWork);
		attachSuspenseRetryListeners(finishedWork);
		return;
	} else if (finishedWork.tag === SuspenseListComponent) {
		unimplemented('commitWork: SuspenseListComponent');
	} else if (finishedWork.tag === IncompleteClassComponent) {
		return;
	} else if (finishedWork.tag === OffscreenComponent || finishedWork.tag === LegacyHiddenComponent) {
		const newState = finishedWork.memoizedState as OffscreenState | undefined;
		const isHidden = newState !== undefined;
		hideOrUnhideAllChildren(finishedWork, isHidden);
		return;
	}
	invariant(
		false,
		'This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue.'
	);
}

function commitSuspenseComponent(finishedWork: Fiber): void {
	const newState = finishedWork.memoizedState as SuspenseState | undefined;
	if (newState !== undefined) {
		markCommitTimeOfFallback();
		if (supportsMutation()) {
			const primaryChildParent = finishedWork.child as Fiber;
			hideOrUnhideAllChildren(primaryChildParent, true);
		}
	}

	if (enableSuspenseCallback && newState !== undefined) {
		const suspenseCallback = (finishedWork.memoizedProps as { suspenseCallback?: unknown }).suspenseCallback;
		if (typeOf(suspenseCallback) === 'function') {
			const wakeables = finishedWork.updateQueue as Set<Wakeable> | undefined;
			if (wakeables !== undefined) {
				(suspenseCallback as (wakeablesSet: Set<Wakeable>) => void)(wakeables);
			}
		} else if (__DEV__) {
			if (suspenseCallback !== undefined) {
				console.error('Unexpected type for suspenseCallback: %s', tostring(suspenseCallback));
			}
		}
	}
}

function commitSuspenseHydrationCallbacks(finishedRoot: FiberRoot, finishedWork: Fiber): void {
	if (!supportsHydration()) {
		return;
	}
	const newState = finishedWork.memoizedState as SuspenseState | undefined;
	if (newState === undefined) {
		const current = finishedWork.alternate;
		if (current !== undefined) {
			const prevState = current.memoizedState as SuspenseState | undefined;
			if (prevState !== undefined) {
				const suspenseInstance = (prevState as SuspenseState).dehydrated;
				if (suspenseInstance !== undefined) {
					commitHydratedSuspenseInstance(suspenseInstance);
					if (enableSuspenseCallback) {
						const hydrationCallbacks = finishedRoot.hydrationCallbacks;
						if (hydrationCallbacks !== undefined) {
							const onHydrated = hydrationCallbacks.onHydrated;
							if (onHydrated) {
								onHydrated(suspenseInstance);
							}
						}
					}
				}
			}
		}
	}
}

function attachSuspenseRetryListeners(finishedWork: Fiber): void {
	const wakeables = finishedWork.updateQueue as Set<Wakeable> | undefined;
	if (wakeables !== undefined) {
		finishedWork.updateQueue = undefined;
		let retryCache = finishedWork.stateNode as Set<Wakeable> | undefined;
		if (retryCache === undefined) {
			finishedWork.stateNode = new Set<Wakeable>();
			retryCache = finishedWork.stateNode as Set<Wakeable>;
		}
		for (const wakeable of wakeables) {
			let retry = () => resolveRetryWakeable(finishedWork, wakeable);
			if (!retryCache.has(wakeable)) {
				if (enableSchedulerTracing) {
					if ((wakeable as WakeableWithThen).__reactDoNotTraceInteractions !== true) {
						retry = Schedule_tracing_wrap(retry);
					}
				}
				retryCache.add(wakeable);
				(wakeable as WakeableWithThen).andThen(
					() => retry(),
					() => retry()
				);
			}
		}
	}
}

export function isSuspenseBoundaryBeingHidden(current: Fiber | undefined, finishedWork: Fiber): boolean {
	if (current !== undefined) {
		const oldState = current.memoizedState as SuspenseState | undefined;
		if (oldState === undefined || oldState.dehydrated !== undefined) {
			const newState = finishedWork.memoizedState as SuspenseState | undefined;
			return newState !== undefined && newState.dehydrated === undefined;
		}
	}
	return false;
}

export function commitResetTextContent(current: Fiber): void {
	if (!supportsMutation()) {
		return;
	}
	resetTextContent(current.stateNode as Instance);
}

export function commitPassiveUnmount(finishedWork: Fiber): void {
	if (
		finishedWork.tag === FunctionComponent ||
		finishedWork.tag === ForwardRef ||
		finishedWork.tag === SimpleMemoComponent ||
		finishedWork.tag === Block
	) {
		if (enableProfilerTimer && enableProfilerCommitHooks && bit32.band(finishedWork.mode, ProfileMode) !== 0) {
			startPassiveEffectTimer();
			commitHookEffectListUnmount(bit32.bor(HookPassive, HookHasEffect), finishedWork, finishedWork.return_);
			recordPassiveEffectDuration(finishedWork);
		} else {
			commitHookEffectListUnmount(bit32.bor(HookPassive, HookHasEffect), finishedWork, finishedWork.return_);
		}
	}
}

export function commitPassiveUnmountInsideDeletedTree(current: Fiber, nearestMountedAncestor: Fiber | undefined): void {
	if (
		current.tag === FunctionComponent ||
		current.tag === ForwardRef ||
		current.tag === SimpleMemoComponent ||
		current.tag === Block
	) {
		if (enableProfilerTimer && enableProfilerCommitHooks && bit32.band(current.mode, ProfileMode) !== 0) {
			startPassiveEffectTimer();
			commitHookEffectListUnmount(HookPassive, current, nearestMountedAncestor);
			recordPassiveEffectDuration(current);
		} else {
			commitHookEffectListUnmount(HookPassive, current, nearestMountedAncestor);
		}
	}
}

export function commitPassiveMount(finishedRoot: FiberRoot, finishedWork: Fiber): void {
	if (
		finishedWork.tag === FunctionComponent ||
		finishedWork.tag === ForwardRef ||
		finishedWork.tag === SimpleMemoComponent ||
		finishedWork.tag === Block
	) {
		if (enableProfilerTimer && enableProfilerCommitHooks && bit32.band(finishedWork.mode, ProfileMode) !== 0) {
			startPassiveEffectTimer();
			const [ok, errorValue] = xpcall(
				commitHookEffectListMount,
				describeError,
				bit32.bor(HookPassive, HookHasEffect),
				finishedWork
			);
			recordPassiveEffectDuration(finishedWork);
			if (!ok) {
				error(errorValue);
			}
		} else {
			commitHookEffectListMount(bit32.bor(HookPassive, HookHasEffect), finishedWork);
		}
	} else if (finishedWork.tag === Profiler) {
		commitProfilerPassiveEffect(finishedRoot, finishedWork);
	}
}

export function invokeLayoutEffectMountInDEV(fiber: Fiber): void {
	if (__DEV__ && enableDoubleInvokingEffects) {
		if (
			fiber.tag === FunctionComponent ||
			fiber.tag === ForwardRef ||
			fiber.tag === SimpleMemoComponent ||
			fiber.tag === Block
		) {
			invokeGuardedCallback(
				undefined,
				commitHookEffectListMount,
				undefined,
				bit32.bor(HookLayout, HookHasEffect),
				fiber
			);
			if (hasCaughtError()) {
				const mountError = clearCaughtError();
				captureCommitPhaseError(fiber, fiber.return_, mountError);
			}
			return;
		}
	} else if (fiber.tag === ClassComponent) {
		const instance = fiber.stateNode as ClassLikeInstance;
		invokeGuardedCallback(undefined, instance.componentDidMount as () => void, instance);
		if (hasCaughtError()) {
			const mountError = clearCaughtError();
			captureCommitPhaseError(fiber, fiber.return_, mountError);
		}
		return;
	}
}

export function invokePassiveEffectMountInDEV(fiber: Fiber): void {
	if (__DEV__ && enableDoubleInvokingEffects) {
		if (
			fiber.tag === FunctionComponent ||
			fiber.tag === ForwardRef ||
			fiber.tag === SimpleMemoComponent ||
			fiber.tag === Block
		) {
			invokeGuardedCallback(
				undefined,
				commitHookEffectListMount,
				undefined,
				bit32.bor(HookPassive, HookHasEffect),
				fiber
			);
			if (hasCaughtError()) {
				const mountError = clearCaughtError();
				captureCommitPhaseError(fiber, fiber.return_, mountError);
			}
			return;
		}
	}
}

export function invokeLayoutEffectUnmountInDEV(fiber: Fiber): void {
	if (__DEV__ && enableDoubleInvokingEffects) {
		if (
			fiber.tag === FunctionComponent ||
			fiber.tag === ForwardRef ||
			fiber.tag === SimpleMemoComponent ||
			fiber.tag === Block
		) {
			invokeGuardedCallback(
				undefined,
				commitHookEffectListUnmount,
				undefined,
				bit32.bor(HookLayout, HookHasEffect),
				fiber,
				fiber.return_
			);
			if (hasCaughtError()) {
				const unmountError = clearCaughtError();
				captureCommitPhaseError(fiber, fiber.return_, unmountError);
			}
			return;
		}
	} else if (fiber.tag === ClassComponent) {
		const instance = fiber.stateNode as ClassLikeInstance;
		if (typeOf(instance.componentWillUnmount) === 'function') {
			safelyCallComponentWillUnmount(fiber, instance, fiber.return_);
		}
		return;
	}
}

export function invokePassiveEffectUnmountInDEV(fiber: Fiber): void {
	if (__DEV__ && enableDoubleInvokingEffects) {
		if (
			fiber.tag === FunctionComponent ||
			fiber.tag === ForwardRef ||
			fiber.tag === SimpleMemoComponent ||
			fiber.tag === Block
		) {
			invokeGuardedCallback(
				undefined,
				commitHookEffectListUnmount,
				undefined,
				bit32.bor(HookPassive, HookHasEffect),
				fiber,
				fiber.return_
			);
			if (hasCaughtError()) {
				const unmountError = clearCaughtError();
				captureCommitPhaseError(fiber, fiber.return_, unmountError);
			}
			return;
		}
	}
}

export default {
	safelyCallDestroy,
	commitBeforeMutationLifeCycles,
	commitResetTextContent,
	commitPlacement,
	commitDeletion,
	commitWork,
	commitAttachRef,
	commitDetachRef,
	commitPassiveUnmount,
	commitPassiveUnmountInsideDeletedTree,
	commitPassiveMount,
	invokeLayoutEffectMountInDEV,
	invokeLayoutEffectUnmountInDEV,
	invokePassiveEffectMountInDEV,
	invokePassiveEffectUnmountInDEV,
	isSuspenseBoundaryBeingHidden,
	recursivelyCommitLayoutEffects,
};
