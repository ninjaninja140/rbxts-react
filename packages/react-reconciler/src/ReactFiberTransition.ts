/**
 * Tracks the currently pending transition.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberTransition.lua`.
 *
 * @module ReactFiberTransition
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { ReactSharedInternals } from '@nrbx/react-shared';

const ReactCurrentBatchConfig = ReactSharedInternals.ReactCurrentBatchConfig;

export const NoTransition = 0;

/**
 * Returns the transition id of the currently pending transition, if any.
 *
 * @returns The current transition id, or `NoTransition` (0).
 * @internal
 */
export function requestCurrentTransition(): number {
	return ReactCurrentBatchConfig.transition;
}

export default {
	NoTransition,
	requestCurrentTransition,
};
