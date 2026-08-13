/**
 * Internal fiber-reconciler type definitions.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactInternalTypes.lua`
 * (itself a port of Facebook's `packages/react-reconciler/src/ReactInternalTypes.js`).
 *
 * These describe the mutable work objects the reconciler allocates and mutates
 * while walking the fiber tree. They are intentionally loose in places (e.g.
 * `pendingProps`, `updateQueue`, `stateNode`) because the concrete shape
 * depends on the fiber's work tag.
 *
 * @module ReactInternalTypes
 * @internal
 * @packageDocumentation
 */

import type {
	Source,
	RefObject,
	ReactContext,
	MutableSource,
	MutableSourceVersion,
	MutableSourceSubscribeFn,
	MutableSourceGetSnapshotFn,
	Wakeable,
	Dispatcher as SharedDispatcher,
} from '@nrbx/react-shared';

import type { WorkTag } from './ReactWorkTags';
import type { TypeOfMode } from './ReactTypeOfMode';
import type { Flags } from './ReactFiberFlags';

/** Arbitrary Luau table. */
export type Object = { [key: string]: any };

/** A simple set encoded as a keyed table (`{ [value]: true }`). */
export type SimpleSet<_T> = { [key: string]: boolean };

/** A simple map encoded as a keyed table (`{ [key]: value }`). */
export type SimpleMap<_K, V> = { [key: string]: V };

// ROBLOX deviation: SuspenseInstance is `any` upstream because the host config
// cannot be resolved statically (the renderer splices it in at runtime).
export type SuspenseInstance = any;

export type LanePriority = number;
export type Lanes = number;
export type Lane = number;
export type LaneMap<T> = { [key: number]: T };

export type Update<State> = {
	// TODO: Temporary field. Will remove this by storing a map of
	// transition -> event time on the root.
	eventTime: number;
	lane: Lane;

	// ROBLOX deviation: Luau has no singleton-integer literal types.
	// tag: 0 | 1 | 2 | 3;
	tag: number;
	payload: any;
	callback: ((...args: Array<defined>) => any) | undefined;

	next: Update<State> | undefined;
};

export type SharedQueue<State> = {
	pending: Update<State> | undefined;
};

export type UpdateQueue<State> = {
	baseState: State;
	firstBaseUpdate: Update<State> | undefined;
	lastBaseUpdate: Update<State> | undefined;
	shared: SharedQueue<State>;
	effects: Array<Update<State>> | undefined;
};

export type HookType =
	| 'useState'
	| 'useReducer'
	| 'useContext'
	| 'useRef'
	// ROBLOX deviation: Bindings are a feature unique to Roblox React.
	| 'useBinding'
	| 'useEffect'
	| 'useLayoutEffect'
	| 'useCallback'
	| 'useMemo'
	| 'useImperativeHandle'
	| 'useDebugValue'
	| 'useDeferredValue'
	| 'useTransition'
	| 'useMutableSource'
	| 'useOpaqueIdentifier';

import type { RootTag } from './ReactRootTags';
export type { RootTag };

// ROBLOX deviation: timeout types live behind the dynamic host-config splice.
export type TimeoutHandle = defined;
export type NoTimeout = defined;

// ROBLOX deviation: Scheduler's `Interaction` type is defined here to avoid a
// dependency on the scheduler's tracing subsystem in this type-only module.
export type Interaction = {
	__count: number;
	id: number;
	name: string;
	timestamp: number;
};

// ROBLOX deviation: Luau has no union literal types for priority levels.
export type ReactPriorityLevel = number;

export type ContextDependency<T> = {
	context: ReactContext<T>;
	observedBits: number;
	next: ContextDependency<T> | undefined;
};

export type Dependencies = {
	lanes: Lanes;
	firstContext: ContextDependency<any> | undefined;
};

// ROBLOX deviation: Roact stable keys — slightly widened so existing Roact
// code keeps working. Includes numbers for mixed/sparse tables.
export type RoactStableKey = string | number;

/**
 * A fiber is a unit of work on a component that needs to be done or was done.
 * There can be more than one per component.
 */
export type Fiber = {
	// Tag identifying the type of fiber.
	tag: WorkTag;

	// ROBLOX deviation: permissive key type to allow sparse arrays, which are
	// still distinct from actual arrays. Unique identifier of this child.
	key: RoactStableKey | undefined;

	// The value of element.type, used to preserve identity during
	// reconciliation of this child.
	elementType: any;

	// The resolved function/class associated with this fiber.
	type: any;

	// The local state associated with this fiber.
	stateNode: any;

	// Remaining fields belong to Fiber.

	// The fiber to return to after finishing processing this one.
	// This is effectively the parent, but there can be multiple parents (two)
	// so this is only the parent of the thing we're currently processing.
	// It is conceptually the same as the return address of a stack frame.
	return_: Fiber | undefined;

	// Singly linked list tree structure.
	child: Fiber | undefined;
	sibling: Fiber | undefined;
	index: number;

	// The ref last used to attach this node.
	// ROBLOX deviation: Lua doesn't allow fields on functions, so refs are
	// restricted to callbacks, string-ref records, or ref objects.
	ref: undefined | ((handle: any) => void) | { _stringRef?: string; [key: string]: any } | RefObject;

	// Input is the data coming into process this fiber. Arguments. Props.
	pendingProps: any; // This type will be more specific once we overload the tag.
	memoizedProps: any; // The props used to create the output.

	// A queue of state updates and callbacks.
	updateQueue: any;

	// The state used to create the output.
	memoizedState: any;

	// Dependencies (contexts, events) for this fiber, if it has any.
	dependencies: Dependencies | undefined;

	// Bitfield describing properties about the fiber and its subtree. E.g. the
	// ConcurrentMode flag indicates whether the subtree should be async by
	// default. When a fiber is created it inherits the mode of its parent.
	// Additional flags can be set at creation time, but after that the value
	// should remain unchanged throughout the fiber's lifetime, particularly
	// before its child fibers are created.
	mode: TypeOfMode;

	// Effects.
	flags: Flags;
	subtreeFlags: Flags;
	deletions: Array<Fiber> | undefined;

	// Singly linked list fast path to the next fiber with side effects.
	nextEffect: Fiber | undefined;

	// The first and last fiber with side effects within this subtree. This
	// allows us to reuse a slice of the linked list when we reuse the work done
	// within this fiber.
	firstEffect: Fiber | undefined;
	lastEffect: Fiber | undefined;

	lanes: Lanes;
	childLanes: Lanes;

	// This is a pooled version of a fiber. Every fiber that gets updated will
	// eventually have a pair. There are cases when we can clean up pairs to save
	// memory if we need to.
	alternate: Fiber | undefined;

	// Profiling fields (only set when enableProfilerTimer is enabled).
	actualDuration: number | undefined;
	actualStartTime: number | undefined;
	selfBaseDuration: number | undefined;
	treeBaseDuration: number | undefined;

	// ReactGlobals.__DEV__ only.
	_debugID: number | undefined;
	_debugSource: Source | undefined;
	_debugOwner: Fiber | undefined;
	_debugIsCurrentlyTiming: boolean | undefined;
	_debugNeedsRemount: boolean | undefined;

	// Used to verify that the order of hooks does not change between renders.
	_debugHookTypes: Array<HookType> | undefined;
};

export type SuspenseHydrationCallbacks = {
	onHydrated: ((instance: SuspenseInstance) => void) | undefined;
	onDeleted: ((instance: SuspenseInstance) => void) | undefined;
};

/**
 * The exported FiberRoot type includes all properties to avoid requiring
 * potentially error-prone `any` casts throughout the project. Profiling
 * properties are only safe to access in profiling builds (when
 * enableSchedulerTracing is true), but are always declared so they stay in
 * sync.
 */
export type FiberRoot = {
	// The type of root (legacy, batched, concurrent, etc.)
	tag: RootTag;

	// Any additional information from the host associated with this root.
	containerInfo: any;

	// Used only by persistent updates.
	pendingChildren: any;

	// The currently active root fiber. This is the mutable root of the tree.
	current: Fiber;

	// ROBLOX deviation: lightweight unordered set for performance.
	pingCache: SimpleMap<Wakeable, SimpleSet<any> | SimpleMap<Wakeable, SimpleSet<any>>> | undefined;

	// A finished work-in-progress HostRoot that's ready to be committed.
	finishedWork: Fiber | undefined;

	// Timeout handle returned by setTimeout. Used to cancel a pending timeout,
	// if it's superseded by a new one.
	timeoutHandle: TimeoutHandle | NoTimeout;

	// Top context object, used by renderSubtreeIntoContainer.
	context: Object | undefined;
	pendingContext: Object | undefined;

	// Determines if we should attempt to hydrate on the initial mount.
	hydrate: boolean;

	// Used by useMutableSource hook to avoid tearing during hydration.
	mutableSourceEagerHydrationData: Array<MutableSource<any> | MutableSourceVersion> | undefined;

	// Node returned by Scheduler.scheduleCallback. Represents the next
	// rendering task that the root will work on. Either a scheduler `Task`,
	// the sync-callback sentinel, or `undefined` when nothing is scheduled.
	callbackNode: unknown;
	callbackPriority: LanePriority;
	eventTimes: LaneMap<number>;
	expirationTimes: LaneMap<number>;

	pendingLanes: Lanes;
	suspendedLanes: Lanes;
	pingedLanes: Lanes;
	expiredLanes: Lanes;
	mutableReadLanes: Lanes;

	finishedLanes: Lanes;

	entangledLanes: Lanes;
	entanglements: LaneMap<Lanes>;

	// Interaction-tracing fields (only meaningful when enableSchedulerTracing
	// is enabled).
	interactionThreadID: number;
	memoizedInteractions: Set<Interaction>;
	pendingInteractionMap: Map<Lane | Lanes, Set<Interaction>>;

	// Suspense-callback fields (only used during hydration).
	hydrationCallbacks: SuspenseHydrationCallbacks | undefined;
};

export type BasicStateAction<S> = ((state: S) => S) | S;
export type Dispatch<A> = (value: A) => void;

// ROBLOX deviation: Dispatcher is defined in @nrbx/react-shared to avoid
// circular dependencies; re-export it here for the reconciler's API.
export type Dispatcher = SharedDispatcher;

// Keep MutableSource* referenced so importers can reach them through this
// module if needed (the reconciler re-exports a subset publicly).
export type {
	Source,
	RefObject,
	ReactContext,
	MutableSource,
	MutableSourceVersion,
	MutableSourceSubscribeFn,
	MutableSourceGetSnapshotFn,
	Wakeable,
};
