/**
 * Helpers for reflecting over the fiber tree: determining whether a fiber is
 * mounted, resolving the "current" fiber of an alternating pair, and drilling
 * down to the nearest host component/text from an arbitrary parent.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberTreeReflection.lua`.
 *
 * @module ReactFiberTreeReflection
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import {
	console,
	getComponentName,
	invariant,
	ReactFeatureFlags,
	ReactInstanceMap,
	ReactSharedInternals,
} from '@nrbx/react-shared';
import type { SuspenseState } from './ReactFiberSuspenseComponent.new';
import type { Container, SuspenseInstance } from './ReactFiberHostConfig';
import { Hydrating, NoFlags, Placement } from './ReactFiberFlags';
import {
	ClassComponent,
	FundamentalComponent,
	HostComponent,
	HostPortal,
	HostRoot,
	HostText,
	SuspenseComponent,
} from './ReactWorkTags';
import type { Fiber } from './types';

const enableFundamentalAPI = ReactFeatureFlags.enableFundamentalAPI;

const ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;

/**
 * Finds the nearest mounted fiber at or above the given fiber.
 *
 * @internal
 */
export function getNearestMountedFiber(fiber: Fiber): Fiber | undefined {
	let node = fiber;
	let nearestMounted: Fiber | undefined = fiber;
	if (!fiber.alternate) {
		// If there is no alternate, this might be a new tree that isn't inserted
		// yet. If it is, then it will have a pending insertion effect on it.
		let nextNode: Fiber | undefined = node;
		do {
			node = nextNode as Fiber;
			if (bit32.band(node.flags, bit32.bor(Placement, Hydrating)) !== NoFlags) {
				// This is an insertion or in-progress hydration. The nearest possible
				// mounted fiber is the parent but we need to continue to figure out
				// if that one is still mounted.
				nearestMounted = node.return_;
			}
			nextNode = node.return_;
		} while (nextNode !== undefined);
	} else {
		while (node.return_) {
			node = node.return_;
		}
	}
	if (node.tag === HostRoot) {
		// TODO: Check if this was a nested HostRoot when used with
		// renderContainerIntoSubtree.
		return nearestMounted;
	}
	// If we didn't hit the root, that means that we're in a disconnected tree
	// that has been unmounted.
	return undefined;
}

/**
 * If the given fiber is a Suspense boundary, returns the dehydrated
 * SuspenseInstance it is blocked on (if any).
 *
 * @internal
 */
export function getSuspenseInstanceFromFiber(fiber: Fiber): SuspenseInstance | undefined {
	if (fiber.tag === SuspenseComponent) {
		let suspenseState: SuspenseState | undefined = fiber.memoizedState as SuspenseState | undefined;
		if (suspenseState === undefined) {
			const current = fiber.alternate;
			if (current !== undefined) {
				suspenseState = current.memoizedState as SuspenseState | undefined;
			}
		}
		if (suspenseState) {
			return suspenseState.dehydrated;
		}
	}
	return undefined;
}

/**
 * Returns the container info for a HostRoot fiber, if the fiber is one.
 *
 * @internal
 */
export function getContainerFromFiber(fiber: Fiber): Container | undefined {
	return fiber.tag === HostRoot ? (fiber.stateNode as { containerInfo: Container }).containerInfo : undefined;
}

/**
 * Whether the given fiber is the nearest mounted fiber for its own subtree.
 *
 * @internal
 */
export function isFiberMounted(fiber: Fiber): boolean {
	return getNearestMountedFiber(fiber) === fiber;
}

/**
 * Whether a public component instance is currently mounted.
 *
 * @internal
 */
export function isMounted(component: Record<string, unknown>): boolean {
	if (__DEV__) {
		const owner = ReactCurrentOwner.current as Fiber | undefined;
		if (owner !== undefined && owner.tag === ClassComponent) {
			const ownerFiber: Fiber = owner;
			const instance = ownerFiber.stateNode as { _warnedAboutRefsInRender?: boolean };
			if (!instance._warnedAboutRefsInRender) {
				console.error(
					'%s is accessing isMounted inside its render() function. ' +
						'render() should be a pure function of props and state. It should ' +
						'never access something that requires stale data from the previous ' +
						'render, such as refs. Move this logic to componentDidMount and ' +
						'componentDidUpdate instead.',
					getComponentName(ownerFiber.type) ?? 'A component'
				);
			}
			instance._warnedAboutRefsInRender = true;
		}
	}

	const fiber = ReactInstanceMap.get(component) as Fiber;
	if (!fiber) {
		return false;
	}
	return getNearestMountedFiber(fiber) === fiber;
}

function assertIsMounted(fiber: Fiber): void {
	invariant(getNearestMountedFiber(fiber) === fiber, 'Unable to find node on an unmounted component.');
}

/**
 * Resolves the current fiber from a possibly-alternate work-in-progress fiber
 * by walking both branches back to the root.
 *
 * @internal
 */
export function findCurrentFiberUsingSlowPath(fiber: Fiber): Fiber | undefined {
	const alternate = fiber.alternate;
	if (!alternate) {
		// If there is no alternate, then we only need to check if it is mounted.
		const nearestMounted = getNearestMountedFiber(fiber);
		invariant(nearestMounted !== undefined, 'Unable to find node on an unmounted component.');
		if (nearestMounted !== fiber) {
			return undefined;
		}
		return fiber;
	}
	// If we have two possible branches, we'll walk backwards up to the root
	// to see what path the root points to. On the way we may hit one of the
	// special cases and we'll deal with them.
	let a: Fiber = fiber;
	let b: Fiber = alternate;
	while (true) {
		const parentA = a.return_;
		if (parentA === undefined) {
			// We're at the root.
			break;
		}
		const parentB = parentA.alternate;
		if (parentB === undefined) {
			// There is no alternate. This is an unusual case. Currently, it only
			// happens when a Suspense component is hidden. An extra fragment fiber
			// is inserted in between the Suspense fiber and its children. Skip
			// over this extra fragment fiber and proceed to the next parent.
			const nextParent = parentA.return_;
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
			while (child) {
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
			// We should never have an alternate for any mounting node. So the only
			// way this could possibly happen is if this was unmounted, if at all.
			invariant(false, 'Unable to find node on an unmounted component.');
		}

		if (a.return_ !== b.return_) {
			// The return pointer of A and the return pointer of B point to different
			// fibers. We assume that return pointers never criss-cross, so A must
			// belong to the child set of A.return, and B must belong to the child
			// set of B.return.
			a = parentA;
			b = parentB;
		} else {
			// The return pointers point to the same fiber. We'll have to use the
			// default, slow path: scan the child sets of each parent alternate to
			// see which child belongs to which set.
			//
			// Search parent A's child set
			let didFindChild = false;
			let child = parentA.child;
			while (child) {
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
				// Search parent B's child set
				child = parentB.child;
				while (child) {
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
					'Child was not found in either parent set. This indicates a bug ' +
						'in React related to the return pointer. Please file an issue.'
				);
			}
		}

		invariant(
			a.alternate === b,
			"Return fibers should always be each others' alternates. " +
				'This error is likely caused by a bug in React. Please file an issue.'
		);
	}
	// If the root is not a host container, we're in a disconnected tree. I.e.
	// unmounted.
	invariant(a.tag === HostRoot, 'Unable to find node on an unmounted component.');
	if ((a.stateNode as { current: Fiber }).current === a) {
		// We've determined that A is the current branch.
		return fiber;
	}
	// Otherwise B has to be current branch.
	return alternate;
}

/**
 * Drills down from a parent fiber to the first HostComponent or HostText.
 *
 * @internal
 */
export function findCurrentHostFiber(parent: Fiber): Fiber | undefined {
	const currentParent = findCurrentFiberUsingSlowPath(parent);
	if (!currentParent) {
		return undefined;
	}

	// Next we'll drill down this component to find the first HostComponent/Text.
	let node: Fiber = currentParent;
	while (true) {
		const child = node.child;
		if (node.tag === HostComponent || node.tag === HostText) {
			return node;
		} else if (child) {
			child.return_ = node;
			node = child;
			continue;
		}
		if (node === currentParent) {
			return undefined;
		}
		while (!node.sibling) {
			if (!node.return_ || node.return_ === currentParent) {
				return undefined;
			}
			node = node.return_;
		}
		node.sibling.return_ = node.return_;
		node = node.sibling;
	}
}

/**
 * Like `findCurrentHostFiber`, but never traverses through portals.
 *
 * @internal
 */
export function findCurrentHostFiberWithNoPortals(parent: Fiber): Fiber | undefined {
	const currentParent = findCurrentFiberUsingSlowPath(parent);
	if (!currentParent) {
		return undefined;
	}

	// Next we'll drill down this component to find the first HostComponent/Text.
	let node: Fiber = currentParent;
	while (true) {
		const child = node.child;
		if (
			node.tag === HostComponent ||
			node.tag === HostText ||
			(enableFundamentalAPI && node.tag === FundamentalComponent)
		) {
			return node;
		} else if (child && node.tag !== HostPortal) {
			child.return_ = node;
			node = child;
			continue;
		}
		if (node === currentParent) {
			return undefined;
		}
		while (!node.sibling) {
			if (!node.return_ || node.return_ === currentParent) {
				return undefined;
			}
			node = node.return_;
		}
		node.sibling.return_ = node.return_;
		node = node.sibling;
	}
}

/**
 * Whether the fiber is a Suspense boundary that has timed out (suspended but
 * not dehydrated).
 *
 * @internal
 */
export function isFiberSuspenseAndTimedOut(fiber: Fiber): boolean {
	const memoizedState = fiber.memoizedState as SuspenseState | undefined;
	return fiber.tag === SuspenseComponent && memoizedState !== undefined && memoizedState.dehydrated === undefined;
}

/**
 * Whether `parentFiber` is an ancestor of (or equal to) `childFiber`.
 *
 * @internal
 */
export function doesFiberContain(parentFiber: Fiber, childFiber: Fiber): boolean {
	let node: Fiber | undefined = childFiber;
	const parentFiberAlternate = parentFiber.alternate;
	while (node !== undefined) {
		if (node === parentFiber || node === parentFiberAlternate) {
			return true;
		}
		node = node.return_;
	}
	return false;
}

export default {
	getNearestMountedFiber,
	getSuspenseInstanceFromFiber,
	getContainerFromFiber,
	isFiberMounted,
	isMounted,
	findCurrentFiberUsingSlowPath,
	findCurrentHostFiber,
	findCurrentHostFiberWithNoPortals,
	isFiberSuspenseAndTimedOut,
	doesFiberContain,
};
