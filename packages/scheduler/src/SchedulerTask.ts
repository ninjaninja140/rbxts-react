/**
 * Task type for the React scheduler.
 *
 * Each scheduled callback is wrapped in a `Task` node that carries
 * priority, timing, and a unique identifier.
 *
 * @module SchedulerTask
 */

import type { PriorityLevel } from './SchedulerPriorities';

/**
 * A callback that can be scheduled by the React scheduler.
 *
 * Returns either `void` (task is done) or a continuation callback
 * to be called again on the next tick.
 */
export type Callback = (didTimeout: boolean) => Callback | undefined;

/**
 * A scheduled task node on the priority heap.
 *
 * @public
 */
export interface Task {
	/** Unique monotonically increasing task identifier. */
	readonly id: number;

	/** The callback to invoke. Set to `nil` to cancel. */
	callback: Callback | undefined;

	/** Priority level (1–5). Lower number = higher priority. */
	priorityLevel: PriorityLevel;

	/** The time (ms) the task was scheduled to start. */
	startTime: number;

	/** The time (ms) after which the task is considered expired. */
	expirationTime: number;

	/** Heap sort key: `startTime` for delayed tasks, `expirationTime` otherwise. */
	sortIndex: number;

	/** Only set when profiling is enabled. */
	isQueued?: boolean;
}
