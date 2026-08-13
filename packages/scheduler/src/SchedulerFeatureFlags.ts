/**
 * Feature flags for the React scheduler.
 *
 * These flags control debugging, profiling, and yield behavior.
 *
 * @module SchedulerFeatureFlags
 */

/** @internal Mutable state for feature flags. */
const flags = {
	/** When `true`, enables scheduler debugging (pause / continue execution). */
	enableSchedulerDebugging: false,

	/** When `true`, enables profiling markers for task lifecycle. */
	enableProfiling: false,

	/** When `true`, enables `requestPaint` (no-op on Roblox). */
	enableRequestPaint: false,

	/** When `true`, scheduler always yields at the yield interval boundary. */
	enableAlwaysYieldScheduler: false,

	/** The maximum yield interval in milliseconds (yield after this long). */
	frameYieldMs: 5,

	/** Timeout (ms) before a user-blocking task is considered expired. */
	userBlockingPriorityTimeout: 250,

	/** Timeout (ms) before a normal-priority task is considered expired. */
	normalPriorityTimeout: 5000,

	/** Timeout (ms) before a low-priority task is considered expired. */
	lowPriorityTimeout: 10000,

	/** Scheduler yield interval (ms). */
	yieldInterval: 5,

	/** Enable deferred (frame-budget-aware) work. */
	deferredWork: false,

	/** Use heartbeat frame markers for time tracking. */
	heartbeatFrameMarker: false,

	/** Use dynamic frame budgeting from heartbeat deltas. */
	targetMsByHeartbeatDelta: false,
};

// Read-only accessors
export const enableSchedulerDebugging = flags.enableSchedulerDebugging as boolean;
export const enableProfiling = flags.enableProfiling as boolean;
export const enableRequestPaint = flags.enableRequestPaint as boolean;
export const enableAlwaysYieldScheduler = flags.enableAlwaysYieldScheduler as boolean;
export const userBlockingPriorityTimeout = flags.userBlockingPriorityTimeout;
export const normalPriorityTimeout = flags.normalPriorityTimeout;
export const lowPriorityTimeout = flags.lowPriorityTimeout;

/**
 * Get the current frame yield interval (ms).
 */
export function getFrameYieldMs(): number {
	return flags.frameYieldMs;
}

/**
 * Set the frame yield interval (ms).
 */
export function setFrameYieldMs(ms: number): void {
	flags.frameYieldMs = ms;
	flags.yieldInterval = ms;
}

/**
 * Set scheduler feature flags at runtime.
 *
 * @param flagsOverride - A partial set of flag overrides.
 */
export function setSchedulerFlags(
	flagsOverride: Partial<{
		yieldInterval: number;
		deferredWork: boolean;
		heartbeatFrameMarker: boolean;
		targetMsByHeartbeatDelta: boolean;
	}>
): void {
	if (flagsOverride.yieldInterval !== undefined) {
		flags.yieldInterval = flagsOverride.yieldInterval;
		flags.frameYieldMs = flagsOverride.yieldInterval;
	}
	if (flagsOverride.deferredWork !== undefined) {
		flags.deferredWork = flagsOverride.deferredWork;
	}
	if (flagsOverride.heartbeatFrameMarker !== undefined) {
		flags.heartbeatFrameMarker = flagsOverride.heartbeatFrameMarker;
	}
	if (flagsOverride.targetMsByHeartbeatDelta !== undefined) {
		flags.targetMsByHeartbeatDelta = flagsOverride.targetMsByHeartbeatDelta;
	}
}

/**
 * Get current scheduler flags.
 *
 * @returns The current flag values.
 */
export function getSchedulerFlags(): Record<string, number | boolean> {
	return {
		yieldInterval: flags.yieldInterval,
		deferredWork: flags.deferredWork,
		heartbeatFrameMarker: flags.heartbeatFrameMarker,
		targetMsByHeartbeatDelta: flags.targetMsByHeartbeatDelta,
	};
}
