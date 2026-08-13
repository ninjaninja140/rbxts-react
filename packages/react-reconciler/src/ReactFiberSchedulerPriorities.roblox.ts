/**
 * React priority levels — the renderer's own priority scale, extracted from
 * `SchedulerWithReactIntegration` to avoid a circular require.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberSchedulerPriorities.roblox.lua`.
 *
 * @module ReactFiberSchedulerPriorities
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

export type ReactPriorityLevel = number;

// Except for NoPriority, these correspond to Scheduler priorities. We use
// ascending numbers so we can compare them like numbers. They start at 90 to
// avoid clashing with Scheduler's priorities.
export const ImmediatePriority: ReactPriorityLevel = 99;
export const UserBlockingPriority: ReactPriorityLevel = 98;
export const NormalPriority: ReactPriorityLevel = 97;
export const LowPriority: ReactPriorityLevel = 96;
export const IdlePriority: ReactPriorityLevel = 95;
// NoPriority is the absence of priority. Also React-only.
export const NoPriority: ReactPriorityLevel = 90;

export default {
	ImmediatePriority,
	UserBlockingPriority,
	NormalPriority,
	LowPriority,
	IdlePriority,
	NoPriority,
};
