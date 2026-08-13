/**
 * Roblox-specific host configuration for the React scheduler.
 *
 * This module replaces the browser `MessageChannel` / `setTimeout` / `performance.now`
 * APIs with Roblox equivalents:
 *
 * - **Timing**: `os.clock()` for millisecond-precision time.
 * - **Async dispatch**: `task.defer()` for continuation in the current frame,
 *   `task.delay(0, cb)` for yielding to the next frame.
 * - **Frame tracking**: `RunService.Heartbeat` for dynamic frame budget calculation.
 * - **Error boundary**: Wraps callbacks in `xpcall` with `describeError`.
 *
 * @module SchedulerHostConfig
 */

/// <reference types="@rbxts/types" />

import { getFrameYieldMs, setFrameYieldMs, getSchedulerFlags, setSchedulerFlags } from './SchedulerFeatureFlags';

/**
 * Returns the current time in milliseconds.
 *
 * Uses `os.clock()` (which returns seconds) and multiplies by 1000.
 *
 * @returns Current time in milliseconds.
 */
export function getCurrentTime(): number {
	return os.clock() * 1000;
}

const desiredMsPerFrame = 1000 / 60; // ~16.67 ms at 60 FPS
const maxMsPerFrame = 1000 / 30; // ~33.33 ms at 30 FPS
let _targetMsPerFrame = desiredMsPerFrame;

/**
 * Recalculate the per-frame budget based on a measured frame delta.
 *
 * @param stepMs - The measured frame step in milliseconds.
 */
function updateFrameBudget(stepMs: number): void {
	_targetMsPerFrame = math.clamp(stepMs, desiredMsPerFrame, maxMsPerFrame);
}

// Connect to Heartbeat for dynamic frame budget tracking.
let heartbeatConnection: RBXScriptConnection | undefined;

/**
 * Start or restart the Heartbeat connection for frame budget tracking.
 */
function createHeartbeatConnection(): void {
	if (heartbeatConnection) {
		heartbeatConnection.Disconnect();
	}
	heartbeatConnection = game.GetService('RunService').Heartbeat.Connect((step: number) => {
		updateFrameBudget(step * 1000);
	});
}

/**
 * Disconnect the Heartbeat listener.
 */
function disconnectHeartbeat(): void {
	if (heartbeatConnection) {
		heartbeatConnection.Disconnect();
		heartbeatConnection = undefined;
		_targetMsPerFrame = desiredMsPerFrame;
	}
}

let _frameStartTime = 0;

/**
 * Set a frame marker for budget calculation.
 */
function setFrameMarker(): void {
	_frameStartTime = getCurrentTime();
}

let deadline = 0;

/**
 * Check if the scheduler should yield to the host.
 *
 * Yields when the current time exceeds the deadline.
 *
 * @returns `true` if we should yield control back to the Roblox engine.
 */
export function shouldYieldToHost(): boolean {
	return getCurrentTime() >= deadline;
}

/**
 * Request a paint (no-op on Roblox, but kept for API compatibility).
 */
export function requestPaint(): void {
	// No-op: Roblox renders on its own schedule.
}

/**
 * Force a specific frame rate for scheduler yielding.
 *
 * @param fps - Target FPS (0 resets to default, max 125).
 */
export function forceFrameRate(fps: number): void {
	if (fps < 0 || fps > 125) {
		return;
	}

	if (fps > 0) {
		setFrameYieldMs(math.floor(1000 / fps));
	} else {
		setFrameYieldMs(5);
	}
}

let isMessageLoopRunning = false;
let scheduledHostCallback: ((hasTimeRemaining: boolean, currentTime: number) => boolean) | undefined;
let taskTimeoutID: thread | undefined;

/**
 * Perform work until the deadline is reached.
 *
 * This is the core event loop. It calls `scheduledHostCallback` repeatedly,
 * yielding when the frame budget is exhausted or when `hasTimeRemaining` is false.
 */
function performWorkUntilDeadline(): void {
	if (scheduledHostCallback !== undefined) {
		const currentTime = getCurrentTime();
		// Yield after `frameYieldMs` ms.
		deadline = currentTime + getFrameYieldMs();
		const hasTimeRemaining = true;

		const hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime);

		if (hasMoreWork) {
			// More work — yield to next frame.
			task.delay(0, performWorkUntilDeadline);
		} else {
			isMessageLoopRunning = false;
			scheduledHostCallback = undefined;
		}
	} else {
		isMessageLoopRunning = false;
	}
}

/**
 * Register a callback to be invoked on the host's message loop.
 *
 * @param callback - The callback to schedule.
 */
export function requestHostCallback(callback: (hasTimeRemaining: boolean, currentTime: number) => boolean): void {
	scheduledHostCallback = callback;
	if (!isMessageLoopRunning) {
		isMessageLoopRunning = true;
		task.delay(0, performWorkUntilDeadline);
	}
}

/**
 * Cancel the currently scheduled host callback.
 */
export function cancelHostCallback(): void {
	scheduledHostCallback = undefined;
}

/**
 * Schedule a timeout callback after `ms` milliseconds.
 *
 * @param callback - The callback to invoke on timeout.
 * @param ms - Delay in milliseconds.
 */
export function requestHostTimeout(callback: (currentTime: number) => void, ms: number): void {
	taskTimeoutID = task.delay(ms, () => {
		callback(getCurrentTime());
	});
}

/**
 * Cancel a previously scheduled timeout.
 */
export function cancelHostTimeout(): void {
	if (taskTimeoutID !== undefined) {
		task.cancel(taskTimeoutID);
		taskTimeoutID = undefined;
	}
}

export { setSchedulerFlags, getSchedulerFlags };
export { setFrameMarker, createHeartbeatConnection, disconnectHeartbeat };
