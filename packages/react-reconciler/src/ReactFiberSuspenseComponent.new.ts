/**
 * Suspense-specific data structures and helpers: the props/state shapes that
 * describe a Suspense boundary or SuspenseList, plus the logic for deciding
 * whether a boundary should capture a suspension and for finding the first
 * suspended row in a list.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberSuspenseComponent.new.lua`.
 *
 * @module ReactFiberSuspenseComponent
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import type { ReactNodeList, Wakeable } from '@nrbx/react-shared';
import { DidCapture, NoFlags } from './ReactFiberFlags';
import HostConfig from './ReactFiberHostConfig';
import type { SuspenseInstance } from './ReactFiberHostConfig';
import { SuspenseComponent, SuspenseListComponent } from './ReactWorkTags';
import type { Fiber, Lane } from './types';

// Host-config functions are read lazily (at call time) because the renderer
// splices its implementation in via `initialize()` long after this module has
// been `require`d. These hydration helpers are unpopulated on Roblox and are
// only ever reached behind a `supportsHydration` flag.
function isSuspenseInstancePending(instance: SuspenseInstance): boolean {
	return HostConfig.isSuspenseInstancePending!(instance);
}
function isSuspenseInstanceFallback(instance: SuspenseInstance): boolean {
	return HostConfig.isSuspenseInstanceFallback!(instance);
}

/**
 * Props for a Suspense boundary.
 *
 * @internal
 */
export type SuspenseProps = {
	children?: ReactNodeList;
	fallback?: ReactNodeList;

	// TODO: Add "unstable_" prefix?
	suspenseCallback: (newBoundaries: Set<Wakeable> | undefined) => any;

	unstable_expectedLoadTime?: number;
	unstable_avoidThisFallback?: boolean;
};

/**
 * A `nil`/undefined SuspenseState represents an unsuspended normal Suspense
 * boundary. A non-null SuspenseState means that it is blocked for one reason
 * or another.
 * - A non-null `dehydrated` field means it's blocked pending hydration.
 * - A nil/undefined `dehydrated` field means it's blocked by something
 *   suspending and we're currently showing a fallback instead.
 *
 * @internal
 */
export type SuspenseState = {
	// If this boundary is still dehydrated, we store the SuspenseInstance
	// here to indicate that it is dehydrated (flag) and for quick access
	// to check things like isSuspenseInstancePending.
	dehydrated: SuspenseInstance | undefined;
	// Represents the lane we should attempt to hydrate a dehydrated boundary at.
	// OffscreenLane is the default for dehydrated boundaries.
	// NoLane is the default for normal boundaries, which turns into "normal" pri.
	retryLane: Lane;
};

/**
 * The tail mode of a SuspenseList (upstream allows `"collapsed"`, `"hidden"`,
 * or undefined; kept permissive here).
 *
 * @internal
 */
export type SuspenseListTailMode = string | undefined;

/**
 * The render state of a SuspenseList.
 *
 * @internal
 */
export type SuspenseListRenderState = {
	isBackwards: boolean;
	// The currently rendering tail row.
	rendering: Fiber | undefined;
	// The absolute time when we started rendering the most recent tail row.
	renderingStartTime: number;
	// The last of the already rendered children.
	last: Fiber | undefined;
	// Remaining rows on the tail of the list.
	tail: Fiber | undefined;
	// Tail insertions setting.
	tailMode: SuspenseListTailMode;
};

/**
 * Decides whether a Suspense boundary should capture the current suspension
 * and render its fallback, or let it bubble to a parent boundary.
 *
 * @param workInProgress - The Suspense boundary fiber.
 * @param hasInvisibleParent - Whether a parent boundary is currently invisible.
 * @returns `true` if this boundary should capture.
 * @internal
 */
export function shouldCaptureSuspense(workInProgress: Fiber, hasInvisibleParent: boolean): boolean {
	// If it was the primary children that just suspended, capture and render the
	// fallback. Otherwise, don't capture and bubble to the next boundary.
	const nextState = workInProgress.memoizedState as SuspenseState | undefined;
	if (nextState !== undefined) {
		if (nextState.dehydrated !== undefined) {
			// A dehydrated boundary always captures.
			return true;
		}
		return false;
	}
	const props = workInProgress.memoizedProps as Record<string, unknown>;
	// In order to capture, the Suspense component must have a fallback prop.
	if (props.fallback === undefined) {
		return false;
	}
	// Regular boundaries always capture.
	if (props.unstable_avoidThisFallback !== true) {
		return true;
	}
	// If it's a boundary we should avoid, then we prefer to bubble up to the
	// parent boundary if it is currently invisible.
	if (hasInvisibleParent) {
		return false;
	}
	// If the parent is not able to handle it, we must handle it.
	return true;
}

/**
 * Finds the first suspended row in a SuspenseList, starting from `row` and
 * walking the tree (following `child`/`sibling` links).
 *
 * @param row - The fiber to begin searching from.
 * @returns The first suspended fiber, or `undefined`.
 * @internal
 */
export function findFirstSuspended(row: Fiber): Fiber | undefined {
	let node: Fiber | undefined = row;
	while (node !== undefined) {
		if (node.tag === SuspenseComponent) {
			const state = node.memoizedState as SuspenseState | undefined;
			if (state !== undefined) {
				const dehydrated = state.dehydrated;
				if (
					dehydrated === undefined ||
					isSuspenseInstancePending(dehydrated) ||
					isSuspenseInstanceFallback(dehydrated)
				) {
					return node;
				}
			}
		} else if (
			node.tag === SuspenseListComponent &&
			// revealOrder undefined can't be trusted because it don't
			// keep track of whether it suspended or not.
			(node.memoizedProps as Record<string, unknown>).revealOrder !== undefined
		) {
			const didSuspend = bit32.band(node.flags, DidCapture) !== NoFlags;
			if (didSuspend) {
				return node;
			}
		} else if (node.child !== undefined) {
			node.child.return_ = node;
			node = node.child;
			continue;
		}
		if (node === row) {
			return undefined;
		}
		while (node.sibling === undefined) {
			if (node.return_ === undefined || node.return_ === row) {
				return undefined;
			}
			node = node.return_ as Fiber;
		}
		const sibling = node.sibling as Fiber;
		sibling.return_ = node.return_;
		node = sibling;
	}
	return undefined;
}

export default {
	shouldCaptureSuspense,
	findFirstSuspended,
};
