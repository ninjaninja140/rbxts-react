/**
 * Schedules a task to run asynchronously.
 *
 * @module enqueueTask
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

/**
 * Enqueues `callback` to run on the next tick using `task.spawn`.
 *
 * @param callback - The task to run.
 * @internal
 */
export default function enqueueTask(callback: () => void): void {
	// `task.spawn` is the Roblox-native equivalent of `setTimeout(fn, 0)`.
	task.spawn(callback);
}
