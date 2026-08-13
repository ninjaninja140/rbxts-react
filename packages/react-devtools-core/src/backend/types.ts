/**
 * Backend type contracts for the React DevTools backend.
 *
 * Ported from `react-devtools-shared/src/backend/types.js` (React 17).
 *
 * @module backend/types
 * @packageDocumentation
 */

import type { ComponentFilter, ElementType } from '../types';

// Scalar aliases

/** React fiber work tag (see {@link WorkTagMap}). */
export type WorkTag = number;

/** React fiber work flags. */
export type WorkFlags = number;

/** React expiration time / lane value. */
export type ExpirationTime = number;

// Fiber

/**
 * A React fiber node.
 *
 * The reconciler stores its tree as a doubly-linked list of these nodes.
 * The DevTools backend walks `child` / `sibling` / `return` to reconstruct
 * the component tree, and reads `memoizedProps`, `memoizedState`,
 * `updateQueue`, etc. when inspecting elements.
 *
 * Fields are intentionally permissive: fibers are created by the runtime
 * and are not under our control.
 */
export interface Fiber {
	tag: WorkTag;
	key: string | number | undefined;
	elementType: unknown;
	type: unknown;
	stateNode: unknown;
	return: Fiber | undefined;
	child: Fiber | undefined;
	sibling: Fiber | undefined;
	index: number;
	ref: unknown;
	pendingProps: Record<string, unknown>;
	memoizedProps: Record<string, unknown>;
	updateQueue: unknown;
	memoizedState: unknown;
	contextDependencies: unknown;
	alternate: Fiber | undefined;
	flags: WorkFlags;
	subtreeFlags: WorkFlags;
	deletions: Array<Fiber> | undefined;
	lanes: number;
	childLanes: number;
	_debugOwner: Fiber | undefined;
	_debugSource: unknown;
	_debugID: number;
	_debugHookTypes: Array<string> | undefined;
	_debugNeedsRemount: boolean;
	[key: string]: unknown;
}

/** The numeric work tags used by the React 17 reconciler. */
export interface WorkTagMap {
	Block: WorkTag;
	ClassComponent: WorkTag;
	ContextConsumer: WorkTag;
	ContextProvider: WorkTag;
	CoroutineComponent: WorkTag;
	CoroutineHandlerPhase: WorkTag;
	DehydratedSuspenseComponent: WorkTag;
	ForwardRef: WorkTag;
	Fragment: WorkTag;
	FunctionComponent: WorkTag;
	HostComponent: WorkTag;
	HostPortal: WorkTag;
	HostRoot: WorkTag;
	HostText: WorkTag;
	IncompleteClassComponent: WorkTag;
	IndeterminateComponent: WorkTag;
	LazyComponent: WorkTag;
	MemoComponent: WorkTag;
	Mode: WorkTag;
	OffscreenComponent: WorkTag;
	Profiler: WorkTag;
	SimpleMemoComponent: WorkTag;
	SuspenseComponent: WorkTag;
	SuspenseListComponent: WorkTag;
	YieldComponent: WorkTag;
}

// Basic value contracts

/** Lightweight metadata for a fiber. */
export interface FiberData {
	key: string | undefined;
	displayName: string | undefined;
	type: ElementType;
}

/** A native (Roblox instance) that the renderer manages. */
export type NativeType = object;

/** A numeric id assigned to a renderer. */
export type RendererID = number;

/** A reference holding the current React dispatcher (or `undefined`). */
export interface CurrentDispatcherRef {
	current: unknown;
}

/** Resolves a fiber id to a display name. */
export type GetDisplayNameForFiberID = (id: number, findNearestUnfilteredAncestor?: boolean) => string | undefined;

/** Resolves a native instance to a fiber id. */
export type GetFiberIDForNative = (native: NativeType, findNearestUnfilteredAncestor?: boolean) => number | undefined;

/** Finds all native instances rendered by a fiber. */
export type FindNativeNodesForFiberID = (id: number) => Array<NativeType> | undefined;

// React renderer

/** A React context provider object. */
export interface ReactProviderType<_T> {
	$$typeof: number;
	_context: unknown;
	[key: string]: unknown;
}

/** The shape of a renderer as exposed through `__REACT_DEVTOOLS_GLOBAL_HOOK__`. */
export interface ReactRenderer {
	findFiberByHostInstance: (native: NativeType) => Fiber | undefined;
	version: string;
	rendererPackageName: string;
	bundleType: number;
	overrideHookState: (fiber: object, hookID: number, path: Array<string | number>, value: unknown) => void;
	overrideHookStateDeletePath: (fiber: object, hookID: number, path: Array<string | number>) => void;
	overrideHookStateRenamePath: (
		fiber: object,
		hookID: number,
		oldPath: Array<string | number>,
		newPath: Array<string | number>
	) => void;
	overrideProps: (fiber: object, path: Array<string | number>, value: unknown) => void;
	overridePropsDeletePath: (fiber: object, path: Array<string | number>) => void;
	overridePropsRenamePath: (fiber: object, oldPath: Array<string | number>, newPath: Array<string | number>) => void;
	scheduleUpdate: (fiber: object) => void;
	setSuspenseHandler: (shouldSuspend: (fiber: object) => boolean) => void;
	currentDispatcherRef: CurrentDispatcherRef | undefined;
	getCurrentFiber: (() => Fiber | undefined) | undefined;
	ComponentTree?: unknown;
	Mount?: unknown;
}

/** Marker type used by the hydration layer for "encode to null". */
export interface EncodeToNull {
	__T: 'ENCODE_TO_NULL';
}

/** A `null` value with the hydration marker, used in ChangeDescription. */
export type HydrationNull = EncodeToNull | undefined;

/** Describes what changed for a fiber during a commit. */
export interface ChangeDescription {
	context: Array<string> | boolean | HydrationNull;
	didHooksChange: boolean;
	isFirstMount: boolean;
	props: Array<string> | HydrationNull;
	state: Array<string> | HydrationNull;
}

/** Profiling data collected for one commit. */
export interface CommitDataBackend {
	changeDescriptions: Array<Array<number | ChangeDescription>> | undefined;
	duration: number;
	fiberActualDurations: Array<Array<number>>;
	fiberSelfDurations: Array<Array<number>>;
	interactionIDs: Array<number>;
	priorityLevel: string | undefined;
	timestamp: number;
}

/** Profiling data collected for one root. */
export interface ProfilingDataForRootBackend {
	commitData: Array<CommitDataBackend>;
	displayName: string;
	initialTreeBaseDurations: Array<unknown>;
	interactionCommits: Array<unknown>;
	interactions: Array<unknown>;
	rootID: number;
}

/** Profiling data collected by the renderer interface. */
export interface ProfilingDataBackend {
	dataForRoots: Array<ProfilingDataForRootBackend>;
	rendererID: number;
}

// Owners / paths

/** A single frame of a component path. */
export interface PathFrame {
	key: string | number | undefined;
	index: number;
	displayName: string | undefined;
}

/** A match for a tracked path. */
export interface PathMatch {
	id: number;
	isFullMatch: boolean;
}

/** An element owner. */
export interface Owner {
	displayName: string | undefined;
	id: number;
	type: ElementType;
}

/** The owners of an element. */
export interface OwnersList {
	id: number;
	owners: Array<Owner> | undefined;
}

// Inspected elements

/** Full data payload for an inspected element. */
export interface InspectedElement {
	id: number;
	displayName: string | undefined;
	canEditHooks: boolean;
	canEditFunctionProps: boolean;
	canEditHooksAndDeletePaths: boolean;
	canEditHooksAndRenamePaths: boolean;
	canEditFunctionPropsDeletePaths: boolean;
	canEditFunctionPropsRenamePaths: boolean;
	canToggleSuspense: boolean;
	canViewSource: boolean;
	hasLegacyContext: boolean;
	context: Record<string, unknown> | undefined;
	hooks: Record<string, unknown> | undefined;
	props: Record<string, unknown> | undefined;
	state: Record<string, unknown> | undefined;
	key: number | string | undefined;
	owners: Array<Owner> | undefined;
	source: unknown;
	type_: ElementType;
	rootType: string | undefined;
	rendererPackageName: string | undefined;
	rendererVersion: string | undefined;
}

/** Inspect-element payload kind constants. */
export const InspectElementFullDataType = 'full-data';
export const InspectElementNoChangeType = 'no-change';
export const InspectElementNotFoundType = 'not-found';
export const InspectElementHydratedPathType = 'hydrated-path';

export interface InspectElementFullData {
	id: number;
	type: string;
	value: InspectedElement;
}

export interface InspectElementHydratedPath {
	id: number;
	type: string;
	path: Array<string | number>;
	value: unknown;
}

export interface InspectElementNoChange {
	id: number;
	type: string;
}

export interface InspectElementNotFound {
	id: number;
	type: string;
}

/** Union of inspect-element responses. */
export type InspectedElementPayload =
	| InspectElementFullData
	| InspectElementHydratedPath
	| InspectElementNoChange
	| InspectElementNotFound;

/** A native instance plus its resolved style. */
export interface InstanceAndStyle {
	instance: object | undefined;
	style: object | undefined;
}

// Renderer interface

/**
 * The DevTools-facing interface for a single React renderer.
 *
 * `backend/renderer.ts` constructs one of these per attached renderer and
 * wires it into the {@link DevToolsHook}.
 */
export interface RendererInterface {
	cleanup: () => void;
	copyElementPath: (id: number, path: Array<string | number>) => void;
	deletePath: (type: string, id: number, hookID: number | undefined, path: Array<string | number>) => void;
	findNativeNodesForFiberID: FindNativeNodesForFiberID;
	flushInitialOperations: () => void;
	getBestMatchForTrackedPath: () => PathMatch | undefined;
	getFiberIDForNative: GetFiberIDForNative;
	getDisplayNameForFiberID: GetDisplayNameForFiberID;
	getInstanceAndStyle: (id: number) => InstanceAndStyle;
	getProfilingData: () => ProfilingDataBackend;
	getOwnersList: (id: number) => Array<Owner> | undefined;
	getPathForElement: (id: number) => Array<PathFrame> | undefined;
	handleCommitFiberRoot: (root: object, priorityLevel?: number) => void;
	handleCommitFiberUnmount: (fiber: object) => void;
	inspectElement: (id: number, path?: Array<string | number>) => InspectedElementPayload;
	logElementToConsole: (id: number) => void;
	overrideSuspense: (id: number, forceFallback: boolean) => void;
	overrideValueAtPath: (
		type: string,
		id: number,
		hookID: number | undefined,
		path: Array<string | number>,
		value: unknown
	) => void;
	prepareViewAttributeSource: (id: number, path: Array<string | number>) => void;
	prepareViewElementSource: (id: number) => void;
	renamePath: (
		type: string,
		id: number,
		hookID: number | undefined,
		oldPath: Array<string | number>,
		newPath: Array<string | number>
	) => void;
	renderer: ReactRenderer | undefined;
	setTraceUpdatesEnabled: (enabled: boolean) => void;
	setTrackedPath: (path: Array<PathFrame> | undefined) => void;
	startProfiling: (recordChangeDescriptions: boolean) => void;
	stopProfiling: () => void;
	storeAsGlobal: (id: number, path: Array<string | number>, count: number) => void;
	updateComponentFilters: (filters: Array<ComponentFilter>) => void;
	getDisplayNameForRoot: (fiber: Fiber) => string;
}

/** A generic event handler. */
export type Handler = (data: unknown) => void;

// DevTools hook

/**
 * The object installed at `__REACT_DEVTOOLS_GLOBAL_HOOK__`.
 *
 * The renderer calls `inject`, `onCommitFiberRoot`, `onCommitFiberUnmount`
 * and `checkDCE`; the DevTools backend subscribes to events through
 * `on` / `sub` and reads/writes the renderer maps.
 */
export interface DevToolsHook {
	listeners: Record<string, Array<Handler>>;
	rendererInterfaces: Map<RendererID, RendererInterface>;
	renderers: Map<RendererID, ReactRenderer>;

	emit: (event: string, data: unknown) => void;
	getFiberRoots: (rendererID: RendererID) => Set<object>;
	inject: (renderer: ReactRenderer) => number | undefined;
	on: (event: string, handler: Handler) => void;
	off: (event: string, handler: Handler) => void;
	reactDevtoolsAgent: object | undefined;
	sub: (event: string, handler: Handler) => () => void;

	resolveRNStyle?: (style: unknown) => object | undefined;
	nativeStyleEditorValidAttributes?: Array<string>;

	checkDCE: (fn: (...args: Array<unknown>) => unknown) => void;
	onCommitFiberUnmount: (rendererID: RendererID, fiber: object) => void;
	onCommitFiberRoot: (rendererID: RendererID, root: object, priorityLevel?: number, didError?: boolean) => void;

	supportsFiber: boolean;
	isDisabled?: boolean;
}
