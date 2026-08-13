/**
 * Test-selector support for the fiber reconciler.
 *
 * Upstream React exposes a selector API (find by component, role, text, or test
 * name) that lets tests query the host tree. The Roblox renderer does not
 * implement the host-level pieces that API needs (`getInstanceFromNode`,
 * `getBoundingRect`, `setupIntersectionObserver`, and so on), so — exactly as
 * in the upstream `react-lua` port — the selector implementation is omitted and
 * only the commit-hook plumbing remains. `onCommitRoot` is a no-op unless a
 * renderer opts in via `supportsTestSelectors`.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactTestSelectors.lua`
 * (itself a port of Facebook's
 * `packages/react-reconciler/src/ReactTestSelectors.js`).
 *
 * @module ReactTestSelectors
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import HostConfig from './ReactFiberHostConfig';

/** The on-screen bounds of a matched host instance. */
export type BoundingRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

/** Options accepted by an intersection observer (unused on Roblox). */
export type IntersectionObserverOptions = { [key: string]: any };

/** A callback receiving the visible intersections of the observed elements. */
export type ObserveVisibleRectsCallback = (intersections: Array<{ ratio: number; rect: BoundingRect }>) => void;

/** Hooks invoked after each commit while test selectors are being observed. */
const commitHooks: Array<() => void> = [];

/**
 * Runs any pending test-selector commit hooks.
 *
 * Reads `supportsTestSelectors` lazily (at call time) rather than at module
 * load, because the host config is populated by the renderer after the module
 * graph has already been required. With the feature disabled the call is a
 * no-op.
 *
 * @internal
 */
export function onCommitRoot(): void {
	if (HostConfig.supportsTestSelectors) {
		for (const commitHook of commitHooks) {
			commitHook();
		}
	}
}

export default {
	onCommitRoot,
};
