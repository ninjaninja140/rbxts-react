/**
 * Tracks the fiber currently being rendered so dev tooling can attribute
 * warnings and errors to the right component.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactCurrentFiber.lua`.
 *
 * @module ReactCurrentFiber
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { ReactSharedInternals, getComponentName } from '@nrbx/react-shared';
import { getStackByFiberInDevAndProd } from './ReactFiberComponentStack';
import type { Fiber } from './types';

/** The fiber currently being rendered, or `undefined` when idle. */
export let current: Fiber | undefined;

/** Whether a render is currently in progress. */
export let isRendering = false;

/**
 * Returns the display name of the owner of the currently rendered fiber, or
 * `undefined` when there is no owner (or in production builds).
 *
 * @returns The owner's component name, if any.
 * @internal
 */
export function getCurrentFiberOwnerNameInDevOrNull(): string | undefined {
	if (__DEV__) {
		if (current === undefined) {
			return undefined;
		}
		const owner = current._debugOwner;
		if (owner !== undefined) {
			return getComponentName(owner.type);
		}
	}
	return undefined;
}

/**
 * Builds the component stack for the currently rendered fiber.
 *
 * @returns A human-readable component stack string.
 * @internal
 */
function getCurrentFiberStackInDev(): string {
	if (__DEV__) {
		if (current === undefined) {
			return '';
		}
		// Safe because if the current fiber exists, we are reconciling and it
		// is guaranteed to be the work-in-progress version.
		return getStackByFiberInDevAndProd(current);
	}
	return '';
}

/**
 * Clears the current fiber, restoring the debug frame to its default state.
 *
 * @internal
 */
export function resetCurrentFiber(): void {
	if (__DEV__) {
		(ReactSharedInternals.ReactDebugCurrentFrame as any).getCurrentStack = undefined;
		current = undefined;
		isRendering = false;
	}
}

/**
 * Sets the current fiber and installs its stack builder on the debug frame.
 *
 * @param fiber - The fiber that is now being rendered.
 * @internal
 */
export function setCurrentFiber(fiber: Fiber): void {
	if (__DEV__) {
		(ReactSharedInternals.ReactDebugCurrentFrame as any).getCurrentStack = getCurrentFiberStackInDev;
		current = fiber;
		isRendering = false;
	}
}

/**
 * Marks whether a render is currently in progress.
 *
 * @param rendering - The new rendering state.
 * @internal
 */
export function setIsRendering(rendering: boolean): void {
	if (__DEV__) {
		isRendering = rendering;
	}
}

/**
 * Returns whether a render is currently in progress (always `false` in
 * production builds).
 *
 * @returns The rendering state.
 * @internal
 */
export function getIsRendering(): boolean {
	if (__DEV__) {
		return isRendering;
	}
	return false;
}

export default {
	getCurrentFiberOwnerNameInDevOrNull,
	resetCurrentFiber,
	setCurrentFiber,
	setIsRendering,
	getIsRendering,
};
