/**
 * Hot-reloading (Fast Refresh) support for the fiber reconciler.
 *
 * This module maintains a registry that maps component *types* to their latest
 * implementation. When the DevTools hook swaps a module's exports, the
 * reconciler uses the registry to decide which fibers can keep their state and
 * simply re-render, and which must be remounted.
 *
 * The WorkLoop, Reconciler, and Context modules are imported as namespaces and
 * only accessed inside function bodies. That mirrors the upstream lazy
 * `require()` calls: the fiber tree forms a require cycle through this module,
 * and deferring member access keeps the runtime from capturing `nil` while a
 * module is still mid-load.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberHotReloading.new.lua`.
 *
 * @module ReactFiberHotReloading
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { ReactSymbols } from '@nrbx/react-shared';
import type { ReactElement, ReactNodeList } from '@nrbx/react-shared';

import { SyncLane, NoTimestamp } from './ReactFiberLane';
import type { Instance } from './ReactFiberHostConfig';
import * as ReactFiberWorkLoop from './ReactFiberWorkLoop.new';
import * as ReactFiberReconciler from './ReactFiberReconciler';
import * as ReactFiberContext from './ReactFiberContext.new';
import {
	ClassComponent,
	ForwardRef,
	FunctionComponent,
	HostComponent,
	HostPortal,
	HostRoot,
	MemoComponent,
	SimpleMemoComponent,
} from './ReactWorkTags';
import type { Fiber, FiberRoot } from './types';

// Symbol constants pulled out once so the hot path avoids re-indexing the
// shared symbol table.
const { REACT_FORWARD_REF_TYPE, REACT_LAZY_TYPE, REACT_MEMO_TYPE } = ReactSymbols;

/** A family tracks the latest implementation of a hot-reloadable type. */
export interface Family {
	current: any;
}

/** Families that were invalidated and/or refreshed by a hot reload. */
export interface RefreshUpdate {
	staleFamilies: Set<Family>;
	updatedFamilies: Set<Family>;
}

/** Resolves a type to its registered family, if any. */
type RefreshHandler = (type: any) => Family | undefined;

let resolveFamily: RefreshHandler | undefined;
// ROBLOX deviation: a plain Set is used until a WeakSet polyfill is added.
let failedBoundaries: Set<Fiber> | undefined;

export function setRefreshHandler(handler: RefreshHandler | undefined): void {
	if (__DEV__) {
		resolveFamily = handler;
	}
}

export function resolveFunctionForHotReloading(type_: any): any {
	if (__DEV__) {
		if (resolveFamily === undefined) {
			// Hot reloading is disabled.
			return type_;
		}
		const family = resolveFamily(type_);
		if (family === undefined) {
			return type_;
		}
		// Use the latest known implementation.
		return family.current;
	}
	return type_;
}

export function resolveClassForHotReloading(type_: any): any {
	// No implementation differences.
	return resolveFunctionForHotReloading(type_);
}

export function resolveForwardRefForHotReloading(type_: any): any {
	if (__DEV__) {
		if (resolveFamily === undefined) {
			// Hot reloading is disabled.
			return type_;
		}
		const family = resolveFamily(type_);
		if (family === undefined) {
			// Check if we're dealing with a real forwardRef. Don't want to crash early.
			const t = type_ as Record<string, unknown> | undefined;
			if (t !== undefined && typeOf(t.render) === 'function') {
				// ForwardRef is special because its resolved .type is an object,
				// but it's possible that we only have its inner render function in
				// the map. If that inner render function is different, we'll build
				// a new forwardRef type.
				const currentRender = resolveFunctionForHotReloading(t.render);
				if (t.render !== (currentRender as unknown)) {
					const syntheticType: Record<string, unknown> = {
						$$typeof: REACT_FORWARD_REF_TYPE,
						render: currentRender,
					};
					if (t.displayName !== undefined) {
						syntheticType.displayName = t.displayName;
					}
					return syntheticType;
				}
			}
			return type_;
		}
		// Use the latest known implementation.
		return family.current;
	}
	return type_;
}

export function isCompatibleFamilyForHotReloading(fiber: Fiber, element: ReactElement): boolean {
	if (__DEV__) {
		if (resolveFamily === undefined) {
			// Hot reloading is disabled.
			return false;
		}

		const prevType = fiber.elementType;
		const nextType = element.type as unknown as defined | undefined;

		// If we got here, we know types aren't === equal.
		let needsCompareFamilies = false;

		const __typeofNextType =
			typeOf(nextType) === 'table' && nextType !== undefined
				? (nextType as Record<string, unknown>).$$typeof
				: undefined;

		const tag = fiber.tag;
		if (tag === ClassComponent) {
			if (typeOf(nextType) === 'function') {
				needsCompareFamilies = true;
			}
		} else if (tag === FunctionComponent) {
			if (typeOf(nextType) === 'function') {
				needsCompareFamilies = true;
			} else if (__typeofNextType === REACT_LAZY_TYPE) {
				// We don't know the inner type yet. We're going to assume that the
				// lazy inner type is stable, and so it is sufficient to avoid
				// reconciling it away. We're not going to unwrap or actually use the
				// new lazy type.
				needsCompareFamilies = true;
			}
		} else if (tag === ForwardRef) {
			if (__typeofNextType === REACT_FORWARD_REF_TYPE) {
				needsCompareFamilies = true;
			} else if (__typeofNextType === REACT_LAZY_TYPE) {
				needsCompareFamilies = true;
			}
		} else if (tag === MemoComponent || tag === SimpleMemoComponent) {
			if (__typeofNextType === REACT_MEMO_TYPE) {
				// TODO: if it was but can no longer be simple, we shouldn't set this.
				needsCompareFamilies = true;
			} else if (__typeofNextType === REACT_LAZY_TYPE) {
				needsCompareFamilies = true;
			}
		} else {
			return false;
		}

		// Check if both types have a family and it's the same one.
		if (needsCompareFamilies) {
			// Note: memo() and forwardRef() we'll compare outer rather than inner
			// type. This means both of them need to be registered to preserve
			// state. If we unwrapped and compared the inner types for wrappers
			// instead, then we would risk falsely saying two separate memo(Foo)
			// calls are equivalent because they wrap the same Foo function.
			const prevFamily = resolveFamily(prevType);
			if (prevFamily !== undefined && prevFamily === resolveFamily(nextType)) {
				return true;
			}
		}
		return false;
	}
	return false;
}

export function markFailedErrorBoundaryForHotReloading(fiber: Fiber): void {
	if (__DEV__) {
		if (resolveFamily === undefined) {
			// Hot reloading is disabled.
			return;
		}
		if (failedBoundaries === undefined) {
			failedBoundaries = new Set<Fiber>();
		}
		failedBoundaries.add(fiber);
	}
}

export function scheduleRefresh(root: FiberRoot, update: RefreshUpdate): void {
	if (__DEV__) {
		if (resolveFamily === undefined) {
			// Hot reloading is disabled.
			return;
		}
		const { staleFamilies, updatedFamilies } = update;
		ReactFiberWorkLoop.flushPassiveEffects();
		ReactFiberWorkLoop.flushSync(() => {
			scheduleFibersWithFamiliesRecursively(root.current, updatedFamilies, staleFamilies);
		}, undefined);
	}
}

export function scheduleRoot(root: FiberRoot, element: ReactNodeList): void {
	if (__DEV__) {
		if (root.context !== ReactFiberContext.emptyContextObject) {
			// Super edge case: root has a legacy _renderSubtree context but we
			// don't know the parentComponent so we can't pass it. Just ignore.
			// We'll delete this with _renderSubtree code path later.
			return;
		}
		ReactFiberWorkLoop.flushPassiveEffects();
		ReactFiberWorkLoop.flushSync(() => {
			ReactFiberReconciler.updateContainer(element, root, undefined, undefined);
		}, undefined);
	}
}

function scheduleFibersWithFamiliesRecursively(
	fiber: Fiber,
	updatedFamilies: Set<Family>,
	staleFamilies: Set<Family>
): void {
	if (__DEV__) {
		const { alternate, child, sibling, tag, type: type_ } = fiber;
		let candidateType: defined | undefined;
		if (tag === FunctionComponent || tag === SimpleMemoComponent || tag === ClassComponent) {
			candidateType = type_;
		} else if (tag === ForwardRef) {
			candidateType = (type_ as { render: defined | undefined }).render;
		}
		if (resolveFamily === undefined) {
			error('Expected resolveFamily to be set during hot reload.');
		}
		let needsRender = false;
		let needsRemount = false;
		if (candidateType !== undefined) {
			const family = resolveFamily(candidateType);
			if (family !== undefined) {
				if (staleFamilies.has(family)) {
					needsRemount = true;
				} else if (updatedFamilies.has(family)) {
					if (tag === ClassComponent) {
						needsRemount = true;
					} else {
						needsRender = true;
					}
				}
			}
		}
		if (failedBoundaries !== undefined) {
			if (failedBoundaries.has(fiber) || (alternate !== undefined && failedBoundaries.has(alternate))) {
				needsRemount = true;
			}
		}
		if (needsRemount) {
			fiber._debugNeedsRemount = true;
		}
		if (needsRemount || needsRender) {
			ReactFiberWorkLoop.scheduleUpdateOnFiber(fiber, SyncLane, NoTimestamp);
		}
		if (child !== undefined && !needsRemount) {
			scheduleFibersWithFamiliesRecursively(child, updatedFamilies, staleFamilies);
		}
		if (sibling !== undefined) {
			scheduleFibersWithFamiliesRecursively(sibling, updatedFamilies, staleFamilies);
		}
	}
}

export function findHostInstancesForRefresh(root: FiberRoot, families: Array<Family>): Set<Instance> {
	if (__DEV__) {
		const hostInstances = new Set<Instance>();
		const types = new Set<any>(families.map((family) => family.current));
		findHostInstancesForMatchingFibersRecursively(root.current, types, hostInstances);
		return hostInstances;
	}
	error('Did not expect findHostInstancesForRefresh to be called in production.');
}

function findHostInstancesForMatchingFibersRecursively(
	fiber: Fiber,
	types: Set<any>,
	hostInstances: Set<Instance>
): void {
	if (__DEV__) {
		const { child, sibling, tag, type: type_ } = fiber;
		let candidateType: defined | undefined;
		if (tag === FunctionComponent || tag === SimpleMemoComponent || tag === ClassComponent) {
			candidateType = type_;
		} else if (tag === ForwardRef) {
			candidateType = (type_ as { render: defined | undefined }).render;
		}
		let didMatch = false;
		if (candidateType !== undefined) {
			if (types.has(candidateType)) {
				didMatch = true;
			}
		}
		if (didMatch) {
			// We have a match. This only drills down to the closest host
			// components. There's no need to search deeper because for the
			// purpose of giving visual feedback, "flashing" outermost parent
			// rectangles is sufficient.
			findHostInstancesForFiberShallowly(fiber, hostInstances);
		} else {
			// If there's no match, maybe there will be one further down in the
			// child tree.
			if (child !== undefined) {
				findHostInstancesForMatchingFibersRecursively(child, types, hostInstances);
			}
		}
		if (sibling !== undefined) {
			findHostInstancesForMatchingFibersRecursively(sibling, types, hostInstances);
		}
	}
}

function findHostInstancesForFiberShallowly(fiber: Fiber, hostInstances: Set<Instance>): void {
	if (__DEV__) {
		const foundHostInstances = findChildHostInstancesForFiberShallowly(fiber, hostInstances);
		if (foundHostInstances) {
			return;
		}
		// If we didn't find any host children, fallback to closest host parent.
		let node: Fiber = fiber;
		while (true) {
			const tag = node.tag;
			if (tag === HostComponent) {
				hostInstances.add(node.stateNode as Instance);
				return;
			} else if (tag === HostPortal) {
				hostInstances.add((node.stateNode as { containerInfo: Instance }).containerInfo);
				return;
			} else if (tag === HostRoot) {
				hostInstances.add((node.stateNode as { containerInfo: Instance }).containerInfo);
				return;
			}
			if (node.return_ === undefined) {
				error('Expected to reach root first.');
			}
			node = node.return_;
		}
	}
}

function findChildHostInstancesForFiberShallowly(fiber: Fiber, hostInstances: Set<Instance>): boolean {
	if (__DEV__) {
		let node: Fiber = fiber;
		let foundHostInstances = false;
		while (true) {
			if (node.tag === HostComponent) {
				// We got a match.
				foundHostInstances = true;
				hostInstances.add(node.stateNode as Instance);
				// There may still be more, so keep searching.
			} else if (node.child !== undefined) {
				node.child.return_ = node;
				node = node.child;
				continue;
			}
			if (node === fiber) {
				return foundHostInstances;
			}
			while (node.sibling === undefined) {
				if (node.return_ === undefined || node.return_ === fiber) {
					return foundHostInstances;
				}
				node = node.return_;
			}
			// Luau control-flow: node.sibling is known non-undefined here.
			const sibling = node.sibling as Fiber;
			sibling.return_ = node.return_;
			node = sibling;
		}
	}
	return false;
}

export default {
	setRefreshHandler,
	resolveFunctionForHotReloading,
	resolveClassForHotReloading,
	resolveForwardRefForHotReloading,
	isCompatibleFamilyForHotReloading,
	markFailedErrorBoundaryForHotReloading,
	scheduleRefresh,
	scheduleRoot,
	findHostInstancesForRefresh,
};
