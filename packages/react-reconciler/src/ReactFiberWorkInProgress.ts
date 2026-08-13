/**
 * Tracks the lanes that were skipped during the current render pass.
 *
 * Upstream this is a single state field (plus its getter/setter and merge
 * helper) extracted out of `ReactFiberWorkLoop.new` so the lanes module can
 * mutate it without creating a dependency cycle back into the work loop.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberWorkInProgress.lua`.
 *
 * @module ReactFiberWorkInProgress
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { NoLanes, mergeLanes } from './ReactFiberLane';
import type { Lane, Lanes } from './types';

/**
 * Lanes that were scheduled while the current render was in progress but did
 * not make it into the current pass. They are picked up on the next render.
 */
let workInProgressRootSkippedLanesField: Lanes = NoLanes;

/**
 * Reads (or, when `value` is provided, writes) the lanes skipped by the
 * current render pass. Used as a cheap replacement for a property accessor.
 *
 * @param value - New value to store, or omitted to read the current value.
 * @returns The current (or newly written) skipped-lanes value.
 * @internal
 */
export function workInProgressRootSkippedLanes(value?: Lanes): Lanes {
	if (value === undefined) {
		return workInProgressRootSkippedLanesField;
	}
	workInProgressRootSkippedLanesField = value;
	return workInProgressRootSkippedLanesField;
}

/**
 * Merges `lane` into the set of lanes skipped by the current render pass.
 *
 * @param lane - Lane (or lanes) to record as skipped.
 * @internal
 */
export function markSkippedUpdateLanes(lane: Lane | Lanes): void {
	workInProgressRootSkippedLanesField = mergeLanes(lane, workInProgressRootSkippedLanesField);
}

export default {
	workInProgressRootSkippedLanes,
	markSkippedUpdateLanes,
};
