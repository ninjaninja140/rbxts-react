/**
 * Priority levels for the React scheduler on Roblox.
 *
 * Mirrors the upstream React priority system with 6 levels ranging from
 * `NoPriority` (0) to `IdlePriority` (5). Higher numeric values indicate
 * lower priority.
 *
 * ```ts
 * import {
 *   ImmediatePriority,
 *   UserBlockingPriority,
 *   NormalPriority,
 * } from "@nrbx/scheduler";
 * ```
 *
 * @module SchedulerPriorities
 */

/** No priority — used as a sentinel / uninitialized value. */
export const NoPriority = 0;

/** Immediate priority — for synchronous, must-run-now tasks. */
export const ImmediatePriority = 1;

/** User-blocking priority — for input, animations, and other user-visible work. */
export const UserBlockingPriority = 2;

/** Normal priority — the default for most scheduled work. */
export const NormalPriority = 3;

/** Low priority — for work that can be deferred. */
export const LowPriority = 4;

/** Idle priority — for work that only runs when nothing else is pending. */
export const IdlePriority = 5;

/**
 * Union of all priority level constants.
 */
export type PriorityLevel =
	| typeof NoPriority
	| typeof ImmediatePriority
	| typeof UserBlockingPriority
	| typeof NormalPriority
	| typeof LowPriority
	| typeof IdlePriority;
