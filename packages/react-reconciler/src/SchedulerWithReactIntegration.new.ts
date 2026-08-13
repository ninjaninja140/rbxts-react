/**
 * Ported from `react-lua/modules/react-reconciler/src/SchedulerWithReactIntegration.new.lua`.
 *
 * Bridges the generic `@nrbx/scheduler` (which exposes `unstable_*` names) to
 * the React 17-era naming the reconciler expects (`scheduleCallback`,
 * `runWithPriority`, etc.). It also maps the scheduler's priority levels onto
 * React's own priority scale from `ReactFiberSchedulerPriorities.roblox`.
 */

/// <reference types="@rbxts/types" />

import { __YOLO__ } from '@nrbx/react-globals';
import { describeError, invariant, ReactFeatureFlags } from '@nrbx/react-shared';
import {
	ImmediatePriority as SchedulerImmediatePriority,
	LowPriority as SchedulerLowPriority,
	NormalPriority as SchedulerNormalPriority,
	UserBlockingPriority as SchedulerUserBlockingPriority,
	IdlePriority as SchedulerIdlePriority,
	unstable_cancelCallback,
	unstable_getCurrentPriorityLevel,
	unstable_now,
	unstable_requestPaint,
	unstable_runWithPriority,
	unstable_scheduleCallback,
	unstable_shouldYield,
} from '@nrbx/scheduler';
import type { Callback as SchedulerTaskCallback, PriorityLevel } from '@nrbx/scheduler';

import {
	ImmediatePriority,
	IdlePriority,
	LowPriority,
	NoPriority,
	NormalPriority,
	type ReactPriorityLevel,
	UserBlockingPriority,
} from './ReactFiberSchedulerPriorities.roblox';
import { getCurrentUpdateLanePriority, setCurrentUpdateLanePriority, SyncLanePriority } from './ReactFiberLane';

const decoupleUpdatePriorityFromScheduler = ReactFeatureFlags.decoupleUpdatePriorityFromScheduler;

export type SchedulerCallback = (isSync: boolean) => SchedulerCallback | void;

type SchedulerCallbackOptions = { timeout?: number };

// Sentinel returned from `scheduleSyncCallback` so callers that try to cancel a
// sync callback (which lives on an internal queue rather than the scheduler)
// can be cheaply identified.
const fakeCallbackNode: unknown = {};

const shouldYield = unstable_shouldYield;
const requestPaint = unstable_requestPaint !== undefined ? unstable_requestPaint : () => {};

let syncQueue: SchedulerCallback[] | undefined;
let immediateQueueCallbackNode: unknown;
let isFlushingSyncQueue = false;
const initialTimeMs = unstable_now();

// Roblox's `unstable_now` uses `tick` under the hood, which is closer to a Unix
// timestamp. Subtract the module load time so the returned values stay small
// enough to fit within 32 bits, mirroring `performance.now()` in browsers.
function now(): number {
	return unstable_now() - initialTimeMs;
}

function getCurrentPriorityLevel(): ReactPriorityLevel {
	const currentPriorityLevel = unstable_getCurrentPriorityLevel();
	if (currentPriorityLevel === SchedulerImmediatePriority) {
		return ImmediatePriority;
	} else if (currentPriorityLevel === SchedulerUserBlockingPriority) {
		return UserBlockingPriority;
	} else if (currentPriorityLevel === SchedulerNormalPriority) {
		return NormalPriority;
	} else if (currentPriorityLevel === SchedulerLowPriority) {
		return LowPriority;
	} else if (currentPriorityLevel === SchedulerIdlePriority) {
		return IdlePriority;
	} else {
		invariant(false, 'Unknown priority level.');
		return NoPriority;
	}
}

function reactPriorityToSchedulerPriority(reactPriorityLevel: ReactPriorityLevel): PriorityLevel {
	if (reactPriorityLevel === ImmediatePriority) {
		return SchedulerImmediatePriority;
	} else if (reactPriorityLevel === UserBlockingPriority) {
		return SchedulerUserBlockingPriority;
	} else if (reactPriorityLevel === NormalPriority) {
		return SchedulerNormalPriority;
	} else if (reactPriorityLevel === LowPriority) {
		return SchedulerLowPriority;
	} else if (reactPriorityLevel === IdlePriority) {
		return SchedulerIdlePriority;
	} else {
		invariant(false, 'Unknown priority level.');
		return SchedulerNormalPriority;
	}
}

function runWithPriority<T>(reactPriorityLevel: ReactPriorityLevel, fn: () => T): T {
	const priorityLevel = reactPriorityToSchedulerPriority(reactPriorityLevel);
	return unstable_runWithPriority(priorityLevel, fn);
}

function scheduleCallback(
	reactPriorityLevel: ReactPriorityLevel,
	callback: SchedulerCallback,
	options?: SchedulerCallbackOptions
): unknown {
	const priorityLevel = reactPriorityToSchedulerPriority(reactPriorityLevel);
	return unstable_scheduleCallback(priorityLevel, callback as any, options as any);
}

function scheduleSyncCallback(callback: SchedulerCallback): unknown {
	// Push this callback into an internal queue. We'll flush these either in
	// the next tick, or earlier if something calls `flushSyncCallbackQueue`.
	if (syncQueue === undefined) {
		syncQueue = [callback];
		// Flush the queue in the next tick, at the earliest.
		immediateQueueCallbackNode = unstable_scheduleCallback(
			SchedulerImmediatePriority,
			flushSyncCallbackQueueImpl as unknown as SchedulerTaskCallback
		);
	} else {
		// Push onto the existing queue. Don't schedule another callback — one
		// was already scheduled when the queue was created.
		syncQueue.push(callback);
	}
	return fakeCallbackNode;
}

function cancelCallback(callbackNode: unknown): void {
	if (callbackNode !== fakeCallbackNode) {
		unstable_cancelCallback(callbackNode as never);
	}
}

function flushSyncCallbackQueue(): boolean {
	if (immediateQueueCallbackNode !== undefined) {
		const node = immediateQueueCallbackNode;
		immediateQueueCallbackNode = undefined;
		unstable_cancelCallback(node as never);
	}
	return flushSyncCallbackQueueImpl();
}

function flushSyncCallbackQueueImpl(): boolean {
	if (isFlushingSyncQueue || syncQueue === undefined) {
		return false;
	}

	// Prevent re-entrancy.
	isFlushingSyncQueue = true;

	let i = 0;
	let previousLanePriority: number | undefined;

	try {
		if (decoupleUpdatePriorityFromScheduler) {
			previousLanePriority = getCurrentUpdateLanePriority();
			setCurrentUpdateLanePriority(SyncLanePriority);
		}

		const isSync = true;
		const queue = syncQueue;

		const doFlush = () => {
			runWithPriority(ImmediatePriority, () => {
				for (const callback of queue) {
					i += 1;
					let current: SchedulerCallback | undefined = callback;
					do {
						current = current(isSync) as SchedulerCallback | undefined;
					} while (current !== undefined);
				}
			});
		};

		if (__YOLO__) {
			doFlush();
			syncQueue = undefined;
		} else {
			const [ok, result] = xpcall(doFlush, describeError);
			if (ok) {
				syncQueue = undefined;
			} else {
				// If something throws, leave the remaining callbacks on the queue.
				if (syncQueue !== undefined) {
					const remaining: SchedulerCallback[] = [];
					for (let j = i + 1; j <= queue.size(); j++) {
						remaining[j - i] = queue[j];
					}
					syncQueue = remaining;
				}
				// Resume flushing in the next tick.
				unstable_scheduleCallback(
					SchedulerImmediatePriority,
					flushSyncCallbackQueue as unknown as SchedulerTaskCallback
				);
				error(result);
			}
		}
	} finally {
		if (decoupleUpdatePriorityFromScheduler) {
			setCurrentUpdateLanePriority(previousLanePriority as number);
		}
		isFlushingSyncQueue = false;
	}

	return true;
}

export {
	ImmediatePriority,
	UserBlockingPriority,
	NormalPriority,
	LowPriority,
	IdlePriority,
	NoPriority,
	getCurrentPriorityLevel,
	flushSyncCallbackQueue,
	runWithPriority,
	scheduleCallback,
	scheduleSyncCallback,
	cancelCallback,
	now,
	requestPaint,
	shouldYield,
};
