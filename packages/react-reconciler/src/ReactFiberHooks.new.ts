/**
 * Hook state machine used by the reconciler.
 *
 * Ported from:
 * react-lua/modules/react-reconciler/src/ReactFiberHooks.new.lua
 */

import { __DEV__, __TESTEZ_RUNNING_TEST__ } from '@nrbx/react-globals';
// Imported from the non-cyclic `@nrbx/react/core` subpath: the public
// `@nrbx/react` entry point imports this reconciler, so importing it back
// would create a circular require.
import { createRef as createReactRef, createBinding as createReactBinding } from '@nrbx/react/core';
import {
	console,
	getComponentName,
	invariant,
	ReactFeatureFlags,
	ReactSharedInternals,
	SafeFlags,
} from '@nrbx/react-shared';
import type {
	MutableSource,
	MutableSourceGetSnapshotFn,
	MutableSourceSubscribeFn,
	ReactBinding,
	ReactBindingUpdater,
	ReactContext,
} from '@nrbx/react-shared';
import type {
	BasicStateAction,
	Dispatcher,
	Dispatch,
	Fiber,
	FiberRoot,
	HookType,
	Lane,
	Lanes,
	ReactPriorityLevel,
} from './types';
import {
	NoLane,
	NoLanes,
	isSubsetOfLanes,
	markRootEntangled,
	markRootMutableRead,
	mergeLanes,
	removeLanes,
} from './ReactFiberLane';
import { HasEffect as HookHasEffect, Layout as HookLayout, Passive as HookPassive } from './ReactHookEffectTags';
import type { HookFlags } from './ReactHookEffectTags';
import { DebugTracingMode } from './ReactTypeOfMode';
import { readContext } from './ReactFiberNewContext.new';
import {
	MountLayoutDev as MountLayoutDevEffect,
	MountPassiveDev as MountPassiveDevEffect,
	Passive as PassiveEffect,
	PassiveStatic as PassiveStaticEffect,
	Update as UpdateEffect,
} from './ReactFiberFlags';
import type { Flags } from './ReactFiberFlags';
import * as ReactFiberWorkLoop from './ReactFiberWorkLoop.new';
import HostConfig from './ReactFiberHostConfig';
import {
	getWorkInProgressVersion,
	markSourceAsDirty,
	setWorkInProgressVersion,
	warnAboutMultipleRenderersDEV,
} from './ReactMutableSource.new';
import { markWorkInProgressReceivedUpdate } from './ReactFiberBeginWork.new';
import { getIsHydrating } from './ReactFiberHydrationContext.new';
import { logStateUpdateScheduled } from './DebugTracing';
import { markStateUpdateScheduled } from './SchedulingProfiler';

const createRef = createReactRef as <T>() => { current: T | undefined };
const createBinding = createReactBinding as <T>(initialValue: T) => [ReactBinding<T>, ReactBindingUpdater<T>];

function unimplemented(message: string): never {
	print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	print(`UNIMPLEMENTED ERROR: ${message}`);
	error(`FIXME (roblox): ${message} is unimplemented`);
}

type Update<S, A> = {
	lane: Lane;
	action: A;
	eagerReducer: ((state: S, action: A) => S) | undefined;
	eagerState: S | undefined;
	next: Update<S, A>;
	priority?: ReactPriorityLevel;
};

type HookUpdateDispatch<A> = ((value: A, ...args: Array<unknown>) => unknown) | undefined;

type UpdateQueue<S, A> = {
	pending: Update<S, A> | undefined;
	dispatch: HookUpdateDispatch<A>;
	lastRenderedReducer: ((state: S, action: A) => S) | undefined;
	lastRenderedState: S | undefined;
};

export type Hook = {
	memoizedState: unknown;
	baseState: unknown;
	baseQueue: Update<unknown, unknown> | undefined;
	queue: UpdateQueue<unknown, unknown> | undefined;
	next: Hook | undefined;
};

type EffectCreate = () => void | (() => unknown);

export type Effect = {
	tag: HookFlags;
	create: EffectCreate;
	destroy: (() => unknown) | undefined;
	deps: Array<unknown> | undefined;
	next: Effect;
};

export type FunctionComponentUpdateQueue = {
	lastEffect: Effect | undefined;
};

type MutableSourceMemoizedState<Source, Snapshot> = {
	refs: {
		getSnapshot: MutableSourceGetSnapshotFn<Source, Snapshot>;
		setSnapshot: Dispatch<BasicStateAction<Snapshot>> | undefined;
	};
	source: MutableSource<Source>;
	subscribe: MutableSourceSubscribeFn<Source, Snapshot>;
};

const ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher as {
	current: Dispatcher | undefined;
};

const { enableDebugTracing, enableSchedulingProfiler, enableNewReconciler, enableDoubleInvokingEffects } =
	ReactFeatureFlags as {
		enableDebugTracing?: boolean;
		enableSchedulingProfiler?: boolean;
		enableNewReconciler?: boolean;
		enableDoubleInvokingEffects?: boolean;
	};

const warnIfNotCurrentlyActingUpdatesInDEV = ReactFiberWorkLoop.warnIfNotCurrentlyActingUpdatesInDEV as
	| ((fiber: Fiber) => void)
	| undefined;
const scheduleUpdateOnFiber = ReactFiberWorkLoop.scheduleUpdateOnFiber as (
	fiber: Fiber,
	lane: Lane,
	eventTime: number
) => void;
const warnIfNotScopedWithMatchingAct = ReactFiberWorkLoop.warnIfNotScopedWithMatchingAct as
	| ((fiber: Fiber) => void)
	| undefined;
const requestEventTime = ReactFiberWorkLoop.requestEventTime as () => number;
const requestUpdateLane = ReactFiberWorkLoop.requestUpdateLane as (fiber: Fiber) => Lane;
const markSkippedUpdateLanes = ReactFiberWorkLoop.markSkippedUpdateLanes as (lane: Lane) => void;
const getWorkInProgressRoot = ReactFiberWorkLoop.getWorkInProgressRoot as () => FiberRoot | undefined;
const warnIfNotCurrentlyActingEffectsInDEV = ReactFiberWorkLoop.warnIfNotCurrentlyActingEffectsInDEV as
	| ((fiber: Fiber) => void)
	| undefined;

// Read lazily — see ReactFiberHostConfig for why host-config access must
// never be captured at module scope.
const makeClientId = () => HostConfig.makeClientId;

const FFlagReactCleanQueueOnUpdateBailout = SafeFlags.createGetFFlag('ReactCleanQueueOnUpdateBailout')();

const didWarnAboutMismatchedHooksForComponent: Record<string, boolean> = {};
let _didWarnAboutUseOpaqueIdentifier: Record<string, boolean> | undefined;
if (__DEV__) {
	_didWarnAboutUseOpaqueIdentifier = {};
}

let renderLanes: Lanes = NoLanes;
let currentlyRenderingFiber = undefined as Fiber | undefined;
let currentHook = undefined as Hook | undefined;
let workInProgressHook = undefined as Hook | undefined;

let didScheduleRenderPhaseUpdate = false;
let didScheduleRenderPhaseUpdateDuringThisPass = false;

const RE_RENDER_LIMIT = 25;

let currentHookNameInDev: HookType | undefined;
let hookTypesDev = undefined as Array<HookType> | undefined;
let hookTypesUpdateIndexDev = -1;
const ignorePreviousDependencies = false;

let HooksDispatcherOnMountInDEV = undefined as Dispatcher | undefined;
let HooksDispatcherOnMountWithHookTypesInDEV = undefined as Dispatcher | undefined;
let HooksDispatcherOnUpdateInDEV = undefined as Dispatcher | undefined;
let HooksDispatcherOnRerenderInDEV = undefined as Dispatcher | undefined;
let InvalidNestedHooksDispatcherOnMountInDEV = undefined as Dispatcher | undefined;
let InvalidNestedHooksDispatcherOnUpdateInDEV = undefined as Dispatcher | undefined;
let InvalidNestedHooksDispatcherOnRerenderInDEV = undefined as Dispatcher | undefined;

function is(x: unknown, y: unknown): boolean {
	return (x === y && (x !== 0 || 1 / (x as number) === 1 / (y as number))) || (x !== x && y !== y);
}

function getObjectKeys(record: Record<string, unknown>): Array<string> {
	const keys: Array<string> = [];
	for (const [k] of pairs(record as object)) {
		keys.push(k as string);
	}
	return keys;
}

function getHighestIndex(array: Array<unknown>): number {
	let highestIndex = -1;
	for (const [k] of pairs(array as unknown as object)) {
		const key = k as number;
		if (key > highestIndex) {
			highestIndex = key;
		}
	}
	return highestIndex + 1;
}

function isArrayOrSparseArray(deps: unknown): deps is Array<unknown> {
	if (type(deps) !== 'table') {
		return false;
	}
	for (const [k] of pairs(deps as object)) {
		if (type(k) !== 'number') {
			return false;
		}
	}
	return true;
}

function mountHookTypesDev(): void {
	if (!__DEV__) {
		return;
	}
	const hookName = currentHookNameInDev as HookType;
	if (hookTypesDev === undefined) {
		hookTypesDev = [hookName];
	} else {
		hookTypesDev.push(hookName);
	}
}

function updateHookTypesDev(): void {
	if (!__DEV__) {
		return;
	}
	const hookName = currentHookNameInDev as HookType;
	if (hookTypesDev !== undefined) {
		hookTypesUpdateIndexDev += 1;
		if (hookTypesDev[hookTypesUpdateIndexDev] !== hookName) {
			warnOnHookMismatchInDev(hookName);
		}
	}
}

function checkDepsAreArrayDev(deps: unknown): void {
	if (!__DEV__) {
		return;
	}
	if (deps !== undefined && !isArrayOrSparseArray(deps)) {
		console.error(
			'%s received a final argument that is not an array (instead, received `%s`). When specified, the final argument must be an array.',
			currentHookNameInDev,
			type(deps)
		);
	}
}

function warnOnHookMismatchInDev(currentHookName: HookType): void {
	if (!__DEV__) {
		return;
	}
	const componentName = getComponentName(currentlyRenderingFiber?.type) ?? 'Component';
	if (didWarnAboutMismatchedHooksForComponent[componentName]) {
		return;
	}
	didWarnAboutMismatchedHooksForComponent[componentName] = true;

	if (hookTypesDev === undefined) {
		return;
	}

	let hookTable = '';
	const secondColumnStart = 30;

	for (let i = 0; i <= hookTypesUpdateIndexDev; i++) {
		const oldHookName = hookTypesDev[i];
		const newHookName = i === hookTypesUpdateIndexDev ? currentHookName : oldHookName;
		let row = `${i + 1}. ${tostring(oldHookName ?? 'undefined')}`;
		while (row.size() < secondColumnStart) {
			row += ' ';
		}
		row += `${newHookName}\n`;
		hookTable += row;
	}

	console.error(
		'React has detected a change in the order of Hooks called by %s. This will lead to bugs and errors if not fixed. For more information, read the Rules of Hooks: https://reactjs.org/link/rules-of-hooks\n\n   Previous render            Next render\n   ------------------------------------------------------\n%s   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n',
		componentName,
		hookTable
	);
}

function throwInvalidHookError(): never {
	error(
		'Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for' +
			' one of the following reasons:\n' +
			'1. You might have mismatching versions of React and the renderer (such as React DOM)\n' +
			'2. You might be breaking the Rules of Hooks\n' +
			'3. You might have more than one copy of React in the same app\n' +
			'See https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.'
	);
}

function areHookInputsEqual(nextDeps: Array<unknown>, prevDeps: Array<unknown> | undefined): boolean {
	if (__DEV__ && ignorePreviousDependencies) {
		return false;
	}

	if (prevDeps === undefined) {
		if (__DEV__) {
			console.error(
				'%s received a final argument during this render, but not during the previous render. Even though the final argument is optional, its type cannot change between renders.',
				currentHookNameInDev
			);
		}
		return false;
	}

	const nextDepsLength = getHighestIndex(nextDeps);
	const prevDepsLength = getHighestIndex(prevDeps);
	if (nextDepsLength !== prevDepsLength) {
		return false;
	}

	const minDependencyCount = math.min(prevDepsLength, nextDepsLength);
	for (let i = 0; i < minDependencyCount; i++) {
		if (!is(nextDeps[i], prevDeps[i])) {
			return false;
		}
	}
	return true;
}

export function bailoutHooks(current: Fiber, workInProgress: Fiber, lanes: Lanes): void {
	workInProgress.updateQueue = current.updateQueue;
	if (__DEV__ && enableDoubleInvokingEffects) {
		workInProgress.flags = bit32.band(
			workInProgress.flags,
			bit32.bnot(bit32.bor(MountPassiveDevEffect, PassiveEffect, MountLayoutDevEffect, UpdateEffect))
		);
	} else {
		workInProgress.flags = bit32.band(workInProgress.flags, bit32.bnot(bit32.bor(PassiveEffect, UpdateEffect)));
	}
	current.lanes = removeLanes(current.lanes, lanes);
}

let _isUpdatingOpaqueValueInRenderPhase = false;

export function resetHooksAfterThrow(): void {
	ReactCurrentDispatcher.current = ContextOnlyDispatcher;

	if (didScheduleRenderPhaseUpdate && currentlyRenderingFiber !== undefined) {
		let hook = currentlyRenderingFiber.memoizedState as Hook | undefined;
		while (hook !== undefined) {
			const queue = hook.queue;
			if (queue !== undefined) {
				queue.pending = undefined;
			}
			hook = hook.next;
		}
		didScheduleRenderPhaseUpdate = false;
	}

	renderLanes = NoLanes;
	currentlyRenderingFiber = undefined;

	currentHook = undefined;
	workInProgressHook = undefined;

	if (__DEV__) {
		hookTypesDev = undefined;
		hookTypesUpdateIndexDev = -1;
		currentHookNameInDev = undefined;
		_isUpdatingOpaqueValueInRenderPhase = false;
	}

	didScheduleRenderPhaseUpdateDuringThisPass = false;
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memoizedState: undefined,
		baseState: undefined,
		baseQueue: undefined,
		queue: undefined,
		next: undefined,
	};

	if (workInProgressHook === undefined) {
		(currentlyRenderingFiber as Fiber).memoizedState = hook;
		workInProgressHook = hook;
	} else {
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}
	return workInProgressHook;
}

function updateWorkInProgressHook(): Hook {
	let nextCurrentHook: Hook | undefined;
	if (currentHook === undefined) {
		const current = currentlyRenderingFiber?.alternate;
		nextCurrentHook = current?.memoizedState as Hook | undefined;
	} else {
		nextCurrentHook = currentHook.next;
	}

	let nextWorkInProgressHook: Hook | undefined;
	if (workInProgressHook === undefined) {
		nextWorkInProgressHook = currentlyRenderingFiber?.memoizedState as Hook | undefined;
	} else {
		nextWorkInProgressHook = workInProgressHook.next;
	}

	if (nextWorkInProgressHook !== undefined) {
		workInProgressHook = nextWorkInProgressHook;
		currentHook = nextCurrentHook;
	} else {
		if (nextCurrentHook === undefined) {
			error('Rendered more hooks than during the previous render.');
		}

		currentHook = nextCurrentHook;
		const newHook: Hook = {
			memoizedState: currentHook.memoizedState,
			baseState: currentHook.baseState,
			baseQueue: currentHook.baseQueue,
			queue: currentHook.queue,
			next: undefined,
		};

		if (workInProgressHook === undefined) {
			workInProgressHook = newHook;
			(currentlyRenderingFiber as Fiber).memoizedState = newHook;
		} else {
			workInProgressHook.next = newHook;
			workInProgressHook = newHook;
		}
	}

	return workInProgressHook;
}

function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
	if (type(action) === 'function') {
		return (action as (value: S) => S)(state);
	}
	return action as S;
}

function mountReducer<S, I, A>(
	reducer: (state: S, action: A) => S,
	initialArg: I,
	init?: (arg: I) => S
): [S, Dispatch<A>] {
	const hook = mountWorkInProgressHook();
	const initialState = init ? init(initialArg) : (initialArg as unknown as S);

	hook.baseState = initialState;
	hook.memoizedState = initialState;

	const queue: UpdateQueue<S, A> = {
		pending: undefined,
		dispatch: undefined,
		lastRenderedReducer: reducer,
		lastRenderedState: initialState,
	};
	hook.queue = queue as unknown as UpdateQueue<unknown, unknown>;

	const cRF = currentlyRenderingFiber as Fiber;
	const dispatch = ((action: A, ...args: Array<unknown>) => {
		dispatchAction(cRF, queue, action, ...args);
	}) as Dispatch<A>;
	queue.dispatch = dispatch as HookUpdateDispatch<A>;

	return [hook.memoizedState as S, dispatch];
}

function updateReducer<S, I, A>(
	reducer: (state: S, action: A) => S,
	_initialArg: I,
	_init?: (arg: I) => S
): [S, Dispatch<A>] {
	const hook = updateWorkInProgressHook();
	const queue = hook.queue as UpdateQueue<S, A> | undefined;
	assert(queue !== undefined, 'Should have a queue. This is likely a bug in React. Please file an issue.');

	queue.lastRenderedReducer = reducer;
	const current = currentHook as Hook;

	let baseQueue = current.baseQueue as Update<S, A> | undefined;
	const pendingQueue = queue.pending;
	if (pendingQueue !== undefined) {
		if (baseQueue !== undefined) {
			const baseFirst = baseQueue.next;
			const pendingFirst = pendingQueue.next;
			baseQueue.next = pendingFirst;
			pendingQueue.next = baseFirst;
		}
		baseQueue = pendingQueue;
		current.baseQueue = baseQueue as unknown as Update<unknown, unknown>;
		queue.pending = undefined;
	}

	if (baseQueue !== undefined) {
		const first = baseQueue.next;
		let newState = current.baseState as S;
		let newBaseState = undefined as S | undefined;
		let newBaseQueueFirst = undefined as Update<S, A> | undefined;
		let newBaseQueueLast = undefined as Update<S, A> | undefined;
		let update = first;

		do {
			const updateLane = update.lane;
			if (bit32.band(renderLanes, updateLane) !== updateLane) {
				const clone: Update<S, A> = {
					lane: updateLane,
					action: update.action,
					eagerReducer: update.eagerReducer,
					eagerState: update.eagerState,
					next: undefined as unknown as Update<S, A>,
				};
				if (newBaseQueueLast === undefined) {
					newBaseQueueLast = clone;
					newBaseQueueFirst = clone;
					newBaseState = newState;
				} else {
					newBaseQueueLast.next = clone;
					newBaseQueueLast = clone;
				}
				(currentlyRenderingFiber as Fiber).lanes = mergeLanes(
					(currentlyRenderingFiber as Fiber).lanes,
					updateLane
				);
				markSkippedUpdateLanes(updateLane);
			} else {
				if (newBaseQueueLast !== undefined) {
					const clone: Update<S, A> = {
						lane: NoLane,
						action: update.action,
						eagerReducer: update.eagerReducer,
						eagerState: update.eagerState,
						next: undefined as unknown as Update<S, A>,
					};
					newBaseQueueLast.next = clone;
					newBaseQueueLast = clone;
				}

				if (update.eagerReducer === reducer) {
					newState = update.eagerState as S;
				} else {
					newState = reducer(newState, update.action);
				}
			}
			update = update.next;
		} while (update !== undefined && update !== first);

		if (newBaseQueueLast === undefined) {
			newBaseState = newState;
		} else {
			newBaseQueueLast.next = newBaseQueueFirst as Update<S, A>;
		}

		if (!is(newState, hook.memoizedState)) {
			markWorkInProgressReceivedUpdate();
		}

		hook.memoizedState = newState;
		hook.baseState = newBaseState;
		hook.baseQueue = newBaseQueueLast as unknown as Update<unknown, unknown> | undefined;

		queue.lastRenderedState = newState;
	}

	const dispatch = queue.dispatch as Dispatch<A>;
	return [hook.memoizedState as S, dispatch];
}

function rerenderReducer<S, I, A>(
	reducer: (state: S, action: A) => S,
	_initialArg: I,
	_init?: (arg: I) => S
): [S, Dispatch<A>] {
	const hook = updateWorkInProgressHook();
	const queue = hook.queue as UpdateQueue<S, A> | undefined;
	assert(queue !== undefined, 'Should have a queue. This is likely a bug in React. Please file an issue.');

	queue.lastRenderedReducer = reducer;

	const dispatch = queue.dispatch as Dispatch<A>;
	const lastRenderPhaseUpdate = queue.pending;
	let newState = hook.memoizedState as S;

	if (lastRenderPhaseUpdate !== undefined) {
		queue.pending = undefined;

		const firstRenderPhaseUpdate = lastRenderPhaseUpdate.next;
		let update = firstRenderPhaseUpdate;
		do {
			newState = reducer(newState, update.action);
			update = update.next;
		} while (update !== firstRenderPhaseUpdate);

		if (!is(newState, hook.memoizedState)) {
			markWorkInProgressReceivedUpdate();
		}

		hook.memoizedState = newState;
		if (hook.baseQueue === undefined) {
			hook.baseState = newState;
		}
		queue.lastRenderedState = newState;
	}

	return [newState, dispatch];
}

function readFromUnsubcribedMutableSource<Source, Snapshot>(
	root: FiberRoot,
	source: MutableSource<Source>,
	getSnapshot: MutableSourceGetSnapshotFn<Source, Snapshot>
): Snapshot {
	if (__DEV__) {
		warnAboutMultipleRenderersDEV(source);
	}

	const getVersion = source._getVersion;
	const version = getVersion(source._source as unknown);

	let isSafeToReadFromSource = false;
	const currentRenderVersion = getWorkInProgressVersion(source);
	if (currentRenderVersion !== undefined) {
		isSafeToReadFromSource = currentRenderVersion === version;
	} else {
		isSafeToReadFromSource = isSubsetOfLanes(renderLanes, root.mutableReadLanes);
		if (isSafeToReadFromSource) {
			setWorkInProgressVersion(source, version);
		}
	}

	if (isSafeToReadFromSource) {
		const snapshot = getSnapshot(source._source);
		if (__DEV__ && type(snapshot as unknown) === 'function') {
			console.error(
				'Mutable source should not return a function as the snapshot value. Functions may close over mutable values and cause tearing.'
			);
		}
		return snapshot;
	}

	markSourceAsDirty(source);
	error(
		'Cannot read from mutable source during the current render without tearing. This is a bug in React. Please file an issue.'
	);
}

function useMutableSource<Source, Snapshot>(
	hook: Hook,
	source: MutableSource<Source>,
	getSnapshot: MutableSourceGetSnapshotFn<Source, Snapshot>,
	subscribe: MutableSourceSubscribeFn<Source, Snapshot>
): Snapshot {
	const root = getWorkInProgressRoot();
	invariant(root !== undefined, 'Expected a work-in-progress root. This is a bug in React. Please file an issue.');

	const getVersion = source._getVersion;
	const version = getVersion(source._source as unknown);

	const dispatcher = ReactCurrentDispatcher.current;
	assert(dispatcher !== undefined, 'dispatcher was nil, this is a bug in React');

	let [snapshot, setSnapshot] = dispatcher.useState<Snapshot>(() => {
		return readFromUnsubcribedMutableSource(root, source, getSnapshot);
	});

	const stateHook = workInProgressHook as Hook;
	const memoizedState = hook.memoizedState as MutableSourceMemoizedState<Source, Snapshot>;
	const refs = memoizedState.refs;
	const prevGetSnapshot = refs.getSnapshot;
	const prevSource = memoizedState.source;
	const prevSubscribe = memoizedState.subscribe;
	const fiber = currentlyRenderingFiber as Fiber;

	hook.memoizedState = {
		refs,
		source,
		subscribe,
	} satisfies MutableSourceMemoizedState<Source, Snapshot>;

	dispatcher.useEffect(() => {
		refs.getSnapshot = getSnapshot;
		refs.setSnapshot = setSnapshot;

		const maybeNewVersion = getVersion(source._source as unknown);
		if (!is(version, maybeNewVersion)) {
			const maybeNewSnapshot = getSnapshot(source._source);
			if (__DEV__ && type(maybeNewSnapshot as unknown) === 'function') {
				console.error(
					'Mutable source should not return a function as the snapshot value. Functions may close over mutable values and cause tearing.'
				);
			}
			if (!is(snapshot, maybeNewSnapshot)) {
				setSnapshot(maybeNewSnapshot);
				const lane = requestUpdateLane(fiber);
				markRootMutableRead(root, lane);
			}
			markRootEntangled(root, root.mutableReadLanes);
		}
	}, [getSnapshot, source, subscribe]);

	dispatcher.useEffect(() => {
		const handleChange = () => {
			const latestGetSnapshot = refs.getSnapshot;
			const latestSetSnapshot = refs.setSnapshot;
			try {
				latestSetSnapshot?.(latestGetSnapshot(source._source));
				const lane = requestUpdateLane(fiber);
				markRootMutableRead(root, lane);
			} catch (result) {
				latestSetSnapshot?.(() => {
					throw result;
				});
			}
		};

		const unsubscribe = subscribe(source._source, handleChange);
		if (__DEV__ && type(unsubscribe as unknown) !== 'function') {
			console.error('Mutable source subscribe function must return an unsubscribe function.');
		}
		return unsubscribe;
	}, [source, subscribe]);

	if (!is(prevGetSnapshot, getSnapshot) || !is(prevSource, source) || !is(prevSubscribe, subscribe)) {
		const newQueue: UpdateQueue<Snapshot, BasicStateAction<Snapshot>> = {
			pending: undefined,
			dispatch: undefined,
			lastRenderedReducer: basicStateReducer,
			lastRenderedState: snapshot,
		};

		const cRF = currentlyRenderingFiber as Fiber;
		setSnapshot = ((action: BasicStateAction<Snapshot>) => {
			dispatchAction(cRF, newQueue, action);
		}) as Dispatch<BasicStateAction<Snapshot>>;

		newQueue.dispatch = setSnapshot;
		stateHook.queue = newQueue as unknown as UpdateQueue<unknown, unknown>;
		stateHook.baseQueue = undefined;
		snapshot = readFromUnsubcribedMutableSource(root, source, getSnapshot);
		stateHook.baseState = snapshot;
		stateHook.memoizedState = snapshot;
	}

	return snapshot;
}

function mountMutableSource<Source, Snapshot>(
	source: MutableSource<Source>,
	getSnapshot: MutableSourceGetSnapshotFn<Source, Snapshot>,
	subscribe: MutableSourceSubscribeFn<Source, Snapshot>
): Snapshot {
	const hook = mountWorkInProgressHook();
	hook.memoizedState = {
		refs: {
			getSnapshot,
			setSnapshot: undefined,
		},
		source,
		subscribe,
	} satisfies MutableSourceMemoizedState<Source, Snapshot>;
	return useMutableSource(hook, source, getSnapshot, subscribe);
}

function updateMutableSource<Source, Snapshot>(
	source: MutableSource<Source>,
	getSnapshot: MutableSourceGetSnapshotFn<Source, Snapshot>,
	subscribe: MutableSourceSubscribeFn<Source, Snapshot>
): Snapshot {
	const hook = updateWorkInProgressHook();
	return useMutableSource(hook, source, getSnapshot, subscribe);
}

function mountState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>] {
	const hook = mountWorkInProgressHook();
	const resolvedInitialState = type(initialState) === 'function' ? (initialState as () => S)() : (initialState as S);

	hook.baseState = resolvedInitialState;
	hook.memoizedState = resolvedInitialState;

	const queue: UpdateQueue<S, BasicStateAction<S>> = {
		pending: undefined,
		dispatch: undefined,
		lastRenderedReducer: basicStateReducer,
		lastRenderedState: resolvedInitialState,
	};
	hook.queue = queue as unknown as UpdateQueue<unknown, unknown>;

	const cRF = currentlyRenderingFiber as Fiber;
	const dispatch = ((action: BasicStateAction<S>, ...args: Array<unknown>) => {
		dispatchAction(cRF, queue, action, ...args);
	}) as Dispatch<BasicStateAction<S>>;

	queue.dispatch = dispatch;
	return [hook.memoizedState as S, dispatch];
}

function updateState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>] {
	return updateReducer<S, (() => S) | S, BasicStateAction<S>>(basicStateReducer, initialState);
}

function rerenderState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>] {
	return rerenderReducer<S, (() => S) | S, BasicStateAction<S>>(basicStateReducer, initialState);
}

function pushEffect(
	tag: HookFlags,
	create: EffectCreate,
	destroy: (() => unknown) | undefined,
	deps: Array<unknown> | undefined
): Effect {
	const effect: Effect = {
		tag,
		create,
		destroy,
		deps,
		next: undefined as unknown as Effect,
	};

	let componentUpdateQueue = currentlyRenderingFiber?.updateQueue as FunctionComponentUpdateQueue | undefined;
	if (componentUpdateQueue === undefined) {
		componentUpdateQueue = { lastEffect: undefined };
		(currentlyRenderingFiber as Fiber).updateQueue = componentUpdateQueue;
		effect.next = effect;
		componentUpdateQueue.lastEffect = effect;
	} else {
		const lastEffect = componentUpdateQueue.lastEffect;
		if (lastEffect === undefined) {
			componentUpdateQueue.lastEffect = effect;
			effect.next = effect;
		} else {
			const firstEffect = lastEffect.next;
			lastEffect.next = effect;
			effect.next = firstEffect;
			componentUpdateQueue.lastEffect = effect;
		}
	}

	return effect;
}

function mountBinding<T>(initialValue: T): [ReactBinding<T>, ReactBindingUpdater<T>] {
	const hook = mountWorkInProgressHook();
	const [value, updateValue] = createBinding(initialValue) as [ReactBinding<T>, ReactBindingUpdater<T>];
	hook.memoizedState = [value, updateValue];
	return [value, updateValue];
}

function updateBinding<T>(_initialValue: T): [ReactBinding<T>, ReactBindingUpdater<T>] {
	const hook = updateWorkInProgressHook();
	return hook.memoizedState as [ReactBinding<T>, ReactBindingUpdater<T>];
}

function mountRef<T>(initialValue: T): { current: T } {
	const hook = mountWorkInProgressHook();
	const ref = createRef<T>() as { current: T };
	ref.current = initialValue;
	hook.memoizedState = ref;
	return ref;
}

function updateRef<T>(_initialValue: T): { current: T } {
	const hook = updateWorkInProgressHook();
	return hook.memoizedState as { current: T };
}

function mountEffectImpl(fiberFlags: Flags, hookFlags: HookFlags, create: EffectCreate, deps?: Array<unknown>): void {
	const hook = mountWorkInProgressHook();
	const nextDeps = deps;
	(currentlyRenderingFiber as Fiber).flags = bit32.bor((currentlyRenderingFiber as Fiber).flags, fiberFlags);
	hook.memoizedState = pushEffect(bit32.bor(HookHasEffect, hookFlags), create, undefined, nextDeps);
}

function updateEffectImpl(fiberFlags: Flags, hookFlags: HookFlags, create: EffectCreate, deps?: Array<unknown>): void {
	const hook = updateWorkInProgressHook();
	const nextDeps = deps;
	let destroy: (() => unknown) | undefined;

	if (currentHook !== undefined) {
		const prevEffect = currentHook.memoizedState as Effect;
		destroy = prevEffect.destroy;
		if (nextDeps !== undefined) {
			const prevDeps = prevEffect.deps;
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				hook.memoizedState = pushEffect(hookFlags, create, destroy, nextDeps);
				return;
			}
		}
	}

	(currentlyRenderingFiber as Fiber).flags = bit32.bor((currentlyRenderingFiber as Fiber).flags, fiberFlags);
	hook.memoizedState = pushEffect(bit32.bor(HookHasEffect, hookFlags), create, destroy, nextDeps);
}

function mountEffect(create: EffectCreate, deps?: Array<unknown>): void {
	if (__DEV__) {
		if (type((_G as unknown as Record<string, unknown>).jest) !== 'nil' || __TESTEZ_RUNNING_TEST__) {
			warnIfNotCurrentlyActingEffectsInDEV?.(currentlyRenderingFiber as Fiber);
		}
	}

	if (__DEV__ && enableDoubleInvokingEffects) {
		mountEffectImpl(
			bit32.bor(MountPassiveDevEffect, PassiveEffect, PassiveStaticEffect),
			HookPassive,
			create,
			deps
		);
	} else {
		mountEffectImpl(bit32.bor(PassiveEffect, PassiveStaticEffect), HookPassive, create, deps);
	}
}

function updateEffect(create: EffectCreate, deps?: Array<unknown>): void {
	if (__DEV__) {
		if (type((_G as unknown as Record<string, unknown>).jest) !== 'nil' || __TESTEZ_RUNNING_TEST__) {
			warnIfNotCurrentlyActingEffectsInDEV?.(currentlyRenderingFiber as Fiber);
		}
	}
	updateEffectImpl(PassiveEffect, HookPassive, create, deps);
}

function mountLayoutEffect(create: EffectCreate, deps?: Array<unknown>): void {
	if (__DEV__ && enableDoubleInvokingEffects) {
		mountEffectImpl(bit32.bor(MountLayoutDevEffect, UpdateEffect), HookLayout, create, deps);
	} else {
		mountEffectImpl(UpdateEffect, HookLayout, create, deps);
	}
}

function updateLayoutEffect(create: EffectCreate, deps?: Array<unknown>): void {
	updateEffectImpl(UpdateEffect, HookLayout, create, deps);
}

function imperativeHandleEffect<T>(
	create: () => T,
	ref: { current: T | undefined } | ((inst: T | undefined) => unknown) | undefined
): undefined | (() => unknown) {
	if (ref !== undefined && type(ref as unknown) === 'function') {
		const refCallback = ref as (inst: T | undefined) => unknown;
		const inst = create();
		refCallback(inst);
		return () => {
			return refCallback(undefined);
		};
	} else if (ref !== undefined) {
		const refObject = ref as { current: T | undefined } & Record<string, unknown>;
		if (__DEV__) {
			const keys = getObjectKeys(refObject);
			const isRefObject = getmetatable(refObject as unknown as object) !== undefined && keys.size() === 0;
			if (!isRefObject) {
				console.error(
					'Expected useImperativeHandle() first argument to either be a ref callback or React.createRef() object. Instead received: %s.',
					`an object with keys {${keys.join(', ')}}`
				);
			}
		}
		const inst = create();
		refObject.current = inst;
		return () => {
			refObject.current = undefined;
		};
	}
	return undefined;
}

function mountImperativeHandle<T>(
	ref: { current: T | undefined } | ((inst: T | undefined) => unknown) | undefined,
	create: () => T,
	deps: Array<unknown> | undefined
): void {
	if (__DEV__ && type(create as unknown) !== 'function') {
		console.error(
			'Expected useImperativeHandle() second argument to be a function that creates a handle. Instead received: %s.',
			create !== undefined ? type(create as unknown) : 'nil'
		);
	}
	const effectDeps = deps !== undefined ? [...deps, ref] : undefined;

	if (__DEV__ && enableDoubleInvokingEffects) {
		mountEffectImpl(
			bit32.bor(MountLayoutDevEffect, UpdateEffect),
			HookLayout,
			() => imperativeHandleEffect(create, ref),
			effectDeps
		);
	} else {
		mountEffectImpl(UpdateEffect, HookLayout, () => imperativeHandleEffect(create, ref), effectDeps);
	}
}

function updateImperativeHandle<T>(
	ref: { current: T | undefined } | ((inst: T | undefined) => unknown) | undefined,
	create: () => T,
	deps: Array<unknown> | undefined
): void {
	if (__DEV__ && type(create as unknown) !== 'function') {
		const errorArg = create ? type(create as unknown) : 'nil';
		console.error(
			'Expected useImperativeHandle() second argument to be a function that creates a handle. Instead received: %s.',
			errorArg
		);
	}
	const effectDeps = deps !== undefined ? [...deps, ref] : undefined;
	updateEffectImpl(UpdateEffect, HookLayout, () => imperativeHandleEffect(create, ref), effectDeps);
}

function mountDebugValue<T>(_value: T, _formatterFn: ((value: T) => unknown) | undefined): void {
	// No-op in core runtime.
}

const updateDebugValue = mountDebugValue;

function mountCallback<T>(callback: T, deps: Array<unknown> | undefined): T {
	const hook = mountWorkInProgressHook();
	hook.memoizedState = [callback as unknown, deps as unknown];
	return callback;
}

function updateCallback<T>(callback: T, deps: Array<unknown> | undefined): T {
	const hook = updateWorkInProgressHook();
	const prevState = hook.memoizedState as [T, Array<unknown> | undefined] | undefined;
	if (prevState !== undefined && deps !== undefined) {
		const prevDeps = prevState[1];
		if (prevDeps !== undefined && areHookInputsEqual(deps, prevDeps)) {
			return prevState[0];
		}
	}
	hook.memoizedState = [callback as unknown, deps as unknown];
	return callback;
}

function mountMemo<T>(nextCreate: () => T, deps: Array<unknown> | undefined): T {
	const hook = mountWorkInProgressHook();
	const nextValue = nextCreate();
	hook.memoizedState = [nextValue as unknown, deps];
	return nextValue;
}

function updateMemo<T>(nextCreate: () => T, deps: Array<unknown> | undefined): T {
	const hook = updateWorkInProgressHook();
	const prevState = hook.memoizedState as [T, Array<unknown> | undefined] | undefined;
	if (prevState !== undefined && deps !== undefined) {
		const prevDeps = prevState[1];
		if (prevDeps !== undefined && areHookInputsEqual(deps, prevDeps)) {
			return prevState[0];
		}
	}
	const nextValue = nextCreate();
	hook.memoizedState = [nextValue as unknown, deps];
	return nextValue;
}

const isUpdatingOpaqueValueInRenderPhase = false;

export function getIsUpdatingOpaqueValueInRenderPhaseInDEV(): boolean | undefined {
	if (__DEV__) {
		return isUpdatingOpaqueValueInRenderPhase;
	}
	return undefined;
}

function mountOpaqueIdentifier(): unknown {
	let makeId: (() => unknown) | undefined;
	if (__DEV__) {
		console.warn('!!! unimplemented: warnOnOpaqueIdentifierAccessInDEV');
	} else {
		makeId = makeClientId();
	}

	if (getIsHydrating()) {
		unimplemented('ReactFiberHooks: getIsHydrating() true');
		return undefined;
	}

	const id = (makeId as () => unknown)();
	mountState(id);
	return id;
}

function updateOpaqueIdentifier(): unknown {
	const [id] = updateState<unknown>(undefined);
	return id;
}

function rerenderOpaqueIdentifier(): unknown {
	const [id] = rerenderState<unknown>(undefined);
	return id;
}

function dispatchAction<S, A>(fiber: Fiber, queue: UpdateQueue<S, A>, action: A, ...args: Array<unknown>): void {
	if (__DEV__) {
		const extraArg = args.size() === 1 ? args[0] : undefined;
		if (type(extraArg as unknown) === 'function') {
			console.error(
				"State updates from the useState() and useReducer() Hooks don't support the second callback argument. To execute a side effect after rendering, declare it in the component body with useEffect()."
			);
		}
	}

	const eventTime = requestEventTime();
	const lane = requestUpdateLane(fiber);

	const update: Update<S, A> = {
		lane,
		action,
		eagerReducer: undefined,
		eagerState: undefined,
		next: undefined as unknown as Update<S, A>,
	};

	const pending = queue.pending;
	if (pending === undefined) {
		update.next = update;
	} else {
		update.next = pending.next;
		pending.next = update;
	}
	queue.pending = update;

	const alternate = fiber.alternate;
	if (fiber === currentlyRenderingFiber || (alternate !== undefined && alternate === currentlyRenderingFiber)) {
		didScheduleRenderPhaseUpdate = true;
		didScheduleRenderPhaseUpdateDuringThisPass = true;
	} else {
		if (fiber.lanes === NoLanes && (alternate === undefined || alternate.lanes === NoLanes)) {
			const lastRenderedReducer = queue.lastRenderedReducer;
			if (lastRenderedReducer !== undefined) {
				const prevDispatcher = ReactCurrentDispatcher.current;
				if (__DEV__) {
					ReactCurrentDispatcher.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
				}

				const currentState = queue.lastRenderedState as S;
				let eagerState = undefined as S | undefined;
				let ok = true;
				try {
					eagerState = lastRenderedReducer(currentState, action);
					update.eagerReducer = lastRenderedReducer;
					update.eagerState = eagerState;
				} catch {
					ok = false;
				}

				if (__DEV__) {
					ReactCurrentDispatcher.current = prevDispatcher;
				}

				if (ok && is(eagerState, currentState)) {
					if (FFlagReactCleanQueueOnUpdateBailout) {
						if (pending === undefined) {
							queue.pending = undefined;
						} else {
							pending.next = update.next;
							queue.pending = pending;
						}
					}
					return;
				}
			}
		}

		if (__DEV__) {
			if (type((_G as unknown as Record<string, unknown>).jest) !== 'nil' || __TESTEZ_RUNNING_TEST__) {
				warnIfNotScopedWithMatchingAct?.(fiber);
				warnIfNotCurrentlyActingUpdatesInDEV?.(fiber);
			}
		}
		scheduleUpdateOnFiber(fiber, lane, eventTime);
	}

	if (__DEV__ && enableDebugTracing && bit32.band(fiber.mode, DebugTracingMode) !== 0) {
		const name = getComponentName(fiber.type) ?? 'Unknown';
		logStateUpdateScheduled(name, lane, action as unknown);
	}

	if (enableSchedulingProfiler) {
		markStateUpdateScheduled(fiber, lane);
	}
}

type DispatcherFns = {
	useCallback: <T>(callback: T, deps: Array<unknown> | undefined) => T;
	useEffect: (create: EffectCreate, deps: Array<unknown> | undefined) => void;
	useImperativeHandle: <T>(
		ref: { current: T | undefined } | ((inst: T | undefined) => unknown) | undefined,
		create: () => T,
		deps: Array<unknown> | undefined
	) => void;
	useLayoutEffect: (create: EffectCreate, deps: Array<unknown> | undefined) => void;
	useMemo: <T>(create: () => T, deps: Array<unknown> | undefined) => T;
	useReducer: <S, I, A>(reducer: (state: S, action: A) => S, initialArg: I, init?: (arg: I) => S) => [S, Dispatch<A>];
	useRef: <T>(initialValue: T) => { current: T };
	useBinding: <T>(initialValue: T) => [ReactBinding<T>, ReactBindingUpdater<T>];
	useState: <S>(initialState: (() => S) | S) => [S, Dispatch<BasicStateAction<S>>];
	useDebugValue: <T>(value: T, formatterFn?: (value: T) => unknown) => void;
	useMutableSource: <Source, Snapshot>(
		source: MutableSource<Source>,
		getSnapshot: MutableSourceGetSnapshotFn<Source, Snapshot>,
		subscribe: MutableSourceSubscribeFn<Source, Snapshot>
	) => Snapshot;
	useOpaqueIdentifier: () => unknown;
};

function runWithTemporaryDispatcher<T>(dispatcher: Dispatcher | undefined, callback: () => T): T {
	const prevDispatcher = ReactCurrentDispatcher.current;
	ReactCurrentDispatcher.current = dispatcher;
	try {
		return callback();
	} finally {
		ReactCurrentDispatcher.current = prevDispatcher;
	}
}

function createDispatcher(fns: DispatcherFns): Dispatcher {
	return {
		readContext,
		useCallback: fns.useCallback,
		useContext: readContext,
		useEffect: fns.useEffect,
		useImperativeHandle: fns.useImperativeHandle,
		useLayoutEffect: fns.useLayoutEffect,
		useMemo: fns.useMemo,
		useReducer: fns.useReducer,
		useRef: fns.useRef,
		useBinding: fns.useBinding,
		useState: fns.useState,
		useDebugValue: fns.useDebugValue,
		useMutableSource: fns.useMutableSource,
		useOpaqueIdentifier: fns.useOpaqueIdentifier,
		unstable_isNewReconciler: enableNewReconciler,
	};
}

function createDevDispatcher(options: {
	fns: DispatcherFns;
	recordHookType: () => void;
	warnInvalidContextAccess?: () => void;
	warnInvalidHookAccess?: () => void;
	checkDeps?: boolean;
	nestedDispatcher: () => Dispatcher | undefined;
}): Dispatcher {
	const warnInvalidHookAccess = options.warnInvalidHookAccess;
	const warnInvalidContextAccess = options.warnInvalidContextAccess;
	const maybeCheckDeps = options.checkDeps === true;

	return {
		readContext: <T>(context: ReactContext<T>, observedBits?: number | boolean): T => {
			warnInvalidContextAccess?.();
			return readContext(context, observedBits);
		},
		useCallback: <T>(callback: T, deps: Array<unknown> | undefined): T => {
			currentHookNameInDev = 'useCallback';
			warnInvalidHookAccess?.();
			options.recordHookType();
			if (maybeCheckDeps) {
				checkDepsAreArrayDev(deps);
			}
			return options.fns.useCallback(callback, deps);
		},
		useContext: <T>(context: ReactContext<T>, observedBits?: number | boolean): T => {
			currentHookNameInDev = 'useContext';
			warnInvalidHookAccess?.();
			options.recordHookType();
			return readContext(context, observedBits);
		},
		useEffect: (create: EffectCreate, deps: Array<unknown> | undefined): void => {
			currentHookNameInDev = 'useEffect';
			warnInvalidHookAccess?.();
			options.recordHookType();
			if (maybeCheckDeps) {
				checkDepsAreArrayDev(deps);
			}
			options.fns.useEffect(create, deps);
		},
		useImperativeHandle: <T>(
			ref: { current: T | undefined } | ((inst: T | undefined) => unknown) | undefined,
			create: () => T,
			deps: Array<unknown> | undefined
		): void => {
			currentHookNameInDev = 'useImperativeHandle';
			warnInvalidHookAccess?.();
			options.recordHookType();
			if (maybeCheckDeps) {
				checkDepsAreArrayDev(deps);
			}
			options.fns.useImperativeHandle(ref, create, deps);
		},
		useLayoutEffect: (create: EffectCreate, deps: Array<unknown> | undefined): void => {
			currentHookNameInDev = 'useLayoutEffect';
			warnInvalidHookAccess?.();
			options.recordHookType();
			if (maybeCheckDeps) {
				checkDepsAreArrayDev(deps);
			}
			options.fns.useLayoutEffect(create, deps);
		},
		useMemo: <T>(create: () => T, deps: Array<unknown> | undefined): T => {
			currentHookNameInDev = 'useMemo';
			warnInvalidHookAccess?.();
			options.recordHookType();
			if (maybeCheckDeps) {
				checkDepsAreArrayDev(deps);
			}
			return runWithTemporaryDispatcher(options.nestedDispatcher(), () => options.fns.useMemo(create, deps));
		},
		useReducer: <S, I, A>(
			reducer: (state: S, action: A) => S,
			initialArg: I,
			init?: (arg: I) => S
		): [S, Dispatch<A>] => {
			currentHookNameInDev = 'useReducer';
			warnInvalidHookAccess?.();
			options.recordHookType();
			return runWithTemporaryDispatcher(options.nestedDispatcher(), () =>
				options.fns.useReducer(reducer, initialArg, init)
			);
		},
		useRef: <T>(initialValue: T): { current: T } => {
			currentHookNameInDev = 'useRef';
			warnInvalidHookAccess?.();
			options.recordHookType();
			return options.fns.useRef(initialValue);
		},
		useBinding: <T>(initialValue: T): [ReactBinding<T>, ReactBindingUpdater<T>] => {
			currentHookNameInDev = 'useBinding';
			warnInvalidHookAccess?.();
			options.recordHookType();
			return options.fns.useBinding(initialValue);
		},
		useState: <S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>] => {
			currentHookNameInDev = 'useState';
			warnInvalidHookAccess?.();
			options.recordHookType();
			return runWithTemporaryDispatcher(options.nestedDispatcher(), () => options.fns.useState(initialState));
		},
		useDebugValue: <T>(value: T, formatterFn?: (value: T) => unknown): void => {
			currentHookNameInDev = 'useDebugValue';
			warnInvalidHookAccess?.();
			options.recordHookType();
			options.fns.useDebugValue(value, formatterFn);
		},
		useMutableSource: <Source, Snapshot>(
			source: MutableSource<Source>,
			getSnapshot: MutableSourceGetSnapshotFn<Source, Snapshot>,
			subscribe: MutableSourceSubscribeFn<Source, Snapshot>
		): Snapshot => {
			currentHookNameInDev = 'useMutableSource';
			warnInvalidHookAccess?.();
			options.recordHookType();
			return options.fns.useMutableSource(source, getSnapshot, subscribe);
		},
		useOpaqueIdentifier: (): unknown => {
			currentHookNameInDev = 'useOpaqueIdentifier';
			warnInvalidHookAccess?.();
			options.recordHookType();
			return options.fns.useOpaqueIdentifier();
		},
		unstable_isNewReconciler: enableNewReconciler,
	};
}

export const ContextOnlyDispatcher: Dispatcher = {
	readContext,
	useCallback: throwInvalidHookError as unknown as Dispatcher['useCallback'],
	useContext: throwInvalidHookError as unknown as Dispatcher['useContext'],
	useEffect: throwInvalidHookError as unknown as Dispatcher['useEffect'],
	useImperativeHandle: throwInvalidHookError as unknown as Dispatcher['useImperativeHandle'],
	useLayoutEffect: throwInvalidHookError as unknown as Dispatcher['useLayoutEffect'],
	useMemo: throwInvalidHookError as unknown as Dispatcher['useMemo'],
	useReducer: throwInvalidHookError as unknown as Dispatcher['useReducer'],
	useRef: throwInvalidHookError as unknown as Dispatcher['useRef'],
	useBinding: throwInvalidHookError as unknown as Dispatcher['useBinding'],
	useState: throwInvalidHookError as unknown as Dispatcher['useState'],
	useDebugValue: throwInvalidHookError as unknown as Dispatcher['useDebugValue'],
	useMutableSource: throwInvalidHookError as unknown as Dispatcher['useMutableSource'],
	useOpaqueIdentifier: throwInvalidHookError as unknown as Dispatcher['useOpaqueIdentifier'],
	unstable_isNewReconciler: enableNewReconciler,
};

const HooksDispatcherOnMount = createDispatcher({
	useCallback: mountCallback,
	useEffect: mountEffect,
	useImperativeHandle: mountImperativeHandle,
	useLayoutEffect: mountLayoutEffect,
	useMemo: mountMemo,
	useReducer: mountReducer,
	useRef: mountRef,
	useBinding: mountBinding,
	useState: mountState,
	useDebugValue: mountDebugValue,
	useMutableSource: mountMutableSource,
	useOpaqueIdentifier: mountOpaqueIdentifier,
});

const HooksDispatcherOnUpdate = createDispatcher({
	useCallback: updateCallback,
	useEffect: updateEffect,
	useImperativeHandle: updateImperativeHandle,
	useLayoutEffect: updateLayoutEffect,
	useMemo: updateMemo,
	useReducer: updateReducer,
	useRef: updateRef,
	useBinding: updateBinding,
	useState: updateState,
	useDebugValue: updateDebugValue,
	useMutableSource: updateMutableSource,
	useOpaqueIdentifier: updateOpaqueIdentifier,
});

const HooksDispatcherOnRerender = createDispatcher({
	useCallback: updateCallback,
	useEffect: updateEffect,
	useImperativeHandle: updateImperativeHandle,
	useLayoutEffect: updateLayoutEffect,
	useMemo: updateMemo,
	useReducer: rerenderReducer,
	useRef: updateRef,
	useBinding: updateBinding,
	useState: rerenderState,
	useDebugValue: updateDebugValue,
	useMutableSource: updateMutableSource,
	useOpaqueIdentifier: rerenderOpaqueIdentifier,
});

if (__DEV__) {
	const warnInvalidContextAccess = () => {
		console.error(
			'Context can only be read while React is rendering. In classes, you can read it in the render method or getDerivedStateFromProps. In function components, you can read it directly in the function body, but not inside Hooks like useReducer() or useMemo().'
		);
	};

	const warnInvalidHookAccess = () => {
		console.error(
			'Do not call Hooks inside useEffect(...), useMemo(...), or other built-in Hooks. You can only call Hooks at the top level of your React function. For more information, see https://reactjs.org/link/rules-of-hooks'
		);
	};

	HooksDispatcherOnMountInDEV = createDevDispatcher({
		fns: {
			useCallback: mountCallback,
			useEffect: mountEffect,
			useImperativeHandle: mountImperativeHandle,
			useLayoutEffect: mountLayoutEffect,
			useMemo: mountMemo,
			useReducer: mountReducer,
			useRef: mountRef,
			useBinding: mountBinding,
			useState: mountState,
			useDebugValue: mountDebugValue,
			useMutableSource: mountMutableSource,
			useOpaqueIdentifier: mountOpaqueIdentifier,
		},
		recordHookType: mountHookTypesDev,
		checkDeps: true,
		nestedDispatcher: () => InvalidNestedHooksDispatcherOnMountInDEV,
	});

	HooksDispatcherOnMountWithHookTypesInDEV = createDevDispatcher({
		fns: {
			useCallback: mountCallback,
			useEffect: mountEffect,
			useImperativeHandle: mountImperativeHandle,
			useLayoutEffect: mountLayoutEffect,
			useMemo: mountMemo,
			useReducer: mountReducer,
			useRef: mountRef,
			useBinding: mountBinding,
			useState: mountState,
			useDebugValue: mountDebugValue,
			useMutableSource: mountMutableSource,
			useOpaqueIdentifier: mountOpaqueIdentifier,
		},
		recordHookType: updateHookTypesDev,
		nestedDispatcher: () => InvalidNestedHooksDispatcherOnMountInDEV,
	});

	HooksDispatcherOnUpdateInDEV = createDevDispatcher({
		fns: {
			useCallback: updateCallback,
			useEffect: updateEffect,
			useImperativeHandle: updateImperativeHandle,
			useLayoutEffect: updateLayoutEffect,
			useMemo: updateMemo,
			useReducer: updateReducer,
			useRef: updateRef,
			useBinding: updateBinding,
			useState: updateState,
			useDebugValue: updateDebugValue,
			useMutableSource: updateMutableSource,
			useOpaqueIdentifier: updateOpaqueIdentifier,
		},
		recordHookType: updateHookTypesDev,
		nestedDispatcher: () => InvalidNestedHooksDispatcherOnUpdateInDEV,
	});

	HooksDispatcherOnRerenderInDEV = createDevDispatcher({
		fns: {
			useCallback: updateCallback,
			useEffect: updateEffect,
			useImperativeHandle: updateImperativeHandle,
			useLayoutEffect: updateLayoutEffect,
			useMemo: updateMemo,
			useReducer: rerenderReducer,
			useRef: updateRef,
			useBinding: updateBinding,
			useState: rerenderState,
			useDebugValue: updateDebugValue,
			useMutableSource: updateMutableSource,
			useOpaqueIdentifier: rerenderOpaqueIdentifier,
		},
		recordHookType: updateHookTypesDev,
		nestedDispatcher: () => InvalidNestedHooksDispatcherOnRerenderInDEV,
	});

	InvalidNestedHooksDispatcherOnMountInDEV = createDevDispatcher({
		fns: {
			useCallback: mountCallback,
			useEffect: mountEffect,
			useImperativeHandle: mountImperativeHandle,
			useLayoutEffect: mountLayoutEffect,
			useMemo: mountMemo,
			useReducer: mountReducer,
			useRef: mountRef,
			useBinding: mountBinding,
			useState: mountState,
			useDebugValue: mountDebugValue,
			useMutableSource: mountMutableSource,
			useOpaqueIdentifier: mountOpaqueIdentifier,
		},
		recordHookType: mountHookTypesDev,
		warnInvalidContextAccess,
		warnInvalidHookAccess,
		nestedDispatcher: () => InvalidNestedHooksDispatcherOnMountInDEV,
	});

	InvalidNestedHooksDispatcherOnUpdateInDEV = createDevDispatcher({
		fns: {
			useCallback: updateCallback,
			useEffect: updateEffect,
			useImperativeHandle: updateImperativeHandle,
			useLayoutEffect: updateLayoutEffect,
			useMemo: updateMemo,
			useReducer: updateReducer,
			useRef: updateRef,
			useBinding: updateBinding,
			useState: updateState,
			useDebugValue: updateDebugValue,
			useMutableSource: updateMutableSource,
			useOpaqueIdentifier: updateOpaqueIdentifier,
		},
		recordHookType: updateHookTypesDev,
		warnInvalidContextAccess,
		warnInvalidHookAccess,
		nestedDispatcher: () => InvalidNestedHooksDispatcherOnUpdateInDEV,
	});

	InvalidNestedHooksDispatcherOnRerenderInDEV = createDevDispatcher({
		fns: {
			useCallback: updateCallback,
			useEffect: updateEffect,
			useImperativeHandle: updateImperativeHandle,
			useLayoutEffect: updateLayoutEffect,
			useMemo: updateMemo,
			useReducer: rerenderReducer,
			useRef: updateRef,
			useBinding: updateBinding,
			useState: rerenderState,
			useDebugValue: updateDebugValue,
			useMutableSource: updateMutableSource,
			useOpaqueIdentifier: rerenderOpaqueIdentifier,
		},
		recordHookType: updateHookTypesDev,
		warnInvalidContextAccess,
		warnInvalidHookAccess,
		nestedDispatcher: () => InvalidNestedHooksDispatcherOnUpdateInDEV,
	});
}

export function renderWithHooks<Props, SecondArg>(
	current: Fiber | undefined,
	workInProgress: Fiber,
	Component: (p: Props, arg: SecondArg) => unknown,
	props: Props,
	secondArg: SecondArg,
	nextRenderLanes: Lanes
): unknown {
	renderLanes = nextRenderLanes;
	currentlyRenderingFiber = workInProgress;

	if (__DEV__) {
		hookTypesDev = current?._debugHookTypes as Array<HookType> | undefined;
		hookTypesUpdateIndexDev = -1;
	}

	workInProgress.memoizedState = undefined;
	workInProgress.updateQueue = undefined;
	workInProgress.lanes = NoLanes;

	if (__DEV__) {
		if (current !== undefined && (current.memoizedState as unknown) !== undefined) {
			ReactCurrentDispatcher.current = HooksDispatcherOnUpdateInDEV;
		} else if (hookTypesDev !== undefined) {
			ReactCurrentDispatcher.current = HooksDispatcherOnMountWithHookTypesInDEV;
		} else {
			ReactCurrentDispatcher.current = HooksDispatcherOnMountInDEV;
		}
	} else {
		ReactCurrentDispatcher.current =
			current === undefined || (current.memoizedState as unknown) === undefined
				? HooksDispatcherOnMount
				: HooksDispatcherOnUpdate;
	}

	let children = Component(props, secondArg);

	if (didScheduleRenderPhaseUpdateDuringThisPass) {
		let numberOfReRenders = 0;
		do {
			didScheduleRenderPhaseUpdateDuringThisPass = false;
			if (numberOfReRenders >= RE_RENDER_LIMIT) {
				error('Too many re-renders. React limits the number of renders to prevent an infinite loop.');
			}
			numberOfReRenders += 1;

			currentHook = undefined;
			workInProgressHook = undefined;
			workInProgress.updateQueue = undefined;

			if (__DEV__) {
				hookTypesUpdateIndexDev = -1;
			}

			ReactCurrentDispatcher.current = __DEV__ ? HooksDispatcherOnRerenderInDEV : HooksDispatcherOnRerender;
			children = Component(props, secondArg);
		} while (didScheduleRenderPhaseUpdateDuringThisPass);
	}

	ReactCurrentDispatcher.current = ContextOnlyDispatcher;

	if (__DEV__) {
		workInProgress._debugHookTypes = hookTypesDev;
	}

	const didRenderTooFewHooks = currentHook !== undefined && currentHook.next !== undefined;

	renderLanes = NoLanes;
	currentlyRenderingFiber = undefined;
	currentHook = undefined;
	workInProgressHook = undefined;

	if (__DEV__) {
		currentHookNameInDev = undefined;
		hookTypesDev = undefined;
		hookTypesUpdateIndexDev = -1;
	}

	didScheduleRenderPhaseUpdate = false;

	if (didRenderTooFewHooks) {
		let childrenName = 'unknown';
		if (type(children as unknown) === 'table') {
			const childType = (children as Record<string, unknown>).type;
			if (childType !== undefined) {
				childrenName = getComponentName(childType) ?? childrenName;
			}
		}
		error(
			`Rendered fewer hooks than expected. This may be caused by an accidental early return statement. Inside '${childrenName}'`
		);
	}

	return children;
}

export default {
	bailoutHooks,
	resetHooksAfterThrow,
	getIsUpdatingOpaqueValueInRenderPhaseInDEV,
	ContextOnlyDispatcher,
	renderWithHooks,
};
