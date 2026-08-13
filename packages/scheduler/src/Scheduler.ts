/**
 * Core React scheduler implementation for Roblox.
 *
 * This module implements the cooperative scheduling model that React uses
 * to break up work into chunks. It maintains two priority heaps:
 *
 * - **taskQueue** — tasks ready to run, ordered by expiration time.
 * - **timerQueue** — delayed tasks, ordered by start time.
 *
 * When a task completes, its callback may return a continuation function
 * to resume work in a later frame.
 *
 * @module Scheduler
 */

/// <reference types="@rbxts/types" />

import { push, pop, peek } from './SchedulerMinHeap';
import {
	ImmediatePriority,
	UserBlockingPriority,
	NormalPriority,
	LowPriority,
	IdlePriority,
} from './SchedulerPriorities';
import type { PriorityLevel } from './SchedulerPriorities';
import type { Callback, Task } from './SchedulerTask';
import {
	enableSchedulerDebugging,
	userBlockingPriorityTimeout,
	normalPriorityTimeout,
	lowPriorityTimeout,
} from './SchedulerFeatureFlags';
import {
	getCurrentTime,
	shouldYieldToHost,
	requestPaint,
	forceFrameRate,
	requestHostCallback,
	requestHostTimeout,
	cancelHostTimeout,
	setSchedulerFlags,
	getSchedulerFlags,
} from './SchedulerHostConfig';

/** Immediate tasks expire instantly. */
const IMMEDIATE_PRIORITY_TIMEOUT = -1;

/** User-blocking tasks timeout after 250ms. */
const USER_BLOCKING_PRIORITY_TIMEOUT = userBlockingPriorityTimeout;

/** Normal tasks timeout after 5s. */
const NORMAL_PRIORITY_TIMEOUT = normalPriorityTimeout;

/** Low-priority tasks timeout after 10s. */
const LOW_PRIORITY_TIMEOUT = lowPriorityTimeout;

/** Idle tasks never expire. */
const IDLE_PRIORITY_TIMEOUT = 1073741823; // max signed 31-bit int

/** Monotonically increasing task ID counter. */
let taskIdCounter = 1;

/** The currently executing task. */
let currentTask: Task | undefined;

/** The current priority level (used for `runWithPriority` nesting). */
let currentPriorityLevel: PriorityLevel = NormalPriority;

/** Whether we're currently inside the work loop. */
let isPerformingWork = false;

/** Whether a host callback is already scheduled. */
let isHostCallbackScheduled = false;

/** Whether a host timeout is already scheduled. */
let isHostTimeoutScheduled = false;

/** When `enableSchedulerDebugging`, the scheduler can be paused. */
let isSchedulerPaused = false;

/** Task queue — tasks that are ready to execute, ordered by expiration. */
const taskQueue: Task[] = [];

/** Timer queue — delayed tasks, ordered by start time. */
const timerQueue: Task[] = [];

/**
 * Return the timeout (ms) for a given priority level.
 */
function timeoutForPriority(priorityLevel: PriorityLevel): number {
	switch (priorityLevel) {
		case ImmediatePriority:
			return IMMEDIATE_PRIORITY_TIMEOUT;
		case UserBlockingPriority:
			return USER_BLOCKING_PRIORITY_TIMEOUT;
		case IdlePriority:
			return IDLE_PRIORITY_TIMEOUT;
		case LowPriority:
			return LOW_PRIORITY_TIMEOUT;
		default:
			return NORMAL_PRIORITY_TIMEOUT;
	}
}

/**
 * Move any expired timers from `timerQueue` to `taskQueue`.
 */
function advanceTimers(currentTime: number): void {
	let timer = peek(timerQueue) as Task | undefined;

	while (timer !== undefined) {
		if (timer.callback === undefined) {
			// Timer was cancelled.
			pop(timerQueue);
		} else if (timer.startTime <= currentTime) {
			// Timer fired — move to task queue.
			timer.sortIndex = timer.expirationTime;
			push(taskQueue, timer);
			pop(timerQueue);
		} else {
			// Remaining timers are still pending.
			return;
		}

		timer = peek(timerQueue) as Task | undefined;
	}
}

/** Handle a host timeout firing. */
function handleTimeout(currentTime: number): void {
	isHostTimeoutScheduled = false;
	advanceTimers(currentTime);

	if (!isHostCallbackScheduled) {
		if (peek(taskQueue) !== undefined) {
			isHostCallbackScheduled = true;
			requestHostCallback(flushWork as (hasTimeRemaining: boolean, currentTime: number) => boolean);
		} else {
			const firstTimer = peek(timerQueue) as Task | undefined;
			if (firstTimer !== undefined) {
				requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
			}
		}
	}
}

/**
 * The main work loop. Processes tasks from `taskQueue` until the deadline
 * is hit or the queue is empty.
 *
 * @param hasTimeRemaining - Whether there is remaining frame budget.
 * @param initialTime - The time the work loop started.
 * @returns `true` if more work remains, `false` otherwise.
 */
function workLoop(hasTimeRemaining: boolean, initialTime: number): boolean {
	let currentTime = initialTime;
	advanceTimers(currentTime);
	currentTask = peek(taskQueue) as Task | undefined;

	while (currentTask !== undefined && !(enableSchedulerDebugging && isSchedulerPaused)) {
		if (currentTask.expirationTime > currentTime && (!hasTimeRemaining || shouldYieldToHost())) {
			// Task hasn't expired and we're out of time — break.
			break;
		}

		const callback = currentTask.callback;
		if (callback !== undefined) {
			currentTask.callback = undefined;
			currentPriorityLevel = currentTask.priorityLevel;
			const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;

			const continuationCallback = callback(didUserCallbackTimeout);
			currentTime = getCurrentTime();

			if (continuationCallback !== undefined) {
				// Task wants to continue — restore callback.
				currentTask.callback = continuationCallback;
			} else {
				// Task is done.
				if (currentTask === peek(taskQueue)) {
					pop(taskQueue);
				}
			}
			advanceTimers(currentTime);
		} else {
			// Task was cancelled.
			pop(taskQueue);
		}

		currentTask = peek(taskQueue) as Task | undefined;
	}

	// Return whether there's additional work.
	if (currentTask !== undefined) {
		return true;
	}

	const firstTimer = peek(timerQueue) as Task | undefined;
	if (firstTimer !== undefined) {
		requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
	}

	return false;
}

/**
 * Entry point into the work loop. Sets up state and delegates to `workLoop`.
 */
function flushWork(hasTimeRemaining: boolean, initialTime: number): boolean {
	// We'll need a host callback the next time work is scheduled.
	isHostCallbackScheduled = false;
	if (isHostTimeoutScheduled) {
		isHostTimeoutScheduled = false;
		cancelHostTimeout();
	}

	isPerformingWork = true;
	const previousPriorityLevel = currentPriorityLevel;

	const result = workLoop(hasTimeRemaining, initialTime);

	// Cleanup.
	currentTask = undefined;
	currentPriorityLevel = previousPriorityLevel;
	isPerformingWork = false;

	return result;
}

/**
 * Run a callback under a specific priority level, restoring the previous
 * priority afterwards.
 *
 * @param priorityLevel - The priority to run at.
 * @param eventHandler - The callback to invoke.
 * @returns The callback's return value.
 */
export function unstable_runWithPriority<T>(priorityLevel: PriorityLevel, eventHandler: () => T): T {
	// Validate priority level.
	if (
		priorityLevel !== ImmediatePriority &&
		priorityLevel !== UserBlockingPriority &&
		priorityLevel !== NormalPriority &&
		priorityLevel !== LowPriority &&
		priorityLevel !== IdlePriority
	) {
		priorityLevel = NormalPriority;
	}

	const previousPriorityLevel = currentPriorityLevel;
	currentPriorityLevel = priorityLevel;

	try {
		return eventHandler();
	} finally {
		currentPriorityLevel = previousPriorityLevel;
	}
}

/**
 * Run a callback at normal priority, or at the current level if it's
 * lower than normal.
 *
 * @param eventHandler - The callback to invoke.
 * @returns The callback's return value.
 */
export function unstable_next(eventHandler: () => void): void {
	let priorityLevel: PriorityLevel;

	if (
		currentPriorityLevel === ImmediatePriority ||
		currentPriorityLevel === UserBlockingPriority ||
		currentPriorityLevel === NormalPriority
	) {
		priorityLevel = NormalPriority;
	} else {
		priorityLevel = currentPriorityLevel;
	}

	const previousPriorityLevel = currentPriorityLevel;
	currentPriorityLevel = priorityLevel;

	try {
		eventHandler();
	} finally {
		currentPriorityLevel = previousPriorityLevel;
	}
}

/**
 * Wrap a callback so that it always runs at the priority level that was
 * current when `wrapCallback` was called.
 *
 * @param callback - The callback to wrap.
 * @returns A wrapped version of the callback.
 */
export function unstable_wrapCallback<T extends (...args: Array<unknown>) => void>(callback: T): T {
	const parentPriorityLevel = currentPriorityLevel;
	return ((...args: Array<unknown>) => {
		const previousPriorityLevel = currentPriorityLevel;
		currentPriorityLevel = parentPriorityLevel;

		try {
			return callback(...args);
		} finally {
			currentPriorityLevel = previousPriorityLevel;
		}
	}) as unknown as T;
}

/**
 * Schedule a callback at a given priority level.
 *
 * @param priorityLevel - The priority to schedule at.
 * @param callback - The callback to invoke.
 * @param options - Optional `{ delay: number }` to defer the task.
 * @returns The scheduled `Task` node (can be cancelled with `cancelCallback`).
 */
export function unstable_scheduleCallback(
	priorityLevel: PriorityLevel,
	callback: Callback,
	options?: { delay?: number }
): Task {
	const currentTime = getCurrentTime();

	let startTime: number;
	if (options !== undefined && options.delay !== undefined && options.delay > 0) {
		startTime = currentTime + options.delay;
	} else {
		startTime = currentTime;
	}

	const timeout = timeoutForPriority(priorityLevel);
	const expirationTime = startTime + timeout;

	const newTask: Task = {
		id: taskIdCounter,
		callback,
		priorityLevel,
		startTime,
		expirationTime,
		sortIndex: -1,
	};
	taskIdCounter += 1;

	if (startTime > currentTime) {
		// This is a delayed task.
		newTask.sortIndex = startTime;
		push(timerQueue, newTask);

		if (peek(taskQueue) === undefined && newTask === peek(timerQueue)) {
			// This is the earliest timer.
			if (isHostTimeoutScheduled) {
				cancelHostTimeout();
			} else {
				isHostTimeoutScheduled = true;
			}
			requestHostTimeout(handleTimeout, startTime - currentTime);
		}
	} else {
		newTask.sortIndex = expirationTime;
		push(taskQueue, newTask);

		if (!isHostCallbackScheduled && !isPerformingWork) {
			isHostCallbackScheduled = true;
			requestHostCallback(flushWork as (hasTimeRemaining: boolean, currentTime: number) => boolean);
		}
	}

	return newTask;
}

/**
 * Cancel a scheduled task.
 *
 * Sets the task's callback to `undefined`. The task will be removed
 * from the queue when its turn comes.
 *
 * @param task - The task to cancel.
 */
export function unstable_cancelCallback(task: Task): void {
	task.callback = undefined;
}

/**
 * Pause scheduler execution (debug builds only).
 */
export function unstable_pauseExecution(): void {
	isSchedulerPaused = true;
}

/**
 * Resume scheduler execution (debug builds only).
 */
export function unstable_continueExecution(): void {
	isSchedulerPaused = false;
	if (!isHostCallbackScheduled && !isPerformingWork) {
		isHostCallbackScheduled = true;
		requestHostCallback(flushWork as (hasTimeRemaining: boolean, currentTime: number) => boolean);
	}
}

/**
 * Get the first callback node from the task queue.
 *
 * @returns The first task, or `undefined` if the queue is empty.
 */
export function unstable_getFirstCallbackNode(): Task | undefined {
	return peek(taskQueue) as Task | undefined;
}

/**
 * Get the current priority level.
 *
 * @returns The current priority level constant.
 */
export function unstable_getCurrentPriorityLevel(): PriorityLevel {
	return currentPriorityLevel;
}

// Re-exports
export { ImmediatePriority, UserBlockingPriority, NormalPriority, LowPriority, IdlePriority };
export { getCurrentTime as unstable_now };
export { shouldYieldToHost as unstable_shouldYield };
export { requestPaint as unstable_requestPaint };
export { forceFrameRate as unstable_forceFrameRate };
export { setSchedulerFlags as unstable_setSchedulerFlags };
export { getSchedulerFlags as unstable_getSchedulerFlags };
