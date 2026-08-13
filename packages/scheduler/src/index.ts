/**
 * `@nrbx/scheduler` — React's cooperative scheduler for Roblox.
 *
 * This package provides the scheduling primitives that React uses to
 * break up work into chunks and yield to the Roblox engine between frames.
 *
 * ## Priority levels (lowest → highest):
 *
 * | Constant                    | Value | Use case                          |
 * |-----------------------------|-------|-----------------------------------|
 * | `NoPriority`                | 0     | Sentinel / uninitialized          |
 * | `ImmediatePriority`         | 1     | Sync, must-run-now                |
 * | `UserBlockingPriority`      | 2     | Input, animations, user feedback  |
 * | `NormalPriority`            | 3     | Default for most scheduled work   |
 * | `LowPriority`               | 4     | Deferred / background work        |
 * | `IdlePriority`              | 5     | Work when nothing else is pending |
 *
 * ## Basic usage:
 *
 * ```ts
 * import {
 *   unstable_scheduleCallback,
 *   unstable_NormalPriority,
 *   unstable_shouldYield
 * } from "@nrbx/scheduler";
 *
 * unstable_scheduleCallback(unstable_NormalPriority, (didTimeout) => {
 *   // Do some work...
 *   if (moreWorkRemaining()) {
 *     return continuationCallback; // Called next frame
 *   }
 *   // No return = task is done
 * });
 * ```
 *
 * ## Running with priority:
 *
 * ```ts
 * import { unstable_runWithPriority, unstable_UserBlockingPriority } from "@nrbx/scheduler";
 *
 * unstable_runWithPriority(unstable_UserBlockingPriority, () => {
 *   // High-priority work here
 * });
 * ```
 *
 * @module index
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import type { Task, Callback } from './SchedulerTask';
import type { PriorityLevel } from './SchedulerPriorities';

export type { Task, Callback, PriorityLevel };

export {
	/** @see {@link NoPriority} */
	NoPriority,
	/** @see {@link ImmediatePriority} */
	ImmediatePriority,
	/** @see {@link UserBlockingPriority} */
	UserBlockingPriority,
	/** @see {@link NormalPriority} */
	NormalPriority,
	/** @see {@link LowPriority} */
	LowPriority,
	/** @see {@link IdlePriority} */
	IdlePriority,
} from './SchedulerPriorities';

export {
	unstable_runWithPriority,
	unstable_next,
	unstable_scheduleCallback,
	unstable_cancelCallback,
	unstable_wrapCallback,
	unstable_getCurrentPriorityLevel,
	unstable_shouldYield,
	unstable_requestPaint,
	unstable_continueExecution,
	unstable_pauseExecution,
	unstable_getFirstCallbackNode,
	unstable_now,
	unstable_forceFrameRate,
	unstable_setSchedulerFlags,
	unstable_getSchedulerFlags,
} from './Scheduler';

import {
	ImmediatePriority,
	UserBlockingPriority,
	NormalPriority,
	LowPriority,
	IdlePriority,
} from './SchedulerPriorities';

export {
	ImmediatePriority as unstable_ImmediatePriority,
	UserBlockingPriority as unstable_UserBlockingPriority,
	NormalPriority as unstable_NormalPriority,
	LowPriority as unstable_LowPriority,
	IdlePriority as unstable_IdlePriority,
};

import * as tracing from './tracing';
export { tracing };
export type {
	Interaction,
	Subscriber,
	InteractionsRef,
	SubscriberRef,
	Wrapped,
} from './tracing';
