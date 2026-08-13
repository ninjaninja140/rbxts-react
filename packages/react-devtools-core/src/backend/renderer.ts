/**
 * React DevTools backend renderer.
 *
 * A faithful TypeScript port of the React 17
 * `react-devtools-shared/src/backend/renderer.js` / `renderer.lua` implementation,
 * adapted for the Roblox runtime. Each attached React renderer is wrapped in a
 * {@link RendererInterface} that walks the fiber tree, records mount/unmount and
 * update operations, and answers inspection requests from the DevTools frontend.
 *
 * @module backend/renderer
 * @packageDocumentation
 */

import { Reconciler } from '@nrbx/react';
import { inspectHooksOfFiber } from '@nrbx/react-debug-tools';
import { Console } from './console';
import {
	CONCURRENT_MODE_NUMBER,
	CONCURRENT_MODE_SYMBOL_STRING,
	CONTEXT_NUMBER,
	CONTEXT_SYMBOL_STRING,
	DEPRECATED_ASYNC_MODE_SYMBOL_STRING,
	FORWARD_REF_NUMBER,
	FORWARD_REF_SYMBOL_STRING,
	MEMO_NUMBER,
	MEMO_SYMBOL_STRING,
	PROFILER_NUMBER,
	PROFILER_SYMBOL_STRING,
	PROVIDER_NUMBER,
	PROVIDER_SYMBOL_STRING,
	SCOPE_NUMBER,
	SCOPE_SYMBOL_STRING,
	STRICT_MODE_NUMBER,
	STRICT_MODE_SYMBOL_STRING,
} from './ReactSymbols';
import {
	__DEBUG__,
	SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY,
	SESSION_STORAGE_RELOAD_AND_PROFILE_KEY,
	TREE_OPERATION_ADD,
	TREE_OPERATION_REMOVE,
	TREE_OPERATION_REORDER_CHILDREN,
	TREE_OPERATION_UPDATE_TREE_BASE_DURATION,
} from '../constants';
import { cleanForBridge, copyToClipboard, copyWithDelete, copyWithRename, copyWithSet } from './utils';
import { sessionStorageGetItem } from '../storage';
import {
	ComponentFilterDisplayName,
	ComponentFilterElementType,
	ComponentFilterHOC,
	ComponentFilterLocation,
	ElementTypeClass,
	ElementTypeContext,
	ElementTypeForwardRef,
	ElementTypeFunction,
	ElementTypeHostComponent,
	ElementTypeMemo,
	ElementTypeOtherOrUnknown,
	ElementTypeProfiler,
	ElementTypeRoot,
	ElementTypeSuspense,
	ElementTypeSuspenseList,
	type ComponentFilter,
	type ElementType,
	type ElementTypeComponentFilter,
	type RegExpComponentFilter,
} from '../types';
import {
	deletePathInObject,
	getAllEnumerableKeys,
	getDefaultComponentFilters,
	getDisplayName,
	getInObject,
	getUID,
	getWrappedDisplayName,
	isArray,
	renamePathInObject,
	setInObject,
	slice,
	utfEncodeString,
} from '../utils';
import type { Interaction } from '../devtools/views/Profiler/types';
import type {
	ChangeDescription,
	CommitDataBackend,
	DevToolsHook,
	Fiber,
	InspectedElement,
	InspectedElementPayload,
	InstanceAndStyle,
	NativeType,
	Owner,
	PathFrame,
	PathMatch,
	ProfilingDataBackend,
	ProfilingDataForRootBackend,
	ReactRenderer,
	RendererInterface,
	WorkTagMap,
} from './types';

// Local aliases

/** A loose object table. */
type Obj = Record<string, unknown>;

/** A class component instance as far as the backend needs to understand it. */
interface ClassInstance {
	context: unknown;
	props: Obj;
	state: Obj;
	forceUpdate: () => void;
}

/** React priority level values (copied from React source). */
interface ReactPriorityLevels {
	ImmediatePriority: number;
	UserBlockingPriority: number;
	NormalPriority: number;
	LowPriority: number;
	IdlePriority: number;
	NoPriority: number;
}

/** React side effect flags (copied from React source). */
interface ReactTypeOfSideEffect {
	NoFlags: number;
	PerformedWork: number;
	Placement: number;
}

/** The result of {@link getInternalReactConstants}. */
interface InternalReactConstants {
	getDisplayNameForFiber: (fiber: Fiber) => string | undefined;
	getTypeSymbol: (type_: unknown) => string | number;
	ReactPriorityLevels: ReactPriorityLevels;
	ReactTypeOfSideEffect: ReactTypeOfSideEffect;
	ReactTypeOfWork: WorkTagMap;
}

/** Per-commit profiling metadata collected while profiling is active. */
interface CommitProfilingData {
	changeDescriptions: Map<number, ChangeDescription> | undefined;
	commitTime: number;
	durations: Array<number>;
	interactions: Array<Interaction>;
	maxActualDuration: number;
	priorityLevel: string | undefined;
}

type CommitProfilingMetadataMap = Map<number, Array<CommitProfilingData>>;
type DisplayNamesByRootID = Map<number, string>;

// Language-level helpers missing from the Roblox standard library

/** `Object.is`-style reference equality (handles NaN). */
function objectIs(a: unknown, b: unknown): boolean {
	return a === b || (a !== a && b !== b);
}

/** Throws `message` when `condition` is falsy. */
function invariant(condition: unknown, message: string): asserts condition {
	if (!condition) {
		error(message, 2);
	}
}

/** Highest integer key in a (possibly sparse) array. */
function _getHighestIndex(arr: Array<defined>): number {
	let highest = 0;
	for (const [key] of pairs(arr)) {
		const index = key as number;
		if (index > highest) {
			highest = index;
		}
	}
	return highest;
}

/** Current wall-clock time in seconds (used for profiler commit timestamps). */
function getCurrentTime(): number {
	return os.clock();
}

/** Collects the entries of `map` into an array of `[key, value]` pairs. */
function mapEntries<K, V>(map: Map<K, V>): Array<[K, V]> {
	const out: [K, V][] = [];
	map.forEach((value, key) => {
		out.push([key, value]);
	});
	return out;
}

/** Shallow-clones a {@link Map}. */
function cloneMap<K, V>(source: Map<K, V>): Map<K, V> {
	const out = new Map<K, V>();
	source.forEach((value, key) => {
		out.set(key, value);
	});
	return out;
}

/** Collects the members of `set` into an array. */
function _setToArray<T extends defined>(set: Set<T>): Array<T> {
	const out: T[] = [];
	set.forEach((value) => {
		out.push(value);
	});
	return out;
}

/** Reverses an array in place. */
function _reverse<T extends defined>(arr: Array<T>): Array<T> {
	const size = arr.size();
	for (let i = 0; i < math.floor(size / 2); i++) {
		const tmp = arr[i];
		arr[i] = arr[size - 1 - i];
		arr[size - 1 - i] = tmp;
	}
	return arr;
}

/** Concatenates two arrays into a new one. */
function _concat<T extends defined>(a: ReadonlyArray<T>, b: ReadonlyArray<T>): Array<T> {
	const out: T[] = [];
	for (const value of a) {
		out.push(value);
	}
	for (const value of b) {
		out.push(value);
	}
	return out;
}

/** Reads a numeric fiber field that may be absent. */
function num(value: unknown): number {
	return value as number;
}

// getInternalReactConstants

/**
 * Returns work tags, priority levels, side effect flags, and the fiber display
 * name / type symbol resolvers for a given renderer version.
 */
export function getInternalReactConstants(_version: string): InternalReactConstants {
	const ReactTypeOfSideEffect: ReactTypeOfSideEffect = {
		NoFlags: 0,
		PerformedWork: 1,
		Placement: 2,
	};

	// Technically these priority levels are invalid for versions before 16.9,
	// but 16.9 is the first version to report priority level to DevTools,
	// so we can avoid checking for earlier versions.
	const ReactPriorityLevels: ReactPriorityLevels = {
		ImmediatePriority: 99,
		UserBlockingPriority: 98,
		NormalPriority: 97,
		LowPriority: 96,
		IdlePriority: 95,
		NoPriority: 90,
	};

	// The Roblox runtime only ships the React 17 reconciler, so there is no
	// need for the version guards that the upstream file carries.
	const ReactTypeOfWork: WorkTagMap = {
		Block: 22,
		ClassComponent: 1,
		ContextConsumer: 9,
		ContextProvider: 10,
		CoroutineComponent: -1,
		CoroutineHandlerPhase: -1,
		DehydratedSuspenseComponent: 18,
		ForwardRef: 11,
		Fragment: 7,
		FunctionComponent: 0,
		HostComponent: 5,
		HostPortal: 4,
		HostRoot: 3,
		HostText: 6,
		IncompleteClassComponent: 17,
		IndeterminateComponent: 2,
		LazyComponent: 16,
		MemoComponent: 14,
		Mode: 8,
		OffscreenComponent: 23,
		Profiler: 12,
		SimpleMemoComponent: 15,
		SuspenseComponent: 13,
		SuspenseListComponent: 19,
		YieldComponent: -1,
	};

	function getTypeSymbol(type_: unknown): string | number {
		const symbolOrNumber = type(type_) === 'table' ? (type_ as Obj).$$typeof : type_;

		// The runtime stores $$typeof as a number, but symbol-string constants
		// are kept for forward compatibility with symbol-based runtimes.
		return type(symbolOrNumber) === 'table' ? tostring(symbolOrNumber) : (symbolOrNumber as string | number);
	}

	const {
		ClassComponent,
		IncompleteClassComponent,
		FunctionComponent,
		IndeterminateComponent,
		ForwardRef,
		HostRoot,
		HostComponent,
		HostPortal,
		HostText,
		Fragment,
		MemoComponent,
		SimpleMemoComponent,
		SuspenseComponent,
		SuspenseListComponent,
	} = ReactTypeOfWork;

	function resolveFiberType(type_: unknown): unknown {
		const typeSymbol = getTypeSymbol(type_);
		if (typeSymbol === MEMO_NUMBER || typeSymbol === MEMO_SYMBOL_STRING) {
			// Recursively resolve memo types in case of memo(forwardRef(Component)).
			return resolveFiberType((type_ as Obj).type);
		} else if (typeSymbol === FORWARD_REF_NUMBER || typeSymbol === FORWARD_REF_SYMBOL_STRING) {
			return (type_ as Obj).render;
		} else {
			return type_;
		}
	}

	// NOTICE: keep in sync with shouldFilterFiber() and other get*ForFiber methods.
	function getDisplayNameForFiber(fiber: Fiber): string | undefined {
		const type_ = fiber.type;
		const tag = fiber.tag;
		let resolvedType = type_;

		if (type(type_) === 'table' && type_ !== undefined) {
			resolvedType = resolveFiberType(type_);
		}

		let resolvedContext: Obj;

		if (tag === ClassComponent || tag === IncompleteClassComponent) {
			return getDisplayName(resolvedType);
		} else if (tag === FunctionComponent || tag === IndeterminateComponent) {
			return getDisplayName(resolvedType);
		} else if (tag === ForwardRef) {
			return getWrappedDisplayName(fiber.elementType, resolvedType, 'ForwardRef', 'Anonymous');
		} else if (tag === HostRoot) {
			return undefined;
		} else if (tag === HostComponent) {
			return type_ as string;
		} else if (tag === HostPortal || tag === HostText || tag === Fragment) {
			return undefined;
		} else if (tag === MemoComponent || tag === SimpleMemoComponent) {
			return getDisplayName(resolvedType, 'Anonymous');
		} else if (tag === SuspenseComponent) {
			return 'Suspense';
		} else if (tag === SuspenseListComponent) {
			return 'SuspenseList';
		} else {
			const typeSymbol = getTypeSymbol(type_);
			if (
				typeSymbol === CONCURRENT_MODE_NUMBER ||
				typeSymbol === CONCURRENT_MODE_SYMBOL_STRING ||
				typeSymbol === DEPRECATED_ASYNC_MODE_SYMBOL_STRING
			) {
				return undefined;
			} else if (typeSymbol === PROVIDER_NUMBER || typeSymbol === PROVIDER_SYMBOL_STRING) {
				// 16.3.0 exposed the context object as "context";
				// PR #12501 changed it to "_context" for 16.3.1+.
				resolvedContext = ((fiber.type as Obj)._context as Obj) ?? ((fiber.type as Obj).context as Obj);
				return `${resolvedContext.displayName ?? 'Context'}.Provider`;
			} else if (typeSymbol === CONTEXT_NUMBER || typeSymbol === CONTEXT_SYMBOL_STRING) {
				resolvedContext = ((fiber.type as Obj)._context as Obj) ?? (fiber.type as Obj);
				return `${resolvedContext.displayName ?? 'Context'}.Consumer`;
			} else if (typeSymbol === STRICT_MODE_NUMBER || typeSymbol === STRICT_MODE_SYMBOL_STRING) {
				return undefined;
			} else if (typeSymbol === PROFILER_NUMBER || typeSymbol === PROFILER_SYMBOL_STRING) {
				return `Profiler(${fiber.memoizedProps.id})`;
			} else if (typeSymbol === SCOPE_NUMBER || typeSymbol === SCOPE_SYMBOL_STRING) {
				return 'Scope';
			} else {
				// Unknown element type; may be a new element type not yet added.
				return undefined;
			}
		}
	}

	return {
		getDisplayNameForFiber,
		getTypeSymbol,
		ReactPriorityLevels,
		ReactTypeOfWork,
		ReactTypeOfSideEffect,
	};
}

// attach

/**
 * Attaches DevTools to a specific React renderer and returns a
 * {@link RendererInterface} that the DevTools backend uses to inspect the
 * renderer's fiber tree.
 *
 * @param hook The global DevTools hook.
 * @param rendererID The id assigned to this renderer by the hook.
 * @param renderer The React renderer being attached.
 * @param global The Roblox global table (`_G`), used for DevTools preferences
 *   and the `$r` / `$type` / `$reactTemp*` inspection globals.
 */
export function attach(
	hook: DevToolsHook,
	rendererID: number,
	renderer: ReactRenderer,
	global: Obj
): RendererInterface {
	const fiberToIDMap = new Map<Fiber, number>();
	const idToFiberMap = new Map<number, Fiber>();
	const primaryFibers = new Set<Fiber>();

	// When profiling is supported, we store the latest tree base durations for
	// each Fiber. This lets us quickly snapshot those values if profiling starts
	// without walking the whole tree.
	const idToTreeBaseDurationMap = new Map<number, number>();

	// Maps each fiber id to the root it belongs to, so profiler durations can
	// be filtered by root when sent to the frontend.
	const idToRootMap = new Map<number, number>();

	// The root currently being operated on while a mount/update is in progress.
	let currentRootID = -1;

	const getFiberID = (primaryFiber: Fiber): number => {
		if (!fiberToIDMap.has(primaryFiber)) {
			const id = getUID();
			fiberToIDMap.set(primaryFiber, id);
			idToFiberMap.set(id, primaryFiber);
		}
		return fiberToIDMap.get(primaryFiber) as number;
	};

	const internal = getInternalReactConstants(renderer.version);
	const getDisplayNameForFiber = internal.getDisplayNameForFiber;
	const getTypeSymbol = internal.getTypeSymbol;
	const ReactPriorityLevels = internal.ReactPriorityLevels;
	const ReactTypeOfWork = internal.ReactTypeOfWork;
	const ReactTypeOfSideEffect = internal.ReactTypeOfSideEffect;

	const PerformedWork = ReactTypeOfSideEffect.PerformedWork;

	const {
		ClassComponent,
		ContextConsumer,
		DehydratedSuspenseComponent,
		ForwardRef,
		Fragment,
		FunctionComponent,
		HostComponent,
		HostPortal,
		HostRoot,
		HostText,
		IncompleteClassComponent,
		IndeterminateComponent,
		MemoComponent,
		OffscreenComponent,
		SimpleMemoComponent,
		SuspenseComponent,
		SuspenseListComponent,
	} = ReactTypeOfWork;

	const { ImmediatePriority, UserBlockingPriority, NormalPriority, LowPriority, IdlePriority } = ReactPriorityLevels;

	// Renderer edit capabilities. These are method references taken from the
	// renderer so they can be checked for presence and invoked directly.
	const overrideHookState = renderer.overrideHookState;
	const overrideHookStateDeletePath = renderer.overrideHookStateDeletePath;
	const overrideHookStateRenamePath = renderer.overrideHookStateRenamePath;
	const overrideProps = renderer.overrideProps;
	const overridePropsDeletePath = renderer.overridePropsDeletePath;
	const overridePropsRenamePath = renderer.overridePropsRenamePath;
	const setSuspenseHandler = renderer.setSuspenseHandler;
	const scheduleUpdate = renderer.scheduleUpdate;

	const supportsTogglingSuspense = type(setSuspenseHandler) === 'function' && type(scheduleUpdate) === 'function';

	// Patching the console lets DevTools append component stacks to warnings
	// and disable logging while re-running hooks. On Roblox the patch methods
	// are no-ops, but the API is preserved for parity.
	if (global.__DEV__ === true) {
		Console.registerRenderer(renderer);

		// The renderer interface can't read these preferences directly because
		// they are stored in localStorage within the extension context. It relies
		// on the extension to pass the preference through via the global.
		const appendComponentStack = global.__REACT_DEVTOOLS_APPEND_COMPONENT_STACK__ !== false;
		const breakOnConsoleErrors = global.__REACT_DEVTOOLS_BREAK_ON_CONSOLE_ERRORS__ === true;

		if (appendComponentStack || breakOnConsoleErrors) {
			Console.patch({
				appendComponentStack,
				breakOnConsoleErrors,
			});
		}
	}

	const debug_ = (name: string, fiber: Fiber, parentFiber?: Fiber): void => {
		if (__DEBUG__) {
			const displayName = getDisplayNameForFiber(fiber) ?? 'nil';
			const id = getFiberID(fiber);
			const parentDisplayName =
				parentFiber !== undefined ? (getDisplayNameForFiber(parentFiber) ?? 'nil') : 'nil';
			const parentID = parentFiber !== undefined ? tostring(getFiberID(parentFiber)) : '';

			// NOTE: calling getFiberID or getPrimaryFiber here would be unsafe
			// because it would insert them into the maps; we omit them for now.
			Console.log(
				string.format(
					'[renderer] %s %s (%d) %s',
					name,
					displayName,
					id,
					parentFiber !== undefined ? string.format('%s (%s)', tostring(parentDisplayName), parentID) : ''
				)
			);
		}
	};

	// Configurable Components tree filters.
	const hideElementsWithDisplayNames = new Set<string>();
	const hideElementsWithPaths = new Set<string>();
	const hideElementsWithTypes = new Set<ElementType>();

	// Roots don't have a real persistent identity. A root's "pseudo key" is
	// "childDisplayName:indexWithThatName", e.g. "App:0". Used to disambiguate
	// roots when restoring selection between reloads.
	const rootPseudoKeys = new Map<number, string>();
	const rootDisplayNameCounter = new Map<string, number>();

	// Profiling state.
	let currentCommitProfilingMetadata: CommitProfilingData | undefined;
	let displayNamesByRootID: DisplayNamesByRootID | undefined;
	let idToContextsMap: Map<number, unknown> | undefined;
	let initialTreeBaseDurationsMap: Map<number, number> | undefined;
	let initialIDToRootMap: Map<number, number> | undefined;
	let isProfiling = false;
	let profilingStartTime = 0;
	let recordChangeDescriptions = false;
	let rootToCommitProfilingMetadataMap: CommitProfilingMetadataMap | undefined;

	let mostRecentlyInspectedElement: InspectedElement | undefined;
	let hasElementUpdatedSinceLastInspected = false;
	let currentlyInspectedPaths: Obj = {};

	const forceFallbackForSuspenseIDs = new Set<number>();

	// Highlight updates.
	let traceUpdatesEnabled = false;
	const traceUpdatesForNodes = new Set<NativeType>();

	// Restoring selection after reload.
	let trackedPath: Array<PathFrame> | undefined;
	let trackedPathMatchFiber: Fiber | undefined;
	let trackedPathMatchDepth = -1;
	let mightBeOnTrackedPath = false;

	// Forward declarations so mutually recursive functions can call each other.
	let getPrimaryFiber: (fiber: Fiber) => Fiber;
	let getElementTypeForFiber: (fiber: Fiber) => ElementType;
	let getContextChangedKeys: (fiber: Fiber) => Array<string> | boolean | undefined;
	let didHooksChange: (prev: unknown, next_: unknown) => boolean;
	let getContextsForFiber: (fiber: Fiber) => Array<unknown> | undefined;
	let getDisplayNameForRoot: (fiber: Fiber) => string;
	let mountFiberRecursively: (
		fiber: Fiber,
		parentFiber: Fiber | undefined,
		traverseSiblings: boolean,
		traceNearestHostComponentUpdate: boolean
	) => void;
	let unmountFiberChildrenRecursively: (fiber: Fiber) => void;
	let recordUnmount: (fiber: Fiber, isSimulated: boolean) => void;
	let recordProfilingDurations: (fiber: Fiber) => void;
	let setRootPseudoKey: (id: number, fiber: Fiber) => void;
	let removeRootPseudoKey: (id: number) => void;
	let flushPendingEvents: (root: Obj) => void;
	let findAllCurrentHostFibers: (id: number) => Array<Fiber>;
	let findCurrentFiberUsingSlowPathById: (id: number) => Fiber | undefined;
	let isMostRecentlyInspectedElementCurrent: (id: number) => boolean;
	let getPathFrame: (fiber: Fiber) => PathFrame;
	let setTrackedPath: (path: Array<PathFrame> | undefined) => void;
	let updateTrackedPathStateBeforeMount: (fiber: Fiber) => boolean;
	let updateTrackedPathStateAfterMount: (mightSiblingsBeOnTrackedPath: boolean) => void;
	let findReorderedChildrenRecursively: (fiber: Fiber, nextChildren: Array<number>) => void;

	const applyComponentFilters = (componentFilters: Array<ComponentFilter>): void => {
		hideElementsWithTypes.clear();
		hideElementsWithDisplayNames.clear();
		hideElementsWithPaths.clear();

		for (const componentFilter of componentFilters) {
			if (!componentFilter.isEnabled) {
				continue;
			}

			if (componentFilter.type === ComponentFilterDisplayName) {
				hideElementsWithDisplayNames.add((componentFilter as RegExpComponentFilter).value);
			} else if (componentFilter.type === ComponentFilterElementType) {
				hideElementsWithTypes.add((componentFilter as ElementTypeComponentFilter).value);
			} else if (componentFilter.type === ComponentFilterLocation) {
				const locationFilter = componentFilter as RegExpComponentFilter;
				if (locationFilter.isValid && locationFilter.value !== '') {
					hideElementsWithPaths.add(locationFilter.value);
				}
			} else if (componentFilter.type === ComponentFilterHOC) {
				hideElementsWithDisplayNames.add('%(');
			} else {
				Console.warn(string.format('Invalid component filter type "%d"', componentFilter.type));
			}
		}
	};

	// The renderer interface can't read saved component filters directly because
	// they are stored in localStorage within the extension context.
	const savedFilters = global.__REACT_DEVTOOLS_COMPONENT_FILTERS__;
	if (savedFilters !== undefined) {
		applyComponentFilters(savedFilters as Array<ComponentFilter>);
	} else {
		// Fall back to the default filters.
		applyComponentFilters(getDefaultComponentFilters());
	}

	// Recursively re-mounts all roots with the new filter criteria applied.
	const updateComponentFilters = (componentFilters: Array<ComponentFilter>): void => {
		if (isProfiling) {
			// Re-mounting a tree while profiling is in progress might break a lot
			// of assumptions, so we refuse to do it.
			error('Cannot modify filter preferences while profiling');
		}

		hook.getFiberRoots(rendererID).forEach((root) => {
			const rootFiber = root as Fiber;
			currentRootID = getFiberID(getPrimaryFiber(rootFiber.current as Fiber));
			unmountFiberChildrenRecursively(rootFiber.current as Fiber);
			recordUnmount(rootFiber.current as Fiber, false);
			currentRootID = -1;
		});

		applyComponentFilters(componentFilters);

		// Reset pseudo counters so new path selections will be persisted.
		rootDisplayNameCounter.clear();

		hook.getFiberRoots(rendererID).forEach((root) => {
			const rootFiber = root as Fiber;
			currentRootID = getFiberID(getPrimaryFiber(rootFiber.current as Fiber));

			setRootPseudoKey(currentRootID, rootFiber.current as Fiber);
			mountFiberRecursively(rootFiber.current as Fiber, undefined, false, false);
			flushPendingEvents(rootFiber);

			currentRootID = -1;
		});
	};

	// NOTICE: keep in sync with get*ForFiber methods.
	const shouldFilterFiber = (fiber: Fiber): boolean => {
		const debugSource = fiber._debugSource as { fileName?: string } | undefined;
		const tag = fiber.tag;
		const type_ = fiber.type;

		if (tag === DehydratedSuspenseComponent) {
			// Dehydrated Suspense has special behavior (disconnecting an alternate
			// and turning into real Suspense) which breaks DevTools, so we ignore it.
			return true;
		} else if (tag === HostPortal || tag === HostText || tag === Fragment || tag === OffscreenComponent) {
			return true;
		} else if (tag === HostRoot) {
			// It is never valid to filter the root element.
			return false;
		} else {
			const typeSymbol = getTypeSymbol(type_);
			if (
				typeSymbol === CONCURRENT_MODE_NUMBER ||
				typeSymbol === CONCURRENT_MODE_SYMBOL_STRING ||
				typeSymbol === DEPRECATED_ASYNC_MODE_SYMBOL_STRING ||
				typeSymbol === STRICT_MODE_NUMBER ||
				typeSymbol === STRICT_MODE_SYMBOL_STRING
			) {
				return true;
			}
		}

		const elementType = getElementTypeForFiber(fiber);

		if (hideElementsWithTypes.has(elementType)) {
			return true;
		}
		if (hideElementsWithDisplayNames.size() > 0) {
			const displayName = getDisplayNameForFiber(fiber);
			if (displayName !== undefined) {
				for (const pattern of hideElementsWithDisplayNames) {
					if (string.match(displayName, pattern)[0] !== undefined) {
						return true;
					}
				}
			}
		}
		if (debugSource !== undefined && hideElementsWithPaths.size() > 0) {
			const fileName = debugSource.fileName ?? '';
			for (const pathPattern of hideElementsWithPaths) {
				if (string.match(fileName, pathPattern)[0] !== undefined) {
					return true;
				}
			}
		}

		return false;
	};

	// NOTICE: keep in sync with shouldFilterFiber() and other get*ForFiber methods.
	getElementTypeForFiber = (fiber: Fiber): ElementType => {
		const type_ = fiber.type;
		const tag = fiber.tag;

		if (tag === ClassComponent || tag === IncompleteClassComponent) {
			return ElementTypeClass;
		} else if (tag === FunctionComponent || tag === IndeterminateComponent) {
			return ElementTypeFunction;
		} else if (tag === ForwardRef) {
			return ElementTypeForwardRef;
		} else if (tag === HostRoot) {
			return ElementTypeRoot;
		} else if (tag === HostComponent) {
			return ElementTypeHostComponent;
		} else if (tag === HostPortal || tag === HostText || tag === Fragment) {
			return ElementTypeOtherOrUnknown;
		} else if (tag === MemoComponent || tag === SimpleMemoComponent) {
			return ElementTypeMemo;
		} else if (tag === SuspenseComponent) {
			return ElementTypeSuspense;
		} else if (tag === SuspenseListComponent) {
			return ElementTypeSuspenseList;
		} else {
			const typeSymbol = getTypeSymbol(type_);
			if (
				typeSymbol === CONCURRENT_MODE_NUMBER ||
				typeSymbol === CONCURRENT_MODE_SYMBOL_STRING ||
				typeSymbol === DEPRECATED_ASYNC_MODE_SYMBOL_STRING
			) {
				return ElementTypeContext;
			} else if (typeSymbol === PROVIDER_NUMBER || typeSymbol === PROVIDER_SYMBOL_STRING) {
				return ElementTypeContext;
			} else if (typeSymbol === CONTEXT_NUMBER || typeSymbol === CONTEXT_SYMBOL_STRING) {
				return ElementTypeContext;
			} else if (typeSymbol === STRICT_MODE_NUMBER || typeSymbol === STRICT_MODE_SYMBOL_STRING) {
				return ElementTypeOtherOrUnknown;
			} else if (typeSymbol === PROFILER_NUMBER || typeSymbol === PROFILER_SYMBOL_STRING) {
				return ElementTypeProfiler;
			} else {
				return ElementTypeOtherOrUnknown;
			}
		}
	};

	// This is a slightly annoying indirection. It is currently necessary because
	// DevTools wants to use unique objects as keys for instances, but fibers have
	// two versions (current and alternate). This set remembers the first
	// encountered fiber for each conceptual instance.
	getPrimaryFiber = (fiber: Fiber): Fiber => {
		if (primaryFibers.has(fiber)) {
			return fiber;
		}

		const alternate = fiber.alternate;
		if (alternate !== undefined && primaryFibers.has(alternate)) {
			return alternate;
		}

		primaryFibers.add(fiber);
		return fiber;
	};

	const getChangeDescription = (prevFiber: Fiber | undefined, nextFiber: Fiber): ChangeDescription | undefined => {
		const fiberType = getElementTypeForFiber(nextFiber);
		if (
			fiberType === ElementTypeClass ||
			fiberType === ElementTypeFunction ||
			fiberType === ElementTypeMemo ||
			fiberType === ElementTypeForwardRef ||
			fiberType === ElementTypeHostComponent
		) {
			if (prevFiber === undefined) {
				return {
					context: undefined,
					didHooksChange: false,
					isFirstMount: true,
					props: undefined,
					state: undefined,
				};
			} else {
				const context = getContextChangedKeys(nextFiber);
				const props = getChangedKeys(prevFiber.memoizedProps, nextFiber.memoizedProps);
				const state = getChangedKeys(prevFiber.memoizedState, nextFiber.memoizedState);

				return {
					context: context === undefined ? undefined : context,
					didHooksChange: didHooksChange(prevFiber.memoizedState, nextFiber.memoizedState),
					isFirstMount: false,
					props: props === undefined ? undefined : props,
					state: state === undefined ? undefined : state,
				};
			}
		} else {
			return undefined;
		}
	};

	const updateContextsForFiber = (fiber: Fiber): void => {
		if (getElementTypeForFiber(fiber) === ElementTypeClass) {
			if (idToContextsMap !== undefined) {
				const id = getFiberID(getPrimaryFiber(fiber));
				const contexts = getContextsForFiber(fiber);
				if (contexts !== undefined) {
					idToContextsMap.set(id, contexts);
				}
			}
		}
	};

	// Differentiates between a null context value and no context.
	const NO_CONTEXT: Obj = {};

	getContextsForFiber = (fiber: Fiber): Array<unknown> | undefined => {
		if (getElementTypeForFiber(fiber) === ElementTypeClass) {
			const instance = fiber.stateNode as ClassInstance | undefined;
			let legacyContext: unknown = NO_CONTEXT;
			let modernContext: unknown = NO_CONTEXT;
			if (instance !== undefined) {
				const constructor = (instance as unknown as { constructor?: Obj }).constructor;
				if (constructor !== undefined && constructor.contextType !== undefined) {
					modernContext = instance.context;
				} else {
					legacyContext = instance.context;
					if (legacyContext !== undefined && getAllEnumerableKeys(legacyContext as Obj).size() === 0) {
						legacyContext = NO_CONTEXT;
					}
				}
			}
			return [legacyContext, modernContext];
		}
		return undefined;
	};

	// Records all contexts at the time profiling is started. Fibers only store
	// the current context value, so we need to track them separately in order to
	// determine changed keys.
	const crawlToInitializeContextsMap = (fiber: Fiber): void => {
		updateContextsForFiber(fiber);
		let current = fiber.child;
		while (current !== undefined) {
			crawlToInitializeContextsMap(current);
			current = current.sibling;
		}
	};

	getContextChangedKeys = (fiber: Fiber): Array<string> | boolean | undefined => {
		if (getElementTypeForFiber(fiber) === ElementTypeClass) {
			if (idToContextsMap !== undefined) {
				const id = getFiberID(getPrimaryFiber(fiber));
				const prevContexts = idToContextsMap.has(id) ? idToContextsMap.get(id) : undefined;
				const nextContexts = getContextsForFiber(fiber);

				if (prevContexts === undefined || nextContexts === undefined) {
					return undefined;
				}

				const prevContextsArray = prevContexts as Array<unknown>;
				const prevLegacyContext = prevContextsArray[0];
				const prevModernContext = prevContextsArray[1];
				const nextLegacyContext = nextContexts[0];
				const nextModernContext = nextContexts[1];

				if (nextLegacyContext !== NO_CONTEXT) {
					return getChangedKeys(prevLegacyContext, nextLegacyContext);
				} else if (nextModernContext !== NO_CONTEXT) {
					return prevModernContext !== nextModernContext;
				}
			}
		}
		return undefined;
	};

	const areHookInputsEqual = (nextDeps: Array<unknown>, prevDeps: Array<unknown> | undefined): boolean => {
		if (prevDeps === undefined) {
			return false;
		}

		const prevDepLength = prevDeps.size();
		const nextDepLength = nextDeps.size();

		if (prevDepLength !== nextDepLength) {
			return false;
		}

		for (let i = 0; i < prevDepLength; i++) {
			if (!objectIs(nextDeps[i], prevDeps[i])) {
				return false;
			}
		}
		return true;
	};

	const isEffect = (memoizedState: unknown): boolean => {
		if (memoizedState === undefined || type(memoizedState) !== 'table') {
			return false;
		}
		const state = memoizedState as Obj;
		return (
			state.tag !== undefined &&
			state.create !== undefined &&
			state.destroy !== undefined &&
			(state.deps === undefined || isArray(state.deps)) &&
			state.next !== undefined
		);
	};

	const didHookChange = (prev: Obj, next_: Obj): boolean => {
		const prevMemoizedState = prev.memoizedState as Obj | undefined;
		const nextMemoizedState = next_.memoizedState as Obj | undefined;

		if (isEffect(prevMemoizedState) && isEffect(nextMemoizedState)) {
			return (
				prevMemoizedState !== nextMemoizedState &&
				!areHookInputsEqual(
					(nextMemoizedState as Obj).deps as Array<unknown>,
					(prevMemoizedState as Obj).deps as Array<unknown> | undefined
				)
			);
		}
		return nextMemoizedState !== prevMemoizedState;
	};

	didHooksChange = (prev: unknown, next_: unknown): boolean => {
		if (prev === undefined || next_ === undefined) {
			return false;
		}

		// We can't report anything meaningful for hooks changes.
		const nextObj = next_ as Obj;
		if (
			nextObj.baseState !== undefined &&
			nextObj.memoizedState !== undefined &&
			nextObj.next !== undefined &&
			nextObj.queue !== undefined
		) {
			let currentNext: Obj | undefined = nextObj;
			let currentPrev: Obj | undefined = prev as Obj;
			while (currentNext !== undefined) {
				if (didHookChange(currentPrev as Obj, currentNext)) {
					return true;
				} else {
					currentNext = currentNext.next as Obj | undefined;
					currentPrev = (currentPrev as Obj).next as Obj | undefined;
				}
			}
		}

		return false;
	};

	const getChangedKeys = (prev: unknown, next_: unknown): Array<string> | undefined => {
		if (prev === undefined || next_ === undefined) {
			return undefined;
		}

		// We can't report anything meaningful for hooks changes.
		const nextObj = next_ as Obj;
		if (
			nextObj.baseState !== undefined &&
			nextObj.memoizedState !== undefined &&
			nextObj.next !== undefined &&
			nextObj.queue !== undefined
		) {
			return undefined;
		}

		const keys = new Set<string>();
		for (const key of getAllEnumerableKeys(prev as Obj)) {
			keys.add(tostring(key));
		}
		for (const key of getAllEnumerableKeys(nextObj)) {
			keys.add(tostring(key));
		}

		const changedKeys: string[] = [];
		keys.forEach((key) => {
			if ((prev as Obj)[key] !== nextObj[key]) {
				changedKeys.push(key);
			}
		});

		return changedKeys;
	};

	const didFiberRender = (prevFiber: Fiber, nextFiber: Fiber): boolean => {
		const tag = nextFiber.tag;
		if (
			tag === ClassComponent ||
			tag === FunctionComponent ||
			tag === ContextConsumer ||
			tag === MemoComponent ||
			tag === SimpleMemoComponent
		) {
			// For types that execute user code, we check PerformedWork effect.
			// We don't reflect bailouts (either referential or sCU) in DevTools.
			return bit32.band(num(nextFiber.flags), PerformedWork) === PerformedWork;
		} else {
			// For host components and other types, we compare inputs to determine
			// whether something is an update.
			return (
				prevFiber.memoizedProps !== nextFiber.memoizedProps ||
				prevFiber.memoizedState !== nextFiber.memoizedState ||
				prevFiber.ref !== nextFiber.ref
			);
		}
	};

	// Operations (mount / unmount / update events sent to the frontend)

	const isDev = global.__DEV__ === true;
	const isDebug = global.__DEBUG__ === true;

	// Operations are buffered here until the current commit is finished, then
	// flushed to the frontend as a single array (or queued until it connects).
	let pendingOperations: number[] = [];
	let pendingRealUnmountedIDs: number[] = [];
	let pendingSimulatedUnmountedIDs: number[] = [];
	let pendingUnmountedRootID: number | undefined;

	const pendingStringTable = new Map<string, number>();
	let pendingStringTableLength = 0;

	let pendingOperationsQueue: Array<Array<number>> | undefined;

	const pushOperation = (op: number): void => {
		if (isDev) {
			if (op !== math.floor(op)) {
				Console.error('pushOperation() was called but the value is not an integer.', op);
			}
		}
		pendingOperations.push(op);
	};

	flushPendingEvents = (_root: Obj): void => {
		if (
			pendingOperations.size() === 0 &&
			pendingRealUnmountedIDs.size() === 0 &&
			pendingSimulatedUnmountedIDs.size() === 0 &&
			pendingUnmountedRootID === undefined
		) {
			// If we aren't profiling, we can just bail out here; no use sending an
			// empty update over the bridge. The Profiler reconstructs the tree per
			// commit from an initial snapshot plus an operations array, so empty
			// operations must still be sent while profiling is active.
			if (!isProfiling) {
				return;
			}
		}

		const numUnmountIDs =
			pendingRealUnmountedIDs.size() +
			pendingSimulatedUnmountedIDs.size() +
			(pendingUnmountedRootID === undefined ? 0 : 1);

		const operations: number[] = [];

		// Identify which renderer this update is coming from. The first two
		// entries are [rendererID, rootFiberID]; the root ID lets roots be
		// mapped back to their renderer so props/state/hooks can be inspected.
		operations.push(rendererID);
		operations.push(currentRootID);

		// Now fill in the string table.
		// [stringTableLength, str1Length, ...str1, str2Length, ...str2, ...]
		operations.push(pendingStringTableLength);
		pendingStringTable.forEach((_value, key) => {
			const encodedKey = utfEncodeString(key);
			operations.push(encodedKey.size());
			for (const codepoint of encodedKey) {
				operations.push(codepoint);
			}
		});

		if (numUnmountIDs > 0) {
			// All unmounts except roots are batched in a single message.
			operations.push(TREE_OPERATION_REMOVE);
			// The first number is how many unmounted IDs we're going to send.
			operations.push(numUnmountIDs);

			// Fill in the real unmounts in reverse order: they were inserted
			// parents-first by React, but we want children-first.
			for (let j = pendingRealUnmountedIDs.size() - 1; j >= 0; j--) {
				operations.push(pendingRealUnmountedIDs[j]);
			}

			// Fill in the simulated unmounts (hidden Suspense subtrees) in their
			// original order. They go after the real unmounts because we know for
			// sure they won't be children of already-pushed real IDs.
			for (let j = 0; j < pendingSimulatedUnmountedIDs.size(); j++) {
				operations.push(pendingSimulatedUnmountedIDs[j]);
			}

			// The root ID should always be unmounted last.
			if (pendingUnmountedRootID !== undefined) {
				operations.push(pendingUnmountedRootID);
			}
		}

		// Fill in the rest of the operations.
		for (const op of pendingOperations) {
			operations.push(op);
		}

		// Let the frontend know about tree operations.
		if (pendingOperationsQueue !== undefined) {
			// Until the frontend has been connected, store the tree operations.
			// This lets us avoid walking the tree later when it connects, and it
			// enables the Profiler's reload-and-profile functionality.
			pendingOperationsQueue.push(operations);
		} else {
			// If we've already connected to the frontend, pass the operations through.
			hook.emit('operations', operations);
		}

		// Replace the buffers rather than truncating them.
		pendingOperations = [] as number[];
		pendingRealUnmountedIDs = [] as number[];
		pendingSimulatedUnmountedIDs = [] as number[];
		pendingUnmountedRootID = undefined;
		pendingStringTable.clear();
		pendingStringTableLength = 0;
	};

	const getStringID = (str: string | undefined): number => {
		if (str === undefined) {
			return 0;
		}

		const existingEntry = pendingStringTable.get(str);
		if (existingEntry !== undefined) {
			return existingEntry;
		}

		const id = pendingStringTable.size() + 1;
		const encodedString = utfEncodeString(str);

		pendingStringTable.set(str, id);

		// The string table total length needs to account both for the string
		// length, and for the array item that contains the length itself (+1).
		pendingStringTableLength += encodedString.size() + 1;
		return id;
	};

	const recordMount = (fiber: Fiber, parentFiber: Fiber | undefined): void => {
		if (isDebug) {
			debug_('recordMount()', fiber, parentFiber);
		}

		const isRoot = fiber.tag === HostRoot;
		const id = getFiberID(getPrimaryFiber(fiber));
		const hasOwnerMetadata = fiber._debugOwner !== undefined;
		const isProfilingSupported = fiber.treeBaseDuration !== undefined;

		if (isRoot) {
			pushOperation(TREE_OPERATION_ADD);
			pushOperation(id);
			pushOperation(ElementTypeRoot);
			pushOperation(isProfilingSupported ? 1 : 0);
			pushOperation(hasOwnerMetadata ? 1 : 0);

			if (isProfiling) {
				if (displayNamesByRootID !== undefined) {
					displayNamesByRootID.set(id, getDisplayNameForRoot(fiber));
				}
			}
		} else {
			const key = fiber.key as unknown;
			const displayName = getDisplayNameForFiber(fiber);
			const elementType = getElementTypeForFiber(fiber);
			const _debugOwner = fiber._debugOwner as Fiber | undefined;
			const ownerID = _debugOwner !== undefined ? getFiberID(getPrimaryFiber(_debugOwner)) : 0;
			const parentID = parentFiber !== undefined ? getFiberID(getPrimaryFiber(parentFiber)) : 0;

			const displayNameStringID = getStringID(displayName);

			// This check guards against a React element that has been modified in
			// such a way as to bypass the default stringification of "key".
			const keyString = key === undefined ? undefined : tostring(key);
			const keyStringID = getStringID(keyString);

			pushOperation(TREE_OPERATION_ADD);
			pushOperation(id);
			pushOperation(elementType);
			pushOperation(parentID);
			pushOperation(ownerID);
			pushOperation(displayNameStringID);
			pushOperation(keyStringID);
		}

		if (isProfilingSupported) {
			idToRootMap.set(id, currentRootID);
			recordProfilingDurations(fiber);
		}
	};

	recordUnmount = (fiber: Fiber, isSimulated: boolean): void => {
		if (isDebug) {
			debug_('recordUnmount()', fiber);
		}

		if (trackedPathMatchFiber !== undefined) {
			// We're in the process of trying to restore a previous selection. If
			// this fiber matched but is being unmounted, there's no use trying —
			// reset the state so we don't keep holding onto it.
			if (fiber === trackedPathMatchFiber || fiber === (trackedPathMatchFiber as Fiber).alternate) {
				setTrackedPath(undefined);
			}
		}

		const isRoot = fiber.tag === HostRoot;
		const primaryFiber = getPrimaryFiber(fiber);
		if (!fiberToIDMap.has(primaryFiber)) {
			// If we've never seen this Fiber, it might be because it is inside a
			// non-current Suspense fragment tree, so the store is not aware of it.
			// We can just ignore it, or there will be errors later on.
			primaryFibers.delete(primaryFiber);
			return;
		}

		const id = getFiberID(primaryFiber);

		if (isRoot) {
			// Roots must be removed only after all children (pending and
			// simulated) have been removed, so we track it separately.
			pendingUnmountedRootID = id;
		} else if (!shouldFilterFiber(fiber)) {
			// To maintain child-first ordering, we'll push it into one of these
			// queues and later arrange them in the correct order.
			if (isSimulated) {
				pendingSimulatedUnmountedIDs.push(id);
			} else {
				pendingRealUnmountedIDs.push(id);
			}
		}

		fiberToIDMap.delete(primaryFiber);
		idToFiberMap.delete(id);
		primaryFibers.delete(primaryFiber);

		const isProfilingSupported = fiber.treeBaseDuration !== undefined;
		if (isProfilingSupported) {
			idToRootMap.delete(id);
			idToTreeBaseDurationMap.delete(id);
		}
	};

	mountFiberRecursively = (
		fiber: Fiber,
		parentFiber: Fiber | undefined,
		traverseSiblings: boolean,
		traceNearestHostComponentUpdate: boolean
	): void => {
		if (__DEBUG__) {
			debug_('mountFiberRecursively()', fiber, parentFiber);
		}

		// If we have a tree selection from a previous reload, try to match this
		// Fiber and remember whether to do the same for siblings.
		const mightSiblingsBeOnTrackedPath = updateTrackedPathStateBeforeMount(fiber);
		const shouldIncludeInTree = !shouldFilterFiber(fiber);

		if (shouldIncludeInTree) {
			recordMount(fiber, parentFiber);
		}

		if (traceUpdatesEnabled) {
			if (traceNearestHostComponentUpdate) {
				const elementType = getElementTypeForFiber(fiber);
				// If an ancestor updated, mark the nearest host nodes for highlight.
				if (elementType === ElementTypeHostComponent) {
					traceUpdatesForNodes.add(fiber.stateNode as NativeType);
					traceNearestHostComponentUpdate = false;
				}
			}

			// We intentionally do not re-enable traceNearestHostComponentUpdate
			// here because we don't want to highlight every host node inside of a
			// newly mounted subtree.
		}

		const isSuspense = fiber.tag === SuspenseComponent;

		if (isSuspense) {
			const isTimedOut = fiber.memoizedState !== undefined;
			if (isTimedOut) {
				// Special case: if Suspense mounts in a timed-out state, get the
				// fallback child from the inner fragment and mount it as if it was
				// our own child. Updates handle this too.
				const primaryChildFragment = fiber.child;
				const fallbackChildFragment =
					primaryChildFragment !== undefined ? primaryChildFragment.sibling : undefined;
				const fallbackChild = fallbackChildFragment !== undefined ? fallbackChildFragment.child : undefined;

				if (fallbackChild !== undefined) {
					mountFiberRecursively(
						fallbackChild,
						shouldIncludeInTree ? fiber : parentFiber,
						true,
						traceNearestHostComponentUpdate
					);
				}
			} else {
				let primaryChild: Fiber | undefined;
				const areSuspenseChildrenConditionallyWrapped = OffscreenComponent === -1;

				if (areSuspenseChildrenConditionallyWrapped) {
					primaryChild = fiber.child;
				} else if (fiber.child !== undefined) {
					primaryChild = fiber.child.child;
				}

				if (primaryChild !== undefined) {
					mountFiberRecursively(
						primaryChild,
						shouldIncludeInTree ? fiber : parentFiber,
						true,
						traceNearestHostComponentUpdate
					);
				}
			}
		} else {
			if (fiber.child !== undefined) {
				mountFiberRecursively(
					fiber.child,
					shouldIncludeInTree ? fiber : parentFiber,
					true,
					traceNearestHostComponentUpdate
				);
			}
		}

		// We're exiting this Fiber now and entering its siblings. If we have
		// selection to restore, we might need to re-activate tracking.
		updateTrackedPathStateAfterMount(mightSiblingsBeOnTrackedPath);

		if (traverseSiblings && fiber.sibling !== undefined) {
			mountFiberRecursively(fiber.sibling, parentFiber, true, traceNearestHostComponentUpdate);
		}
	};

	// Used to simulate unmounting for Suspense trees when switching from the
	// primary set to the fallback set.
	unmountFiberChildrenRecursively = (fiber: Fiber): void => {
		if (isDebug) {
			debug_('unmountFiberChildrenRecursively()', fiber);
		}

		// We might meet a nested Suspense on our way.
		const isTimedOutSuspense = fiber.tag === SuspenseComponent && fiber.memoizedState !== undefined;
		let child = fiber.child;

		if (isTimedOutSuspense) {
			// If it's showing the fallback tree, let's traverse it instead.
			const primaryChildFragment = fiber.child;
			const fallbackChildFragment = primaryChildFragment !== undefined ? primaryChildFragment.sibling : undefined;

			// Skip over to the real Fiber child.
			child = fallbackChildFragment !== undefined ? fallbackChildFragment.child : undefined;
		}

		while (child !== undefined) {
			// Record simulated unmounts children-first. We skip nodes without a
			// return pointer because those are real unmounts.
			if (child.return !== undefined) {
				unmountFiberChildrenRecursively(child);
				recordUnmount(child, true);
			}
			child = child.sibling;
		}
	};

	recordProfilingDurations = (fiber: Fiber): void => {
		const id = getFiberID(getPrimaryFiber(fiber));
		const actualDuration = fiber.actualDuration as number | undefined;
		const treeBaseDuration = fiber.treeBaseDuration as number | undefined;

		idToTreeBaseDurationMap.set(id, treeBaseDuration ?? 0);

		if (isProfiling) {
			const alternate = fiber.alternate;

			// It's important to update treeBaseDuration even if the current Fiber
			// did not render, because it's possible that one of its descendants did.
			if (alternate === undefined || treeBaseDuration !== alternate.treeBaseDuration) {
				const convertedTreeBaseDuration = math.floor((treeBaseDuration ?? 0) * 1000);
				pushOperation(TREE_OPERATION_UPDATE_TREE_BASE_DURATION);
				pushOperation(id);
				pushOperation(convertedTreeBaseDuration);
			}

			if (alternate === undefined || didFiberRender(alternate, fiber)) {
				if (actualDuration !== undefined) {
					// React's actualDuration includes time spent working on children.
					// It's useful to also be able to exclude child durations; the
					// frontend can't compute this, so we compute a "self duration"
					// here by subtracting the durations of immediate children.
					let selfDuration = actualDuration;
					let child = fiber.child;
					while (child !== undefined) {
						selfDuration -= (child.actualDuration as number) ?? 0;
						child = child.sibling;
					}

					// If profiling is active, store durations for elements rendered
					// during the commit. Note that this should happen for any fiber
					// we performed work on, regardless of its actualDuration value.
					const metadata = currentCommitProfilingMetadata as CommitProfilingData;
					metadata.durations.push(id);
					metadata.durations.push(actualDuration);
					metadata.durations.push(selfDuration);
					metadata.maxActualDuration = math.max(metadata.maxActualDuration, actualDuration);

					if (recordChangeDescriptions) {
						const changeDescription = getChangeDescription(alternate, fiber);
						if (changeDescription !== undefined) {
							if (metadata.changeDescriptions !== undefined) {
								metadata.changeDescriptions.set(id, changeDescription);
							}
						}
						updateContextsForFiber(fiber);
					}
				}
			}
		}
	};

	const recordResetChildren = (fiber: Fiber, childSet: Fiber): void => {
		// The frontend only really cares about displayName, key, and children.
		// The first two don't change, so we are only concerned with child order.
		// This is trickier than a simple comparison because filtered fibers are
		// collapsed out of the visible tree.
		const nextChildren: number[] = [];

		// A naive implementation that shallowly recurses children. Revisit if it
		// proves too inefficient.
		let child: Fiber | undefined = childSet;
		while (child !== undefined) {
			findReorderedChildrenRecursively(child, nextChildren);
			child = child.sibling;
		}

		if (nextChildren.size() < 2) {
			// No need to reorder.
			return;
		}

		pushOperation(TREE_OPERATION_REORDER_CHILDREN);
		pushOperation(getFiberID(getPrimaryFiber(fiber)));
		pushOperation(nextChildren.size());
		for (const childID of nextChildren) {
			pushOperation(childID);
		}
	};

	findReorderedChildrenRecursively = (fiber: Fiber, nextChildren: Array<number>): void => {
		if (!shouldFilterFiber(fiber)) {
			nextChildren.push(getFiberID(getPrimaryFiber(fiber)));
		} else {
			let child = fiber.child;
			while (child !== undefined) {
				findReorderedChildrenRecursively(child, nextChildren);
				child = child.sibling;
			}
		}
	};

	// Returns whether the closest unfiltered fiber parent needs to reset its
	// child list.
	const updateFiberRecursively = (
		nextFiber: Fiber,
		prevFiber: Fiber,
		parentFiber: Fiber | undefined,
		traceNearestHostComponentUpdate: boolean
	): boolean => {
		if (isDebug) {
			debug_('updateFiberRecursively()', nextFiber, parentFiber);
		}

		if (traceUpdatesEnabled) {
			const elementType = getElementTypeForFiber(nextFiber);

			if (traceNearestHostComponentUpdate) {
				// If an ancestor updated, mark the nearest host nodes for highlight.
				if (elementType === ElementTypeHostComponent) {
					traceUpdatesForNodes.add(nextFiber.stateNode as NativeType);
					traceNearestHostComponentUpdate = false;
				}
			} else if (
				elementType === ElementTypeFunction ||
				elementType === ElementTypeClass ||
				elementType === ElementTypeContext
			) {
				// Otherwise, if this is a traced ancestor, flag for the nearest host
				// descendant(s).
				traceNearestHostComponentUpdate = didFiberRender(prevFiber, nextFiber);
			}
		}

		if (
			mostRecentlyInspectedElement !== undefined &&
			mostRecentlyInspectedElement.id === getFiberID(getPrimaryFiber(nextFiber)) &&
			didFiberRender(prevFiber, nextFiber)
		) {
			// If this Fiber has updated, clear cached inspected data. If it is
			// inspected again it may need to be re-run for updated hook values.
			hasElementUpdatedSinceLastInspected = true;
		}

		const shouldIncludeInTree = !shouldFilterFiber(nextFiber);
		const isSuspense = nextFiber.tag === SuspenseComponent;
		let shouldResetChildren = false;

		// Suspense components only have a non-nil memoizedState if timed out.
		const prevDidTimeout = isSuspense && prevFiber.memoizedState !== undefined;
		const nextDidTimeOut = isSuspense && nextFiber.memoizedState !== undefined;

		// The logic below mirrors the updateSuspenseComponent() code paths in
		// ReactFiberBeginWork within the React source.
		if (prevDidTimeout && nextDidTimeOut) {
			// Fallback -> Fallback: reconcile the fallback set.
			const nextFiberChild = nextFiber.child;
			const nextFallbackChildSet = nextFiberChild !== undefined ? nextFiberChild.sibling : undefined;
			// Note: we can't use nextFiber.child.sibling.alternate because the set
			// is special and alternate may not exist.
			const prevFiberChild = prevFiber.child;
			const prevFallbackChildSet = prevFiberChild !== undefined ? prevFiberChild.sibling : undefined;

			if (
				nextFallbackChildSet !== undefined &&
				prevFallbackChildSet !== undefined &&
				updateFiberRecursively(
					nextFallbackChildSet,
					prevFallbackChildSet,
					nextFiber,
					traceNearestHostComponentUpdate
				)
			) {
				shouldResetChildren = true;
			}
		} else if (prevDidTimeout && !nextDidTimeOut) {
			// Fallback -> Primary: unmount the fallback set (note: don't emulate
			// the fallback unmount because React actually did it) and mount the
			// primary set.
			const nextPrimaryChildSet = nextFiber.child;
			if (nextPrimaryChildSet !== undefined) {
				mountFiberRecursively(nextPrimaryChildSet, nextFiber, true, traceNearestHostComponentUpdate);
			}
			shouldResetChildren = true;
		} else if (!prevDidTimeout && nextDidTimeOut) {
			// Primary -> Fallback: hide the primary set (this is not a real
			// unmount, so React won't report it; walk the previous tree and
			// record unmounts manually) and mount the fallback set.
			unmountFiberChildrenRecursively(prevFiber);

			const nextFiberChild = nextFiber.child;
			const nextFallbackChildSet = nextFiberChild !== undefined ? nextFiberChild.sibling : undefined;

			if (nextFallbackChildSet !== undefined) {
				mountFiberRecursively(nextFallbackChildSet, nextFiber, true, traceNearestHostComponentUpdate);
				shouldResetChildren = true;
			}
		} else {
			// Common case: Primary -> Primary. Same code path as non-Suspense fibers.
			if (nextFiber.child !== prevFiber.child) {
				// If the first child is different, we need to traverse them. Each
				// next child will be either a new child (mount) or an alternate
				// (update).
				let nextChild: Fiber | undefined = nextFiber.child;
				let prevChildAtSameIndex: Fiber | undefined = prevFiber.child;

				while (nextChild !== undefined) {
					// Children will be referentially different because they are
					// either new mounts or alternates of previous children. We
					// don't track deletions here because they're reported separately.
					if (nextChild.alternate !== undefined) {
						const prevChild = nextChild.alternate;
						if (
							updateFiberRecursively(
								nextChild,
								prevChild,
								shouldIncludeInTree ? nextFiber : parentFiber,
								traceNearestHostComponentUpdate
							)
						) {
							// If a nested tree child order changed but it can't handle
							// its own child order invalidation, propagate the need to
							// reset child order upwards to this Fiber.
							shouldResetChildren = true;
						}
						// Keep track of whether the conceptual child order matches the
						// previous order.
						if (prevChild !== prevChildAtSameIndex) {
							shouldResetChildren = true;
						}
					} else {
						mountFiberRecursively(
							nextChild,
							shouldIncludeInTree ? nextFiber : parentFiber,
							false,
							traceNearestHostComponentUpdate
						);
						shouldResetChildren = true;
					}

					nextChild = nextChild.sibling;

					// Advance the pointer in the previous list so we can keep
					// comparing if they line up.
					if (!shouldResetChildren && prevChildAtSameIndex !== undefined) {
						prevChildAtSameIndex = prevChildAtSameIndex.sibling;
					}
				}

				// If we have no more children but used to, they don't line up.
				if (prevChildAtSameIndex !== undefined) {
					shouldResetChildren = true;
				}
			} else if (traceUpdatesEnabled) {
				// If we're tracing updates and bailed out before reaching a host
				// node, fall back to recursively marking the nearest host
				// descendants for highlight.
				if (traceNearestHostComponentUpdate) {
					const hostFibers = findAllCurrentHostFibers(getFiberID(getPrimaryFiber(nextFiber)));
					for (const hostFiber of hostFibers) {
						traceUpdatesForNodes.add(hostFiber.stateNode as NativeType);
					}
				}
			}
		}

		if (shouldIncludeInTree) {
			const isProfilingSupported = nextFiber.treeBaseDuration !== undefined;
			if (isProfilingSupported) {
				recordProfilingDurations(nextFiber);
			}
		}

		if (shouldResetChildren) {
			// We need to crawl the subtree for closest non-filtered Fibers so we
			// can display them in a flat children set.
			if (shouldIncludeInTree) {
				// Normally, search for children from the rendered child.
				let nextChildSet: Fiber | undefined = nextFiber.child;
				if (nextDidTimeOut) {
					// Special case: timed-out Suspense renders the fallback set.
					const nextFiberChild = nextFiber.child;
					nextChildSet = nextFiberChild !== undefined ? nextFiberChild.sibling : undefined;
				}
				if (nextChildSet !== undefined) {
					recordResetChildren(nextFiber, nextChildSet);
				}

				// We've handled the child order change for this Fiber. Since it's
				// included, there's no need to invalidate the parent's child order.
				return false;
			} else {
				// Let the closest unfiltered parent Fiber reset its child order.
				return true;
			}
		} else {
			return false;
		}
	};

	const cleanup = (): void => {
		// We don't patch any methods so there is no cleanup.
	};

	const flushInitialOperations = (): void => {
		const localPendingOperationsQueue = pendingOperationsQueue;
		pendingOperationsQueue = undefined;

		if (localPendingOperationsQueue !== undefined && localPendingOperationsQueue.size() > 0) {
			for (const operations of localPendingOperationsQueue) {
				hook.emit('operations', operations);
			}
		} else {
			// Before the traversals, remember to start tracking our path in case
			// we have selection to restore.
			if (trackedPath !== undefined) {
				mightBeOnTrackedPath = true;
			}

			// If we have not been profiling, we can just walk the tree and build
			// up its current state as-is.
			hook.getFiberRoots(rendererID).forEach((root) => {
				const rootFiber = root as Fiber;
				currentRootID = getFiberID(getPrimaryFiber(rootFiber.current as Fiber));
				setRootPseudoKey(currentRootID, rootFiber.current as Fiber);

				// Checking root.memoizedInteractions handles the multi-renderer
				// edge case where some v16 renderers support profiling and others
				// don't.
				if (isProfiling && (rootFiber as Obj).memoizedInteractions !== undefined) {
					// If profiling is active, store commit time and duration, and
					// the current interactions. The frontend may request this
					// information after profiling has stopped.
					const interactions = (rootFiber as Obj).memoizedInteractions as unknown;
					currentCommitProfilingMetadata = {
						changeDescriptions: recordChangeDescriptions ? new Map<number, ChangeDescription>() : undefined,
						durations: [] as number[],
						commitTime: getCurrentTime() - profilingStartTime,
						interactions: mapEntries(interactions as Map<number, Interaction>).map(([, interaction]) => ({
							id: interaction.id,
							name: interaction.name,
							timestamp: interaction.timestamp - profilingStartTime,
						})),
						maxActualDuration: 0,
						priorityLevel: undefined,
					};
				}

				mountFiberRecursively(rootFiber.current as Fiber, undefined, false, false);
				flushPendingEvents(rootFiber);
				currentRootID = -1;
			});
		}
	};

	const handleCommitFiberUnmount = (fiber: object): void => {
		// This is not recursive. We can't traverse fibers after unmounting, so
		// we rely on React telling us about each unmount individually.
		recordUnmount(fiber as Fiber, false);
	};

	const formatPriorityLevel = (priorityLevel: number | undefined): string => {
		if (priorityLevel === undefined) {
			return 'Unknown';
		}
		if (priorityLevel === ImmediatePriority) {
			return 'Immediate';
		} else if (priorityLevel === UserBlockingPriority) {
			return 'User-Blocking';
		} else if (priorityLevel === NormalPriority) {
			return 'Normal';
		} else if (priorityLevel === LowPriority) {
			return 'Low';
		} else if (priorityLevel === IdlePriority) {
			return 'Idle';
		} else {
			return 'Unknown';
		}
	};

	const handleCommitFiberRoot = (root: object, priorityLevel?: number): void => {
		const rootObj = root as Obj;
		const current = rootObj.current as Fiber;
		const alternate = current.alternate;

		currentRootID = getFiberID(getPrimaryFiber(current));

		// Before the traversals, remember to start tracking our path in case we
		// have selection to restore.
		if (trackedPath !== undefined) {
			mightBeOnTrackedPath = true;
		}
		if (traceUpdatesEnabled) {
			traceUpdatesForNodes.clear();
		}

		// Checking root.memoizedInteractions handles the multi-renderer edge case
		// where some v16 renderers support profiling and others don't.
		const isProfilingSupported = rootObj.memoizedInteractions !== undefined;

		if (isProfiling && isProfilingSupported) {
			// If profiling is active, store commit time and duration, and the
			// current interactions. The frontend may request this information
			// after profiling has stopped.
			const interactions = rootObj.memoizedInteractions as unknown as Map<number, Interaction>;
			currentCommitProfilingMetadata = {
				changeDescriptions: recordChangeDescriptions ? new Map<number, ChangeDescription>() : undefined,
				durations: [] as number[],
				commitTime: getCurrentTime() - profilingStartTime,
				interactions: mapEntries(interactions).map(([, interaction]) => ({
					id: interaction.id,
					name: interaction.name,
					timestamp: interaction.timestamp - profilingStartTime,
				})),
				maxActualDuration: 0,
				priorityLevel: priorityLevel === undefined ? undefined : formatPriorityLevel(priorityLevel),
			};
		}

		if (alternate !== undefined) {
			// TODO: relying on this seems a bit fishy.
			const wasMounted =
				alternate.memoizedState !== undefined && (alternate.memoizedState as Obj).element !== undefined;
			const isMounted =
				current.memoizedState !== undefined && (current.memoizedState as Obj).element !== undefined;

			if (!wasMounted && isMounted) {
				// Mount a new root.
				setRootPseudoKey(currentRootID, current);
				mountFiberRecursively(current, undefined, false, false);
			} else if (wasMounted && isMounted) {
				// Update an existing root.
				updateFiberRecursively(current, alternate, undefined, false);
			} else if (wasMounted && !isMounted) {
				// Unmount an existing root.
				removeRootPseudoKey(currentRootID);
				recordUnmount(current, false);
			}
		} else {
			// Mount a new root.
			setRootPseudoKey(currentRootID, current);
			mountFiberRecursively(current, undefined, false, false);
		}

		if (isProfiling && isProfilingSupported) {
			if (rootToCommitProfilingMetadataMap === undefined) {
				rootToCommitProfilingMetadataMap = new Map<number, Array<CommitProfilingData>>();
			}
			const commitProfilingMetadata = rootToCommitProfilingMetadataMap.get(currentRootID);
			if (commitProfilingMetadata !== undefined) {
				commitProfilingMetadata.push(currentCommitProfilingMetadata as CommitProfilingData);
			} else {
				rootToCommitProfilingMetadataMap.set(currentRootID, [
					currentCommitProfilingMetadata as CommitProfilingData,
				]);
			}
		}

		// We're done here.
		flushPendingEvents(rootObj);

		if (traceUpdatesEnabled) {
			hook.emit('traceUpdates', traceUpdatesForNodes);
		}

		currentRootID = -1;
	};

	// Fiber lookup / tree reflection

	const getNearestMountedFiber = (fiber: Fiber): Fiber | undefined => {
		const find = (Reconciler as unknown as { getNearestMountedFiber: (f: Fiber) => Fiber | undefined })
			.getNearestMountedFiber;
		return find(fiber) ?? undefined;
	};

	findAllCurrentHostFibers = (id: number): Array<Fiber> => {
		const fibers: Fiber[] = [];
		const fiber = findCurrentFiberUsingSlowPathById(id);

		if (fiber === undefined) {
			return fibers;
		}

		// Next we'll drill down this component to find all HostComponent/Text.
		let node: Fiber = fiber;

		while (true) {
			if (node.tag === HostComponent || node.tag === HostText) {
				fibers.push(node);
			} else if (node.child !== undefined) {
				node.child.return = node;
				node = node.child;
				continue;
			}
			if (node === fiber) {
				return fibers;
			}

			while (node.sibling === undefined) {
				if (node.return === undefined || node.return === fiber) {
					return fibers;
				}
				node = node.return;
			}

			node.sibling.return = node.return;
			node = node.sibling;
		}
	};

	const findNativeNodesForFiberID = (id: number): Array<NativeType> | undefined => {
		const [ok, result] = pcall(() => {
			let fiber = findCurrentFiberUsingSlowPathById(id);
			if (fiber === undefined) {
				return undefined;
			}

			// Special case for a timed-out Suspense.
			const isTimedOutSuspense = fiber.tag === SuspenseComponent && fiber.memoizedState !== undefined;
			if (isTimedOutSuspense) {
				// A timed-out Suspense's findDOMNode is useless. Try our best to
				// find the fallback directly.
				const maybeFallbackFiber = fiber.child !== undefined ? fiber.child.sibling : undefined;
				if (maybeFallbackFiber !== undefined) {
					fiber = maybeFallbackFiber;
				}
			}

			const hostFibers = findAllCurrentHostFibers(id);
			return hostFibers.map((hostFiber) => hostFiber.stateNode as NativeType);
		});

		if (!ok) {
			// The fiber might have unmounted by now.
			return undefined;
		}
		return result as Array<NativeType> | undefined;
	};

	const getDisplayNameForFiberID = (id: number, _findNearestUnfilteredAncestor?: boolean): string | undefined => {
		const fiber = idToFiberMap.get(id);
		return fiber !== undefined ? getDisplayNameForFiber(fiber) : undefined;
	};

	const getFiberIDForNative = (
		hostInstance: NativeType,
		findNearestUnfilteredAncestor?: boolean
	): number | undefined => {
		const nearest = findNearestUnfilteredAncestor ?? false;
		let fiber = renderer.findFiberByHostInstance(hostInstance);

		if (fiber !== undefined) {
			if (nearest) {
				while (fiber !== undefined && shouldFilterFiber(fiber)) {
					fiber = fiber.return;
				}
			}
			if (fiber === undefined) {
				return undefined;
			}
			return getFiberID(getPrimaryFiber(fiber));
		}

		return undefined;
	};

	// This function is copied from React and should be kept in sync with
	// ReactFiberTreeReflection.js. It would be nice if we updated React to
	// inject this function directly (vs indirectly via findDOMNode).

	const assertIsMounted = (fiber: Fiber): void => {
		invariant(getNearestMountedFiber(fiber) === fiber, 'Unable to find node on an unmounted component.');
	};

	findCurrentFiberUsingSlowPathById = (id: number): Fiber | undefined => {
		const fiber = idToFiberMap.get(id);

		if (fiber === undefined) {
			Console.warn(string.format('Could not find Fiber with id "%s"', tostring(id)));
			return undefined;
		}

		const alternate = fiber.alternate;
		if (alternate === undefined) {
			// If there is no alternate, then we only need to check if it is mounted.
			const nearestMounted = getNearestMountedFiber(fiber);
			invariant(nearestMounted !== undefined, 'Unable to find node on an unmounted component.');
			if (nearestMounted !== fiber) {
				return undefined;
			}
			return fiber;
		}

		// If we have two possible branches, we'll walk backwards up to the root to
		// see what path the root points to. On the way we may hit one of the
		// special cases and we'll deal with them.
		let a: Fiber = fiber;
		let b: Fiber = alternate;

		while (true) {
			const parentA = a.return;
			if (parentA === undefined) {
				// We're at the root.
				break;
			}

			const parentB = parentA.alternate;
			if (parentB === undefined) {
				// There is no alternate. This is an unusual case. Currently, it only
				// happens when a Suspense component is hidden. An extra fragment fiber
				// is inserted between the Suspense fiber and its children. Skip over
				// this extra fragment fiber and proceed to the next parent.
				const nextParent = parentA.return;
				if (nextParent !== undefined) {
					a = nextParent;
					b = nextParent;
					continue;
				}
				// If there's no parent, we're at the root.
				break;
			}

			// If both copies of the parent fiber point to the same child, we can
			// assume that the child is current. This happens when we bailout on low
			// priority: the bailed out fiber's child reuses the current child.
			if (parentA.child === parentB.child) {
				let child = parentA.child;
				while (child !== undefined) {
					if (child === a) {
						// We've determined that A is the current branch.
						assertIsMounted(parentA);
						return fiber;
					}
					if (child === b) {
						// We've determined that B is the current branch.
						assertIsMounted(parentA);
						return alternate;
					}
					child = child.sibling;
				}
				// We should never have an alternate for any mounting node, so the
				// only way this could happen is if this was unmounted, if at all.
				invariant(false, 'Unable to find node on an unmounted component.');
			}

			if (a.return !== b.return) {
				// The return pointers of A and B point to different fibers. We assume
				// return pointers never criss-cross, so A must belong to the child set
				// of A.return and B must belong to the child set of B.return.
				a = parentA;
				b = parentB;
			} else {
				// The return pointers point to the same fiber. We'll have to use the
				// default slow path: scan the child sets of each parent alternate to
				// see which child belongs to which set.

				// Search parent A's child set.
				let didFindChild = false;
				let child = parentA.child;
				while (child !== undefined) {
					if (child === a) {
						didFindChild = true;
						a = parentA;
						b = parentB;
						break;
					}
					if (child === b) {
						didFindChild = true;
						b = parentA;
						a = parentB;
						break;
					}
					child = child.sibling;
				}
				if (!didFindChild) {
					// Search parent B's child set.
					child = parentB.child;
					while (child !== undefined) {
						if (child === a) {
							didFindChild = true;
							a = parentB;
							b = parentA;
							break;
						}
						if (child === b) {
							didFindChild = true;
							b = parentB;
							a = parentA;
							break;
						}
						child = child.sibling;
					}
					invariant(
						didFindChild,
						'Child was not found in either parent set. This indicates a bug in React ' +
							'related to the return pointer. Please file an issue.'
					);
				}
			}

			invariant(
				a.alternate === b,
				"Return fibers should always be each others' alternates. This error is likely " +
					'caused by a bug in React. Please file an issue.'
			);
		}

		// If the root is not a host container, we're in a disconnected tree (i.e.
		// unmounted).
		invariant(a.tag === HostRoot, 'Unable to find node on an unmounted component.');
		if ((a.stateNode as Obj).current === a) {
			// We've determined that A is the current branch.
			return fiber;
		}
		// Otherwise B has to be current branch.
		return alternate;
	};

	// Inspecting elements

	const prepareViewAttributeSource = (id: number, path: Array<string | number>): void => {
		const isCurrent = isMostRecentlyInspectedElementCurrent(id);

		if (isCurrent && mostRecentlyInspectedElement !== undefined) {
			global.$attribute = getInObject(mostRecentlyInspectedElement, path);
		}
	};

	const prepareViewElementSource = (id: number): void => {
		const fiber = idToFiberMap.get(id);

		if (fiber === undefined) {
			Console.warn(string.format('Could not find Fiber with id "%s"', tostring(id)));
			return;
		}

		const elementType = fiber.elementType;
		const tag = fiber.tag;
		const type_ = fiber.type;

		if (
			tag === ClassComponent ||
			tag === FunctionComponent ||
			tag === IncompleteClassComponent ||
			tag === IndeterminateComponent
		) {
			global.$type = type_;
		} else if (tag === ForwardRef) {
			global.$type = (type_ as Obj).render;
		} else if (tag === MemoComponent || tag === SimpleMemoComponent) {
			const elementTypeObj = elementType as Obj | undefined;
			global.$type =
				elementTypeObj !== undefined && elementTypeObj.type !== undefined ? elementTypeObj.type : type_;
		} else {
			global.$type = undefined;
		}
	};

	const getOwnersList = (id: number): Array<Owner> | undefined => {
		const fiber = findCurrentFiberUsingSlowPathById(id);

		if (fiber === undefined) {
			return undefined;
		}

		const debugOwner = fiber._debugOwner;
		const owners: Owner[] = [];
		owners.push({
			displayName: getDisplayNameForFiber(fiber) ?? 'Anonymous',
			id,
			type: getElementTypeForFiber(fiber),
		});

		if (debugOwner !== undefined) {
			let owner: Fiber | undefined = debugOwner;

			while (owner !== undefined) {
				owners.insert(0, {
					displayName: getDisplayNameForFiber(owner) ?? 'Anonymous',
					id: getFiberID(getPrimaryFiber(owner)),
					type: getElementTypeForFiber(owner),
				});

				owner = owner._debugOwner;
			}
		}

		return owners;
	};

	// Fast path props lookup for the React Native style editor.
	const getInstanceAndStyle = (id: number): InstanceAndStyle => {
		let instance: object | undefined;
		let style: object | undefined;
		const fiber = findCurrentFiberUsingSlowPathById(id);

		if (fiber !== undefined) {
			instance = fiber.stateNode as object;

			if (fiber.memoizedProps !== undefined) {
				style = fiber.memoizedProps.style as object | undefined;
			}
		}

		return {
			instance,
			style,
		};
	};

	const inspectElementRaw = (id: number): InspectedElement | undefined => {
		const fiber = findCurrentFiberUsingSlowPathById(id);

		if (fiber === undefined) {
			return undefined;
		}

		const debugOwner = fiber._debugOwner;
		const debugSource = fiber._debugSource;
		const stateNode = fiber.stateNode;
		const key = fiber.key;
		const memoizedProps = fiber.memoizedProps;
		const memoizedState = fiber.memoizedState;
		const dependencies = fiber.contextDependencies;
		const tag = fiber.tag;
		const type_ = fiber.type;

		const elementType = getElementTypeForFiber(fiber);

		const usesHooks =
			(tag === FunctionComponent || tag === SimpleMemoComponent || tag === ForwardRef) &&
			(memoizedState !== undefined || dependencies !== undefined);

		const typeSymbol = getTypeSymbol(type_);
		let canViewSource = false;
		let context: unknown;

		if (
			tag === ClassComponent ||
			tag === FunctionComponent ||
			tag === IncompleteClassComponent ||
			tag === IndeterminateComponent ||
			tag === MemoComponent ||
			tag === ForwardRef ||
			tag === SimpleMemoComponent
		) {
			canViewSource = true;

			if (stateNode !== undefined && (stateNode as ClassInstance).context !== undefined) {
				// Don't show an empty context object for class components that don't
				// use the context API.
				const typeObj = type_ as Obj;
				const shouldHideContext =
					elementType === ElementTypeClass &&
					typeObj.contextTypes === undefined &&
					typeObj.contextType === undefined;

				if (!shouldHideContext) {
					context = (stateNode as ClassInstance).context;
				}
			}
		} else if (typeSymbol === CONTEXT_NUMBER || typeSymbol === CONTEXT_SYMBOL_STRING) {
			// 16.3-16.5 read from "type" because the Consumer is the actual context
			// object. 16.6+ should read from "type._context" because Consumer can be
			// different (in DEV).
			const typeObj = type_ as Obj;
			const consumerResolvedContext = (typeObj._context ?? type_) as Obj;

			// Global context value.
			if (consumerResolvedContext._currentValue !== undefined) {
				context = consumerResolvedContext._currentValue;
			}

			// Look for overridden value.
			let current = fiber.return;

			while (current !== undefined) {
				const currentType = current.type;
				const currentTypeSymbol = getTypeSymbol(currentType);

				if (currentTypeSymbol === PROVIDER_NUMBER || currentTypeSymbol === PROVIDER_SYMBOL_STRING) {
					// 16.3.0 exposed the context object as "context"; PR #12501
					// changed it to "_context" for 16.3.1+.
					const currentTypeObj = currentType as Obj;
					const providerResolvedContext = (currentTypeObj._context ?? currentTypeObj.context) as Obj;

					if (providerResolvedContext === consumerResolvedContext) {
						context = current.memoizedProps.value;
						break;
					}
				}

				current = current.return;
			}
		}

		let hasLegacyContext = false;
		let contextValue: Obj | undefined;

		if (context !== undefined) {
			hasLegacyContext = (type_ as Obj).contextTypes !== undefined;
			// To simplify hydration and display logic for context, wrap in a value
			// object. Otherwise simple values (e.g. strings, booleans) become harder
			// to handle.
			contextValue = { value: context };
		}

		let owners: Array<Owner> | undefined;

		if (debugOwner !== undefined) {
			owners = [] as Owner[];
			let owner: Fiber | undefined = debugOwner;
			while (owner !== undefined) {
				owners.push({
					displayName: getDisplayNameForFiber(owner) ?? 'Anonymous',
					id: getFiberID(getPrimaryFiber(owner)),
					type: getElementTypeForFiber(owner),
				});
				owner = owner._debugOwner;
			}
		}

		const isTimedOutSuspense = tag === SuspenseComponent && memoizedState !== undefined;
		let hooks: Obj | undefined;

		if (usesHooks) {
			// Temporarily disable all console logging before re-running the hook,
			// then restore it afterwards. Roblox has no dynamic console method table
			// to iterate, so we simply wrap the inspection in pcall.
			const [hookOk, hookResult] = pcall(() =>
				inspectHooksOfFiber(fiber, renderer.currentDispatcherRef as never)
			);

			if (hookOk) {
				hooks = hookResult as unknown as Obj;
			}
		}

		let rootType: string | undefined;
		let current: Fiber = fiber;

		while (current.return !== undefined) {
			current = current.return;
		}
		const fiberRoot = current.stateNode as Obj | undefined;
		if (fiberRoot !== undefined && fiberRoot._debugRootType !== undefined) {
			rootType = fiberRoot._debugRootType as string;
		}

		return {
			id,
			// Does the current renderer support editable hooks and function props?
			canEditHooks: type(overrideHookState) === 'function',
			canEditFunctionProps: type(overrideProps) === 'function',
			// Does the current renderer support the advanced editing interface?
			canEditHooksAndDeletePaths: type(overrideHookStateDeletePath) === 'function',
			canEditHooksAndRenamePaths: type(overrideHookStateRenamePath) === 'function',
			canEditFunctionPropsDeletePaths: type(overridePropsDeletePath) === 'function',
			canEditFunctionPropsRenamePaths: type(overridePropsRenamePath) === 'function',
			canToggleSuspense: supportsTogglingSuspense && (!isTimedOutSuspense || forceFallbackForSuspenseIDs.has(id)),

			// Can view the component source location.
			canViewSource,

			// Does the component have legacy context?
			hasLegacyContext,

			key,
			displayName: getDisplayNameForFiber(fiber),
			type_: elementType,

			// Inspectable properties.
			context: contextValue,
			hooks,
			props: memoizedProps,
			state: usesHooks ? undefined : (memoizedState as Obj | undefined),

			// List of owners.
			owners,

			// Location of the component in source code.
			source: debugSource,

			rootType,
			rendererPackageName: renderer.rendererPackageName,
			rendererVersion: renderer.version,
		};
	};

	isMostRecentlyInspectedElementCurrent = (id: number): boolean =>
		mostRecentlyInspectedElement !== undefined &&
		mostRecentlyInspectedElement.id === id &&
		!hasElementUpdatedSinceLastInspected;

	// Track the intersection of currently inspected paths, so that we can send
	// their data along if the element is re-rendered.
	const mergeInspectedPaths = (path: Array<string | number>): void => {
		let current = currentlyInspectedPaths;

		for (const key of path) {
			if (current[key] === undefined) {
				current[key] = {};
			}
			current = current[key] as Obj;
		}
	};

	const createIsPathAllowed = (key: string | undefined, secondaryCategory: string | undefined) => {
		// This function helps prevent previously-inspected paths from being
		// dehydrated in updates. This is important to avoid a bad user experience
		// where expanded toggles collapse on update.
		return (path: Array<string | number>): boolean => {
			if (secondaryCategory === 'hooks') {
				if (path.size() === 1) {
					// Never dehydrate the "hooks" object at the top levels.
					return true;
				}
				if (path[path.size() - 1] === 'subHooks' || path[path.size() - 2] === 'subHooks') {
					// Dehydrating the 'subHooks' property makes the HooksTree UI a lot
					// more complicated, so it's easiest for now if we just don't break
					// on this boundary. We can always dehydrate a level deeper (in the
					// value object).
					return true;
				}
			}

			let current: Obj | undefined =
				key === undefined ? currentlyInspectedPaths : (currentlyInspectedPaths[key] as Obj | undefined);

			if (current === undefined) {
				return false;
			}

			for (const segment of path) {
				current = current[segment] as Obj | undefined;
				if (current === undefined) {
					return false;
				}
			}
			return true;
		};
	};

	const updateSelectedElement = (inspectedElement: InspectedElement): void => {
		const hooks = inspectedElement.hooks;
		const id = inspectedElement.id;
		const props = inspectedElement.props;
		const fiber = idToFiberMap.get(id);

		if (fiber === undefined) {
			Console.warn(string.format('Could not find Fiber with id "%s"', tostring(id)));
			return;
		}

		const elementType = fiber.elementType;
		const stateNode = fiber.stateNode;
		const tag = fiber.tag;
		const type_ = fiber.type;

		if (tag === ClassComponent || tag === IncompleteClassComponent || tag === IndeterminateComponent) {
			global.$r = stateNode;
		} else if (tag === FunctionComponent) {
			global.$r = {
				hooks,
				props,
				type: type_,
			};
		} else if (tag === ForwardRef) {
			global.$r = {
				props,
				type: (type_ as Obj).render,
			};
		} else if (tag === MemoComponent || tag === SimpleMemoComponent) {
			const elementTypeObj = elementType as Obj | undefined;
			global.$r = {
				props,
				type: elementTypeObj !== undefined && elementTypeObj.type !== undefined ? elementTypeObj.type : type_,
			};
		} else {
			global.$r = undefined;
		}
	};

	const storeAsGlobal = (id: number, path: Array<string | number>, count: number): void => {
		const isCurrent = isMostRecentlyInspectedElementCurrent(id);

		if (isCurrent && mostRecentlyInspectedElement !== undefined) {
			const value = getInObject(mostRecentlyInspectedElement, path);
			const key = string.format('$reactTemp%s', tostring(count));

			global[key] = value;

			Console.log(key);
			Console.log(value);
		}
	};

	const copyElementPath = (id: number, path: Array<string | number>): void => {
		const isCurrent = isMostRecentlyInspectedElementCurrent(id);

		if (isCurrent && mostRecentlyInspectedElement !== undefined) {
			copyToClipboard(getInObject(mostRecentlyInspectedElement, path));
		}
	};

	const clean = (value: unknown, isPathAllowed: (path: Array<string | number>) => boolean): Obj | undefined =>
		cleanForBridge(value, isPathAllowed) as unknown as Obj | undefined;

	const inspectElement = (id: number, path?: Array<string | number>): InspectedElementPayload => {
		const isCurrent = isMostRecentlyInspectedElementCurrent(id);

		if (isCurrent) {
			if (path !== undefined) {
				mergeInspectedPaths(path);

				const secondaryCategory = path[0] === 'hooks' ? 'hooks' : undefined;

				// If this element has not been updated since it was last inspected,
				// we can just return the subset of data in the newly-inspected path.
				return {
					id,
					type: 'hydrated-path',
					path,
					value: cleanForBridge(
						getInObject(mostRecentlyInspectedElement as unknown as object, path),
						createIsPathAllowed(undefined, secondaryCategory),
						path
					),
				};
			}

			// If this element has not been updated since it was last inspected, we
			// don't need to re-run it; we can just return the ID to indicate that it
			// has not changed.
			return {
				id,
				type: 'no-change',
			};
		}

		hasElementUpdatedSinceLastInspected = false;

		if (mostRecentlyInspectedElement === undefined || mostRecentlyInspectedElement.id !== id) {
			currentlyInspectedPaths = {};
		}

		mostRecentlyInspectedElement = inspectElementRaw(id);

		if (mostRecentlyInspectedElement === undefined) {
			return {
				id,
				type: 'not-found',
			};
		}

		if (path !== undefined) {
			mergeInspectedPaths(path);
		}

		// Any time an inspected element has an update, we should update the
		// selected $r value as well. Do this before dehydration (cleanForBridge).
		updateSelectedElement(mostRecentlyInspectedElement);

		// Clone before cleaning so that we preserve the full data. This enables
		// sending patches without re-inspecting if hydrated paths are requested.
		// (Reducing how often we shallow-render is a better DX for function
		// components that use hooks.)
		const most = mostRecentlyInspectedElement;
		const cleanedInspectedElement: InspectedElement = {
			id: most.id,
			displayName: most.displayName,
			canEditHooks: most.canEditHooks,
			canEditFunctionProps: most.canEditFunctionProps,
			canEditHooksAndDeletePaths: most.canEditHooksAndDeletePaths,
			canEditHooksAndRenamePaths: most.canEditHooksAndRenamePaths,
			canEditFunctionPropsDeletePaths: most.canEditFunctionPropsDeletePaths,
			canEditFunctionPropsRenamePaths: most.canEditFunctionPropsRenamePaths,
			canToggleSuspense: most.canToggleSuspense,
			canViewSource: most.canViewSource,
			hasLegacyContext: most.hasLegacyContext,
			context: clean(most.context, createIsPathAllowed('context', undefined)),
			hooks: clean(most.hooks, createIsPathAllowed('hooks', 'hooks')),
			props: clean(most.props, createIsPathAllowed('props', undefined)),
			state: clean(most.state, createIsPathAllowed('state', undefined)),
			key: most.key,
			owners: most.owners,
			source: most.source,
			type_: most.type_,
			rootType: most.rootType,
			rendererPackageName: most.rendererPackageName,
			rendererVersion: most.rendererVersion,
		};

		return {
			id,
			type: 'full-data',
			value: cleanedInspectedElement,
		};
	};

	const logElementToConsole = (id: number): void => {
		const result: InspectedElement | undefined = isMostRecentlyInspectedElementCurrent(id)
			? mostRecentlyInspectedElement
			: inspectElementRaw(id);

		if (result === undefined) {
			Console.warn(string.format('Could not find Fiber with id "%s"', tostring(id)));
			return;
		}

		if (result.props !== undefined) {
			Console.log('Props:', result.props);
		}
		if (result.state !== undefined) {
			Console.log('State:', result.state);
		}
		if (result.hooks !== undefined) {
			Console.log('Hooks:', result.hooks);
		}

		const nativeNodes = findNativeNodesForFiberID(id);

		if (nativeNodes !== undefined) {
			Console.log('Nodes:', nativeNodes);
		}
		if (result.source !== undefined) {
			Console.log('Location:', result.source);
		}
	};

	const deletePath = (type_: string, id: number, hookID: number | undefined, path: Array<string | number>): void => {
		const fiber = findCurrentFiberUsingSlowPathById(id);

		if (fiber !== undefined) {
			const instance = fiber.stateNode as ClassInstance | undefined;

			if (type_ === 'context') {
				// To simplify hydration and display of primitive context values
				// (e.g. number, string), inspectElement() wraps context in a
				// {value: ...} object. We need to remove the first part of the path
				// (the "value") before continuing.
				path = slice(path, 1, path.size());

				if (fiber.tag === ClassComponent) {
					if (path.size() === 0) {
						// Simple context value (noop).
					} else if (instance !== undefined) {
						deletePathInObject(instance.context as object | undefined, path);
						instance.forceUpdate();
					}
				} else if (fiber.tag === FunctionComponent) {
					// Function components using legacy context are not editable
					// because there's no instance on which to create a cloned, mutated
					// context.
				}
			} else if (type_ === 'hooks') {
				if (type(overrideHookStateDeletePath) === 'function') {
					invariant(hookID !== undefined, 'Expected hookID to be defined');
					overrideHookStateDeletePath(fiber, hookID, path);
				}
			} else if (type_ === 'props') {
				if (instance === undefined) {
					if (type(overridePropsDeletePath) === 'function') {
						overridePropsDeletePath(fiber, path);
					}
				} else {
					fiber.pendingProps = copyWithDelete(instance.props, path) as Record<string, unknown>;
					instance.forceUpdate();
				}
			} else if (type_ === 'state') {
				if (instance !== undefined) {
					deletePathInObject(instance.state, path);
					instance.forceUpdate();
				}
			}
		}
	};

	const renamePath = (
		type_: string,
		id: number,
		hookID: number | undefined,
		oldPath: Array<string | number>,
		newPath: Array<string | number>
	): void => {
		const fiber = findCurrentFiberUsingSlowPathById(id);

		if (fiber !== undefined) {
			const instance = fiber.stateNode as ClassInstance | undefined;

			if (type_ === 'context') {
				// See note in deletePath about the {value: ...} wrapper.
				oldPath = slice(oldPath, 1, oldPath.size());
				newPath = slice(newPath, 1, newPath.size());

				if (fiber.tag === ClassComponent) {
					if (oldPath.size() === 0) {
						// Simple context value (noop).
					} else if (instance !== undefined) {
						renamePathInObject(instance.context as object | undefined, oldPath, newPath);
						instance.forceUpdate();
					}
				} else if (fiber.tag === FunctionComponent) {
					// Function components using legacy context are not editable.
				}
			} else if (type_ === 'hooks') {
				if (type(overrideHookStateRenamePath) === 'function') {
					invariant(hookID !== undefined, 'Expected hookID to be defined');
					overrideHookStateRenamePath(fiber, hookID, oldPath, newPath);
				}
			} else if (type_ === 'props') {
				if (instance === undefined) {
					if (type(overridePropsRenamePath) === 'function') {
						overridePropsRenamePath(fiber, oldPath, newPath);
					}
				} else {
					fiber.pendingProps = copyWithRename(instance.props, oldPath, newPath) as Record<string, unknown>;
					instance.forceUpdate();
				}
			} else if (type_ === 'state') {
				if (instance !== undefined) {
					renamePathInObject(instance.state, oldPath, newPath);
					instance.forceUpdate();
				}
			}
		}
	};

	const overrideValueAtPath = (
		type_: string,
		id: number,
		hookID: number | undefined,
		path: Array<string | number>,
		value: unknown
	): void => {
		const fiber = findCurrentFiberUsingSlowPathById(id);

		if (fiber !== undefined) {
			const instance = fiber.stateNode as ClassInstance | undefined;

			if (type_ === 'context') {
				// See note in deletePath about the {value: ...} wrapper.
				path = slice(path, 1, path.size());

				if (fiber.tag === ClassComponent) {
					if (instance === undefined) {
						return;
					}
					if (path.size() === 0) {
						// Simple context value.
						instance.context = value;
					} else {
						setInObject(instance.context as object | undefined, path, value);
					}
					instance.forceUpdate();
				} else if (fiber.tag === FunctionComponent) {
					// Function components using legacy context are not editable.
				}
			} else if (type_ === 'hooks') {
				if (type(overrideHookState) === 'function') {
					invariant(hookID !== undefined, 'Expected hookID to be defined');
					overrideHookState(fiber, hookID, path, value);
				}
			} else if (type_ === 'props') {
				if (instance === undefined) {
					if (type(overrideProps) === 'function') {
						overrideProps(fiber, path, value);
					}
				} else {
					fiber.pendingProps = copyWithSet(instance.props, path, value) as Record<string, unknown>;
					instance.forceUpdate();
				}
			} else if (type_ === 'state') {
				if (instance !== undefined) {
					setInObject(instance.state, path, value);
					instance.forceUpdate();
				}
			}
		}
	};

	// Profiling

	const getProfilingData = (): ProfilingDataBackend => {
		const commitProfilingMetadata = rootToCommitProfilingMetadataMap;
		const displayNames = displayNamesByRootID;
		const initialTreeBaseDurations = initialTreeBaseDurationsMap;
		const initialIDToRoot = initialIDToRootMap;

		if (commitProfilingMetadata === undefined) {
			error('getProfilingData() called before any profiling data was recorded');
		}
		if (displayNames === undefined) {
			error('getProfilingData() called before any profiling data was recorded');
		}
		if (initialTreeBaseDurations === undefined) {
			error('getProfilingData() called before any profiling data was recorded');
		}
		if (initialIDToRoot === undefined) {
			error('getProfilingData() called before any profiling data was recorded');
		}

		const dataForRoots: Array<ProfilingDataForRootBackend> = [];

		commitProfilingMetadata.forEach((commitProfilingMetadataForRoot, rootID) => {
			const commitData: Array<CommitDataBackend> = [];
			const initialTreeBaseDurationsForRoot: Array<Array<number>> = [];
			const allInteractions: Map<number, Interaction> = new Map<number, Interaction>();
			const interactionCommits: Map<number, Array<number>> = new Map<number, Array<number>>();

			// We don't need to convert milliseconds to microseconds here because
			// the profiling summary is JSON serialized.
			initialTreeBaseDurations.forEach((treeBaseDuration, id) => {
				if (initialIDToRoot.get(id) === rootID) {
					initialTreeBaseDurationsForRoot.push([id, treeBaseDuration]);
				}
			});

			for (let commitIndex = 0; commitIndex < commitProfilingMetadataForRoot.size(); commitIndex++) {
				const commitProfilingData = commitProfilingMetadataForRoot[commitIndex];
				const changeDescriptions =
					commitProfilingData.changeDescriptions !== undefined
						? (mapEntries(commitProfilingData.changeDescriptions) as Array<
								Array<number | ChangeDescription>
							>)
						: undefined;
				const durations = commitProfilingData.durations;
				const interactionIDs: Array<number> = [];

				for (const interaction of commitProfilingData.interactions) {
					if (!allInteractions.has(interaction.id)) {
						allInteractions.set(interaction.id, interaction);
					}

					interactionIDs.push(interaction.id);

					const commitIndices = interactionCommits.get(interaction.id);
					if (commitIndices !== undefined) {
						commitIndices.push(commitIndex);
					} else {
						interactionCommits.set(interaction.id, [commitIndex]);
					}
				}

				const fiberActualDurations: Array<Array<number>> = [];
				const fiberSelfDurations: Array<Array<number>> = [];
				for (let i = 0; i < durations.size(); i += 3) {
					const fiberID = durations[i];
					fiberActualDurations.push([fiberID, durations[i + 1]]);
					fiberSelfDurations.push([fiberID, durations[i + 2]]);
				}

				commitData.push({
					changeDescriptions,
					duration: commitProfilingData.maxActualDuration,
					fiberActualDurations,
					fiberSelfDurations,
					interactionIDs,
					priorityLevel: commitProfilingData.priorityLevel,
					timestamp: commitProfilingData.commitTime,
				});
			}

			dataForRoots.push({
				commitData,
				displayName: displayNames.get(rootID) ?? 'Unknown',
				initialTreeBaseDurations: initialTreeBaseDurationsForRoot,
				interactionCommits: mapEntries(interactionCommits),
				interactions: mapEntries(allInteractions),
				rootID,
			});
		});

		return {
			dataForRoots,
			rendererID,
		};
	};

	const startProfiling = (shouldRecordChangeDescriptions: boolean): void => {
		if (isProfiling) {
			return;
		}

		recordChangeDescriptions = shouldRecordChangeDescriptions;

		// Capture initial values after we've registered the root but before we
		// record any commits, so we can compute each tree's base duration.
		const displayNames = new Map<number, string>();
		displayNamesByRootID = displayNames;
		initialTreeBaseDurationsMap = cloneMap(idToTreeBaseDurationMap);
		initialIDToRootMap = cloneMap(idToRootMap);
		idToContextsMap = new Map<number, unknown>();

		hook.getFiberRoots(rendererID).forEach((root) => {
			const rootFiber = root as Fiber;
			const rootID = getFiberID(getPrimaryFiber(rootFiber.current as Fiber));
			displayNames.set(rootID, getDisplayNameForRoot(rootFiber.current as Fiber));

			if (shouldRecordChangeDescriptions) {
				crawlToInitializeContextsMap(rootFiber.current as Fiber);
			}
		});

		isProfiling = true;
		profilingStartTime = getCurrentTime();
		rootToCommitProfilingMetadataMap = new Map<number, Array<CommitProfilingData>>();
	};

	const stopProfiling = (): void => {
		isProfiling = false;
		profilingStartTime = 0;
	};

	// Reload-and-profile, driven by the DevTools front end through the
	// session storage keys. The front end sets these just before triggering a
	// full page (experience) reload so we can resume profiling on the next
	// attach.
	if (sessionStorageGetItem(SESSION_STORAGE_RELOAD_AND_PROFILE_KEY) === 'true') {
		startProfiling(sessionStorageGetItem(SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY) === 'true');
	}

	// If the renderer has a suspense handler available, DevTools can force a
	// suspense boundary into its fallback (or back out of it).
	const shouldSuspendFiberAlwaysFalse = (): boolean => false;

	const shouldSuspendFiberAccordingToSet = (fiber: object): boolean => {
		const fiberObj = fiber as Fiber;
		const id = getFiberID(getPrimaryFiber(fiberObj));
		return forceFallbackForSuspenseIDs.has(id);
	};

	const overrideSuspense = (id: number, forceFallback: boolean): void => {
		if (type(setSuspenseHandler) === 'function' && type(scheduleUpdate) === 'function') {
			error('Expected overrideSuspense() to not be called when supportsSuspense is false');
		}

		if (forceFallback) {
			forceFallbackForSuspenseIDs.add(id);
			if (forceFallbackForSuspenseIDs.size() === 1) {
				(setSuspenseHandler as (fn: (fiber: object) => boolean) => void)(shouldSuspendFiberAccordingToSet);
			}
		} else {
			forceFallbackForSuspenseIDs.delete(id);
			if (forceFallbackForSuspenseIDs.size() === 0) {
				(setSuspenseHandler as (fn: (fiber: object) => boolean) => void)(shouldSuspendFiberAlwaysFalse);
			}
		}

		const fiber = idToFiberMap.get(id);
		if (fiber !== undefined) {
			(scheduleUpdate as (fiber: object) => void)(fiber);
		}
	};

	// Restoring selection after reload

	setTrackedPath = (path: Array<PathFrame> | undefined): void => {
		if (path === undefined) {
			trackedPathMatchFiber = undefined;
			trackedPathMatchDepth = -1;
			mightBeOnTrackedPath = false;
		}
		trackedPath = path;
	};

	updateTrackedPathStateBeforeMount = (fiber: Fiber): boolean => {
		if (trackedPath === undefined || !mightBeOnTrackedPath) {
			return false;
		}

		const path = trackedPath;
		const expected = path[trackedPathMatchDepth + 1] as PathFrame | undefined;
		if (expected === undefined) {
			error('Expected to see a frame at the next depth');
		}

		if (fiber.key === expected.key) {
			trackedPathMatchDepth++;
			return true;
		}

		return false;
	};

	updateTrackedPathStateAfterMount = (mightSiblingsBeOnTrackedPath: boolean): void => {
		mightBeOnTrackedPath = mightSiblingsBeOnTrackedPath;

		const path = trackedPath;
		if (path === undefined) {
			return;
		}

		// See if we're a full match and if so, record the matched fiber. This is
		// how DevTools restores a selection after a reload.
		if (trackedPathMatchDepth === path.size() - 1) {
			const fiber = trackedPathMatchFiber;
			if (fiber !== undefined) {
				// No need to keep tracking once we've found our way back.
				trackedPathMatchFiber = undefined;
				trackedPathMatchDepth = -1;
				setTrackedPath(undefined);
			}
		}
	};

	setRootPseudoKey = (id: number, fiber: Fiber): void => {
		const child = fiber.child;
		if (child === undefined) {
			return;
		}

		const displayName = getDisplayNameForRoot(child);
		const count = rootDisplayNameCounter.get(displayName) ?? 0;
		rootDisplayNameCounter.set(displayName, count + 1);
		rootPseudoKeys.set(id, `${displayName}:${count}`);
	};

	removeRootPseudoKey = (id: number): void => {
		const pseudoKey = rootPseudoKeys.get(id);
		if (pseudoKey !== undefined) {
			const lastColon = pseudoKey.match('%d+$')[0] as string;
			const displayName = string.sub(pseudoKey, 1, pseudoKey.size() - lastColon.size() - 1);
			const count = rootDisplayNameCounter.get(displayName);
			if (count !== undefined && count > 1) {
				rootDisplayNameCounter.set(displayName, count - 1);
			} else {
				rootDisplayNameCounter.delete(displayName);
			}
		}
		rootPseudoKeys.delete(id);
	};

	getDisplayNameForRoot = (fiber: Fiber): string => {
		let preferredDisplayName: string | undefined;
		let fallbackDisplayName: string | undefined;

		let child = fiber.child;
		for (let i = 0; i <= 2; i++) {
			if (child === undefined) {
				break;
			}

			const displayName = getDisplayNameForFiber(child);
			if (displayName !== undefined) {
				if (type(child.type) === 'function') {
					preferredDisplayName = displayName;
				} else if (fallbackDisplayName === undefined) {
					fallbackDisplayName = displayName;
				}
			}

			if (preferredDisplayName !== undefined) {
				break;
			}
			child = child.child;
		}

		return preferredDisplayName ?? fallbackDisplayName ?? 'Anonymous';
	};

	getPathFrame = (fiber: Fiber): PathFrame => {
		const key = fiber.key;
		let displayName: string | undefined;

		switch (fiber.tag) {
			case HostRoot:
				displayName = rootPseudoKeys.get(getFiberID(fiber));
				break;
			case HostComponent:
				displayName = fiber.type as string;
				break;
			default:
				displayName = getDisplayNameForFiber(fiber);
		}

		return {
			displayName,
			key,
			index: getFiberID(fiber),
		};
	};

	const getPathForElement = (id: number): Array<PathFrame> | undefined => {
		let fiber = idToFiberMap.get(id);
		if (fiber === undefined) {
			return undefined;
		}

		const keyPath: Array<PathFrame> = [];
		while (fiber !== undefined) {
			keyPath.insert(0, getPathFrame(fiber));
			fiber = fiber.return;
		}

		return keyPath;
	};

	const getBestMatchForTrackedPath = (): PathMatch | undefined => {
		const path = trackedPath;
		if (path === undefined) {
			return undefined;
		}
		if (trackedPathMatchFiber === undefined) {
			return undefined;
		}

		let fiber: Fiber | undefined = trackedPathMatchFiber;
		while (fiber !== undefined && shouldFilterFiber(fiber)) {
			fiber = fiber.return;
		}

		if (fiber === undefined) {
			return undefined;
		}

		return {
			id: getFiberID(getPrimaryFiber(fiber)),
			isFullMatch: trackedPathMatchDepth === path.size(),
		};
	};

	const setTraceUpdatesEnabled = (isEnabled: boolean): void => {
		traceUpdatesEnabled = isEnabled;
	};

	// Renderer interface

	return {
		cleanup,
		copyElementPath,
		deletePath,
		findNativeNodesForFiberID,
		flushInitialOperations,
		getBestMatchForTrackedPath,
		getDisplayNameForFiberID,
		getDisplayNameForRoot,
		getFiberIDForNative,
		getInstanceAndStyle,
		getOwnersList,
		getPathForElement,
		getProfilingData,
		handleCommitFiberRoot,
		handleCommitFiberUnmount,
		inspectElement,
		logElementToConsole,
		overrideSuspense,
		overrideValueAtPath,
		prepareViewAttributeSource,
		prepareViewElementSource,
		renamePath,
		renderer,
		setTraceUpdatesEnabled,
		setTrackedPath,
		startProfiling,
		stopProfiling,
		storeAsGlobal,
		updateComponentFilters,
	};
}
