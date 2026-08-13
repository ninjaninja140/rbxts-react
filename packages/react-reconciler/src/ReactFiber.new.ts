/**
 * Fiber creation — the module that builds every fiber node in the tree.
 *
 * Every element that flows through the reconciler is converted into a fiber by
 * one of the `createFiberFrom*` functions below. Fibers are the unit of work:
 * they hold the tag, props, lanes, and links to the rest of the tree.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiber.new.lua`.
 *
 * @module ReactFiber.new
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { console, getComponentName, invariant, ReactFeatureFlags, ReactSymbols } from '@nrbx/react-shared';
import type { ReactElement, ReactFragment, ReactFundamentalComponent, ReactPortal } from '@nrbx/react-shared';
import { isDevToolsPresent } from './ReactFiberDevToolsHook.new';
import { NoFlags, Placement, StaticMask } from './ReactFiberFlags';
import {
	resolveClassForHotReloading,
	resolveForwardRefForHotReloading,
	resolveFunctionForHotReloading,
} from './ReactFiberHotReloading.new';
import type { SuspenseInstance } from './ReactFiberHostConfig';
import { NoLanes } from './ReactFiberLane';
import type { OffscreenProps } from './ReactFiberOffscreenComponent';
import { BlockingRoot, ConcurrentRoot } from './ReactRootTags';
import type { RootTag } from './ReactRootTags';
import { BlockingMode, ConcurrentMode, DebugTracingMode, NoMode, ProfileMode, StrictMode } from './ReactTypeOfMode';
import type { TypeOfMode } from './ReactTypeOfMode';
import {
	ClassComponent,
	ContextConsumer,
	ContextProvider,
	DehydratedFragment,
	ForwardRef,
	Fragment,
	FunctionComponent,
	FundamentalComponent,
	HostComponent,
	HostPortal,
	HostRoot,
	HostText,
	IndeterminateComponent,
	LazyComponent,
	LegacyHiddenComponent,
	MemoComponent,
	Mode,
	OffscreenComponent,
	Profiler,
	SimpleMemoComponent,
	SuspenseComponent,
	SuspenseListComponent,
} from './ReactWorkTags';
import type { WorkTag } from './ReactWorkTags';
import type { Fiber, Lanes, RoactStableKey } from './types';

// Symbol constants pulled out of the shared symbol table once, so the hot path
// doesn't keep re-indexing the namespace object.
const {
	REACT_CONTEXT_TYPE,
	REACT_DEBUG_TRACING_MODE_TYPE,
	REACT_ELEMENT_TYPE,
	REACT_FORWARD_REF_TYPE,
	REACT_FRAGMENT_TYPE,
	REACT_LAZY_TYPE,
	REACT_LEGACY_HIDDEN_TYPE,
	REACT_MEMO_TYPE,
	REACT_OFFSCREEN_TYPE,
	REACT_PROFILER_TYPE,
	REACT_PROVIDER_TYPE,
	REACT_STRICT_MODE_TYPE,
	REACT_SUSPENSE_LIST_TYPE,
	REACT_SUSPENSE_TYPE,
} = ReactSymbols;

const { enableProfilerTimer } = ReactFeatureFlags;

// DEV-only counter that gives every fiber a stable, monotonically increasing id.
// Only populated when `__DEV__` is enabled; production fibers never see these.
let debugCounter = 1;

/**
 * Returns `true` when `value` is an empty table.
 *
 * Luau has no `Object.keys`, so this uses `next`, which returns `nil` on its
 * first call when the table has no entries.
 */
function isEmptyTable(value: object): boolean {
	if (type(value) !== 'table') {
		return false;
	}
	const [firstKey] = next(value);
	return firstKey === undefined;
}

/**
 * Returns `true` when `value` is a Lua array (a table whose keys are all
 * contiguous integers starting at 1, or an empty table).
 *
 * Luau has no `Array.isArray`; this mirrors the helper used elsewhere in the
 * runtime by inspecting the first key.
 */
function isArray(value: unknown): boolean {
	if (type(value) !== 'table') {
		return false;
	}
	const [firstKey] = next(value as object);
	return firstKey === undefined || type(firstKey) === 'number';
}

/**
 * Produces a readable, one-line representation of `value` for DEV error
 * messages. Prefers `HttpService:JSONEncode` when possible and falls back to a
 * shallow key/value dump when the table can't be encoded.
 */
function inspect(value: unknown): string {
	if (type(value) !== 'table') {
		return tostring(value);
	}
	const [ok, encoded] = pcall(() => game.GetService('HttpService').JSONEncode(value));
	if (ok) {
		return encoded;
	}
	const parts: string[] = [];
	for (const [key, v] of pairs(value as object)) {
		parts.push(`${tostring(key)} = ${tostring(v)}`);
	}
	return `{${parts.join(', ')}}`;
}

/**
 * Allocates a fresh fiber in a single table write.
 *
 * The upstream `FiberNode` constructor has been inlined here so the table is
 * created in one shot, avoiding the rehashing that would happen if every field
 * were assigned individually on the hot path. Fields that start out `nil` are
 * intentionally left off the table — they read back as `undefined` anyway.
 */
function createFiber(
	tag: WorkTag,
	pendingProps: any,
	key: RoactStableKey | undefined,
	mode: TypeOfMode,
	elementType?: any,
	type_?: any,
	stateNode?: any,
	lanes?: Lanes
): Fiber {
	// One-shot table so the reconciler doesn't pay rehash costs while building
	// the tree. Nil fields (return_, child, sibling, ref, memoizedProps, ...)
	// are omitted; they default to undefined on a fresh table.
	const node = {
		// Instance
		tag,
		key,
		elementType,
		type: type_,
		stateNode,

		// Fiber
		index: 1,

		pendingProps,
		mode,

		// Effects
		flags: NoFlags,
		subtreeFlags: NoFlags,

		lanes: lanes !== undefined ? lanes : NoLanes,
		childLanes: NoLanes,
	} as unknown as Fiber;

	if (enableProfilerTimer) {
		node.actualDuration = 0;
		node.actualStartTime = -1;
		node.selfBaseDuration = 0;
		node.treeBaseDuration = 0;
	}

	if (__DEV__) {
		// Handy for debugging internals. The remaining DEV fields
		// (_debugSource, _debugOwner, _debugHookTypes) stay unset until
		// callers fill them in.
		node._debugID = debugCounter;
		debugCounter += 1;
		node._debugNeedsRemount = false;
	}

	return node;
}

// Inlined from upstream `shouldConstruct` (which is dead code in the Lua
// runtime). Function components are always simple in this runtime because they
// can't carry `defaultProps`.
function isSimpleFunctionComponent(type_: any): boolean {
	return type(type_) === 'function';
}

/**
 * Determines the work tag for the resolved value behind a `lazy()` component.
 */
function resolveLazyComponentTag(Component: Record<string, unknown>): WorkTag {
	const typeofComponent = typeOf(Component);
	if (typeofComponent === 'function') {
		return FunctionComponent;
	}

	if (typeofComponent === 'table') {
		if (Component.isReactComponent) {
			return ClassComponent;
		}
		const __typeof = Component.$$typeof;
		if (__typeof === REACT_FORWARD_REF_TYPE) {
			return ForwardRef;
		}
		if (__typeof === REACT_MEMO_TYPE) {
			return MemoComponent;
		}
	}

	return IndeterminateComponent;
}

/**
 * Creates an alternate fiber to do work on, reusing `current.alternate` when it
 * already exists and otherwise allocating a fresh fiber. This is the double
 * buffering pooling technique the reconciler uses to keep at most two versions
 * of any given tree around.
 */
function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
	let workInProgress = current.alternate;
	if (workInProgress === undefined) {
		// Lazily allocate the alternate so components that never update don't
		// pay for an extra object.
		workInProgress = createFiber(
			current.tag,
			pendingProps,
			current.key,
			current.mode,
			current.elementType,
			current.type,
			current.stateNode
		);

		if (__DEV__) {
			// DEV-only fields
			workInProgress._debugID = current._debugID;
			workInProgress._debugSource = current._debugSource;
			workInProgress._debugOwner = current._debugOwner;
			workInProgress._debugHookTypes = current._debugHookTypes;
		}

		workInProgress.alternate = current;
		current.alternate = workInProgress;
	} else {
		workInProgress.pendingProps = pendingProps;
		// Needed because Blocks store data on type.
		workInProgress.type = current.type;

		// We already have an alternate. Reset the effect tag.
		workInProgress.flags = NoFlags;

		// The current effects are no longer valid.
		workInProgress.subtreeFlags = NoFlags;
		workInProgress.deletions = undefined;

		if (enableProfilerTimer) {
			// Reset (rather than copy) so time doesn't endlessly accumulate in
			// new commits.
			workInProgress.actualDuration = 0;
			workInProgress.actualStartTime = -1;
		}
	}

	// Reset all effects except static ones. Static effects are not specific to
	// a render.
	workInProgress.flags = bit32.band(current.flags, StaticMask);
	workInProgress.childLanes = current.childLanes;
	workInProgress.lanes = current.lanes;

	workInProgress.child = current.child;
	workInProgress.memoizedProps = current.memoizedProps;
	workInProgress.memoizedState = current.memoizedState;
	workInProgress.updateQueue = current.updateQueue;

	// Clone the dependencies object. This is mutated during the render phase,
	// so it cannot be shared with the current fiber.
	const currentDependencies = current.dependencies;
	if (currentDependencies === undefined) {
		workInProgress.dependencies = undefined;
	} else {
		workInProgress.dependencies = {
			lanes: currentDependencies.lanes,
			firstContext: currentDependencies.firstContext,
		};
	}

	// These will be overridden during the parent's reconciliation.
	workInProgress.sibling = current.sibling;
	workInProgress.index = current.index;
	workInProgress.ref = current.ref;

	if (enableProfilerTimer) {
		workInProgress.selfBaseDuration = current.selfBaseDuration;
		workInProgress.treeBaseDuration = current.treeBaseDuration;
	}

	if (__DEV__) {
		workInProgress._debugNeedsRemount = current._debugNeedsRemount;
		if (
			workInProgress.tag === IndeterminateComponent ||
			workInProgress.tag === FunctionComponent ||
			workInProgress.tag === SimpleMemoComponent
		) {
			workInProgress.type = resolveFunctionForHotReloading(current.type);
		} else if (workInProgress.tag === ClassComponent) {
			workInProgress.type = resolveClassForHotReloading(current.type);
		} else if (workInProgress.tag === ForwardRef) {
			workInProgress.type = resolveForwardRefForHotReloading(current.type);
		}
	}

	return workInProgress;
}

/**
 * Reuses a fiber for a second pass, resetting it to the values that
 * `createFiber` or `createWorkInProgress` would have left it with before the
 * first pass ran.
 */
function resetWorkInProgress(workInProgress: Fiber, renderLanes: Lanes): Fiber {
	// Reset the effect tag but keep any Placement tags, since that's something
	// a child fiber sets, not the reconciliation.
	workInProgress.flags = bit32.band(workInProgress.flags, bit32.bor(StaticMask, Placement));

	// The effects are no longer valid.
	const current = workInProgress.alternate;
	if (current === undefined) {
		// Reset to createFiber's initial values.
		workInProgress.childLanes = NoLanes;
		workInProgress.lanes = renderLanes;

		workInProgress.child = undefined;
		workInProgress.subtreeFlags = NoFlags;
		workInProgress.memoizedProps = undefined;
		workInProgress.memoizedState = undefined;
		workInProgress.updateQueue = undefined;

		workInProgress.dependencies = undefined;

		workInProgress.stateNode = undefined;

		if (enableProfilerTimer) {
			// Don't reset the actualTime counts — it's useful to accumulate
			// actual time across multiple render passes.
			workInProgress.selfBaseDuration = 0;
			workInProgress.treeBaseDuration = 0;
		}
	} else {
		// Reset to the cloned values that createWorkInProgress would've set.
		workInProgress.childLanes = current.childLanes;
		workInProgress.lanes = current.lanes;

		workInProgress.child = current.child;
		workInProgress.subtreeFlags = current.subtreeFlags;
		workInProgress.deletions = undefined;
		workInProgress.memoizedProps = current.memoizedProps;
		workInProgress.memoizedState = current.memoizedState;
		workInProgress.updateQueue = current.updateQueue;
		// Needed because Blocks store data on type.
		workInProgress.type = current.type;

		// Clone the dependencies object for the same reason as above.
		const currentDependencies = current.dependencies;
		if (currentDependencies === undefined) {
			workInProgress.dependencies = undefined;
		} else {
			workInProgress.dependencies = {
				lanes: currentDependencies.lanes,
				firstContext: currentDependencies.firstContext,
			};
		}

		if (enableProfilerTimer) {
			workInProgress.selfBaseDuration = current.selfBaseDuration;
			workInProgress.treeBaseDuration = current.treeBaseDuration;
		}
	}

	return workInProgress;
}

/**
 * Creates the root fiber for a new React root, deriving its mode from the root
 * tag. Profiler timing is enabled automatically whenever DevTools are present.
 */
function createHostRootFiber(tag: RootTag): Fiber {
	let mode: TypeOfMode;
	if (tag === ConcurrentRoot) {
		mode = bit32.bor(ConcurrentMode, BlockingMode, StrictMode);
	} else if (tag === BlockingRoot) {
		mode = bit32.bor(BlockingMode, StrictMode);
	} else {
		mode = NoMode;
	}

	// `isDevToolsPresent` is a function so the hook can change at runtime.
	if (enableProfilerTimer && isDevToolsPresent()) {
		// Always collect profile timings when DevTools are present, so DevTools
		// can start capturing timing at any point without some nodes missing
		// base times.
		mode = bit32.bor(mode, ProfileMode);
	}

	return createFiber(HostRoot, undefined, undefined, mode);
}

/**
 * Builds a fiber from an element type and its pending props, resolving the
 * appropriate work tag along the way (host component, function component,
 * class component, context provider/consumer, memo, forward ref, lazy, and the
 * special symbol types).
 */
function createFiberFromTypeAndProps(
	type_: unknown, // React$ElementType
	key: RoactStableKey | undefined,
	pendingProps: any,
	owner: Fiber | undefined,
	mode: TypeOfMode,
	lanes: Lanes
): Fiber {
	let fiberTag: WorkTag = IndeterminateComponent;
	// The resolved type is set if we know what the final type will be. I.e.
	// it's not lazy.
	let resolvedType: any = type_;
	const typeOfType_ = type(type_);
	// Class components in this runtime are tables, not functions, so we have
	// to look for them explicitly (this inlines `shouldConstruct`).
	if (typeOfType_ === 'function') {
		if (__DEV__) {
			resolvedType = resolveFunctionForHotReloading(resolvedType);
		}
	} else if (typeOfType_ === 'table' && (type_ as Record<string, unknown>).isReactComponent) {
		fiberTag = ClassComponent;
		if (__DEV__) {
			resolvedType = resolveClassForHotReloading(resolvedType);
		}
	} else if (typeOfType_ === 'string') {
		fiberTag = HostComponent;
	} else {
		if (type_ === REACT_FRAGMENT_TYPE) {
			return createFiberFromFragment(
				(pendingProps as Record<string, unknown>).children as ReactFragment,
				mode,
				lanes,
				key
			);
		} else if (type_ === REACT_DEBUG_TRACING_MODE_TYPE) {
			fiberTag = Mode;
			mode = bit32.bor(mode, DebugTracingMode);
		} else if (type_ === REACT_STRICT_MODE_TYPE) {
			fiberTag = Mode;
			mode = bit32.bor(mode, StrictMode);
		} else if (type_ === REACT_PROFILER_TYPE) {
			return createFiberFromProfiler(pendingProps, mode, lanes, key);
		} else if (type_ === REACT_SUSPENSE_TYPE) {
			return createFiberFromSuspense(pendingProps, mode, lanes, key);
		} else if (type_ === REACT_OFFSCREEN_TYPE) {
			return createFiberFromOffscreen(pendingProps, mode, lanes, key);
		} else if (type_ === REACT_LEGACY_HIDDEN_TYPE) {
			return createFiberFromLegacyHidden(pendingProps, mode, lanes, key);
		} else {
			let shouldBreak = false;
			let type_typeof: number | undefined;
			if (typeOfType_ === 'table') {
				type_typeof = (type_ as Record<string, unknown>).$$typeof as number | undefined;
				if (type_typeof === REACT_PROVIDER_TYPE) {
					fiberTag = ContextProvider;
					shouldBreak = true;
				} else if (type_typeof === REACT_CONTEXT_TYPE) {
					// This is a consumer.
					fiberTag = ContextConsumer;
					shouldBreak = true;
				} else if (type_typeof === REACT_FORWARD_REF_TYPE) {
					fiberTag = ForwardRef;
					if (__DEV__) {
						resolvedType = resolveForwardRefForHotReloading(resolvedType);
					}
					shouldBreak = true;
				} else if (type_typeof === REACT_MEMO_TYPE) {
					fiberTag = MemoComponent;
					shouldBreak = true;
				} else if (type_typeof === REACT_LAZY_TYPE) {
					fiberTag = LazyComponent;
					resolvedType = undefined;
					shouldBreak = true;
				}
			}
			if (!shouldBreak) {
				let info = '';
				if (__DEV__) {
					if (type_ === undefined || (typeOfType_ === 'table' && isEmptyTable(type_ as object))) {
						info +=
							' You likely forgot to export your component from the file ' +
							"it's defined in, or you might have mixed up default and " +
							'named imports.';
					} else if (type_ !== undefined && typeOfType_ === 'table') {
						// Print the table in readable form to give a clue when no
						// other info was gathered.
						info += `\n${inspect(type_)}`;
					}
					const ownerName = owner !== undefined ? getComponentName(owner.type) : undefined;
					if (ownerName !== undefined && ownerName !== '') {
						info += `\n\nCheck the render method of \`${ownerName}\`.`;
					} else if (owner !== undefined) {
						// Print the raw owner table as a last-resort clue.
						info += `\n${inspect(owner)}`;
					}
				}

				let typeString: string;
				if (type_ === undefined) {
					typeString = 'nil';
				} else if (isArray(type_)) {
					typeString = 'array';
				} else if (typeOfType_ === 'table' && type_typeof === REACT_ELEMENT_TYPE) {
					typeString = string.format(
						'<%s />',
						getComponentName((type_ as Record<string, unknown>).type) ?? 'Unknown'
					);
					info = ' Did you accidentally export a JSX literal or Element instead of a component?';
				} else {
					typeString = typeOfType_;
				}

				invariant(
					false,
					'Element type is invalid: expected a string (for built-in ' +
						'components) or a class/function (for composite components) ' +
						'but got: %s.%s',
					typeString,
					info
				);
			}
		}
	}

	const fiber = createFiber(fiberTag, pendingProps, key, mode, type_, resolvedType, undefined, lanes);

	if (__DEV__) {
		fiber._debugOwner = owner;
	}

	return fiber;
}

/**
 * Builds a fiber from an already-created element, pulling its owner, key, and
 * props out of the element record.
 */
function createFiberFromElement(element: ReactElement, mode: TypeOfMode, lanes: Lanes): Fiber {
	let owner: Fiber | undefined;
	if (__DEV__) {
		owner = element._owner;
	}
	const elementType = element.type;
	const key = element.key;
	const pendingProps = element.props;
	const fiber = createFiberFromTypeAndProps(elementType, key, pendingProps, owner, mode, lanes);
	if (__DEV__) {
		fiber._debugSource = element._source;
		fiber._debugOwner = element._owner;
	}
	return fiber;
}

/**
 * Creates a fragment fiber whose pending props are the fragment children.
 */
function createFiberFromFragment(
	elements: ReactFragment,
	mode: TypeOfMode,
	lanes: Lanes,
	key: RoactStableKey | undefined
): Fiber {
	return createFiber(Fragment, elements, key, mode, undefined, undefined, undefined, lanes);
}

/**
 * Creates a fundamental component fiber. (The fundamental API is not currently
 * wired up in this runtime, but the fiber factory is kept for parity.)
 */
function createFiberFromFundamental(
	fundamentalComponent: ReactFundamentalComponent<any, any>,
	pendingProps: any,
	mode: TypeOfMode,
	lanes: Lanes,
	key: RoactStableKey | undefined
): Fiber {
	return createFiber(
		FundamentalComponent,
		pendingProps,
		key,
		mode,
		fundamentalComponent,
		fundamentalComponent,
		undefined,
		lanes
	);
}

function createFiberFromProfiler(
	pendingProps: any,
	mode: TypeOfMode,
	lanes: Lanes,
	key: RoactStableKey | undefined
): Fiber {
	if (__DEV__) {
		if (typeOf((pendingProps as Record<string, unknown>).id) !== 'string') {
			console.error('Profiler must specify an "id" as a prop');
		}
	}

	return createFiber(
		Profiler,
		pendingProps,
		key,
		bit32.bor(mode, ProfileMode),
		REACT_PROFILER_TYPE,
		REACT_PROFILER_TYPE,
		enableProfilerTimer ? { effectDuration: 0, passiveEffectDuration: 0 } : undefined,
		lanes
	);
}

/**
 * Creates a Suspense boundary fiber.
 */
function createFiberFromSuspense(
	pendingProps: any,
	mode: TypeOfMode,
	lanes: Lanes,
	key: RoactStableKey | undefined
): Fiber {
	return createFiber(
		SuspenseComponent,
		pendingProps,
		key,
		mode,
		REACT_SUSPENSE_TYPE,
		REACT_SUSPENSE_TYPE,
		undefined,
		lanes
	);
}

/**
 * Creates a SuspenseList fiber.
 */
function createFiberFromSuspenseList(
	pendingProps: any,
	mode: TypeOfMode,
	lanes: Lanes,
	key: RoactStableKey | undefined
): Fiber {
	return createFiber(
		SuspenseListComponent,
		pendingProps,
		key,
		mode,
		REACT_SUSPENSE_LIST_TYPE,
		__DEV__ ? REACT_SUSPENSE_LIST_TYPE : undefined,
		undefined,
		lanes
	);
}

/**
 * Creates an offscreen fiber (used by `Activity` / hidden subtrees).
 */
function createFiberFromOffscreen(
	pendingProps: OffscreenProps,
	mode: TypeOfMode,
	lanes: Lanes,
	key: RoactStableKey | undefined
): Fiber {
	return createFiber(
		OffscreenComponent,
		pendingProps,
		key,
		mode,
		REACT_OFFSCREEN_TYPE,
		__DEV__ ? REACT_OFFSCREEN_TYPE : undefined,
		undefined,
		lanes
	);
}

/**
 * Creates a legacy hidden fiber (the pre-Offscreen hidden subtree).
 */
function createFiberFromLegacyHidden(
	pendingProps: OffscreenProps,
	mode: TypeOfMode,
	lanes: Lanes,
	key: RoactStableKey | undefined
): Fiber {
	return createFiber(
		LegacyHiddenComponent,
		pendingProps,
		key,
		mode,
		REACT_LEGACY_HIDDEN_TYPE,
		__DEV__ ? REACT_LEGACY_HIDDEN_TYPE : undefined,
		undefined,
		lanes
	);
}

/**
 * Creates a text fiber for a string child.
 */
function createFiberFromText(content: string, mode: TypeOfMode, lanes: Lanes): Fiber {
	return createFiber(HostText, content, undefined, mode, undefined, undefined, undefined, lanes);
}

/**
 * Creates a placeholder fiber used when a host instance is pending deletion.
 */
function createFiberFromHostInstanceForDeletion(): Fiber {
	return createFiber(HostComponent, undefined, undefined, NoMode, 'DELETED', 'DELETED');
}

/**
 * Creates a dehydrated fragment fiber for a server-rendered (suspense
 * hydration) node.
 */
function createFiberFromDehydratedFragment(dehydratedNode: SuspenseInstance): Fiber {
	return createFiber(DehydratedFragment, undefined, undefined, NoMode, undefined, undefined, dehydratedNode);
}

/**
 * Creates a portal fiber. The portal's children become the pending props and
 * the state node carries the container/implementation info.
 */
function createFiberFromPortal(portal: ReactPortal, mode: TypeOfMode, lanes: Lanes): Fiber {
	const pendingProps: any = portal.children !== undefined ? portal.children : {};
	return createFiber(
		HostPortal,
		pendingProps,
		portal.key,
		mode,
		undefined,
		undefined,
		{
			containerInfo: portal.containerInfo,
			pendingChildren: undefined, // Used by persistent updates
			implementation: portal.implementation,
		},
		lanes
	);
}

/**
 * Stashes WIP properties to replay failed work in DEV. Written as an explicit
 * list of every property because the hot path can't afford `Object.assign`.
 */
function assignFiberPropertiesInDEV(target: Fiber | undefined, source: Fiber): Fiber {
	if (target === undefined) {
		// This fiber's initial properties will always be overwritten. We only
		// use a fiber to ensure the same hidden class so DEV isn't slow.
		target = createFiber(IndeterminateComponent, undefined, undefined, NoMode);
	}

	target.tag = source.tag;
	target.key = source.key;
	target.elementType = source.elementType;
	target.type = source.type;
	target.stateNode = source.stateNode;
	target.return_ = source.return_;
	target.child = source.child;
	target.sibling = source.sibling;
	target.index = source.index;
	target.ref = source.ref;
	target.pendingProps = source.pendingProps;
	target.memoizedProps = source.memoizedProps;
	target.updateQueue = source.updateQueue;
	target.memoizedState = source.memoizedState;
	target.dependencies = source.dependencies;
	target.mode = source.mode;
	target.flags = source.flags;
	target.subtreeFlags = source.subtreeFlags;
	target.deletions = source.deletions;
	target.lanes = source.lanes;
	target.childLanes = source.childLanes;
	target.alternate = source.alternate;
	if (enableProfilerTimer) {
		target.actualDuration = source.actualDuration;
		target.actualStartTime = source.actualStartTime;
		target.selfBaseDuration = source.selfBaseDuration;
		target.treeBaseDuration = source.treeBaseDuration;
	}
	target._debugID = source._debugID;
	target._debugSource = source._debugSource;
	target._debugOwner = source._debugOwner;
	target._debugNeedsRemount = source._debugNeedsRemount;
	target._debugHookTypes = source._debugHookTypes;
	return target;
}

// Deviation from upstream: export the entire interface at the end rather than
// scattering `export` modifiers throughout the file. This mirrors the single
// return table in the Lua source.
export {
	isSimpleFunctionComponent,
	resolveLazyComponentTag,
	isArray,
	createWorkInProgress,
	resetWorkInProgress,
	createHostRootFiber,
	createFiberFromTypeAndProps,
	createFiberFromElement,
	createFiberFromFragment,
	createFiberFromFundamental,
	createFiberFromSuspense,
	createFiberFromSuspenseList,
	createFiberFromOffscreen,
	createFiberFromLegacyHidden,
	createFiberFromText,
	createFiberFromHostInstanceForDeletion,
	createFiberFromDehydratedFragment,
	createFiberFromPortal,
	assignFiberPropertiesInDEV,
};

export default {
	isSimpleFunctionComponent,
	resolveLazyComponentTag,
	isArray,
	createWorkInProgress,
	resetWorkInProgress,
	createHostRootFiber,
	createFiberFromTypeAndProps,
	createFiberFromElement,
	createFiberFromFragment,
	createFiberFromFundamental,
	createFiberFromSuspense,
	createFiberFromSuspenseList,
	createFiberFromOffscreen,
	createFiberFromLegacyHidden,
	createFiberFromText,
	createFiberFromHostInstanceForDeletion,
	createFiberFromDehydratedFragment,
	createFiberFromPortal,
	assignFiberPropertiesInDEV,
};
