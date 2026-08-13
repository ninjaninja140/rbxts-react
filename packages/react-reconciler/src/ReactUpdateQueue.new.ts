/**
 * Update queues for the fiber reconciler.
 *
 * UpdateQueue is a linked list of prioritized updates. Like fibers, update
 * queues come in pairs: a current queue (the visible state on screen) and a
 * work-in-progress queue that can be mutated while a render is in flight.
 * Both queues share a persistent, singly-linked list of updates.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactUpdateQueue.new.lua`.
 *
 * @module ReactUpdateQueue
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { assign, console, ConsolePatchingDev, describeError, ReactFeatureFlags } from '@nrbx/react-shared';

import type { Fiber, Lane, Lanes, SharedQueue, Update, UpdateQueue } from './types';
import { isSubsetOfLanes, mergeLanes, NoLane, NoLanes } from './ReactFiberLane';
import { Callback, DidCapture, ShouldCapture } from './ReactFiberFlags';
import { StrictMode } from './ReactTypeOfMode';
import { markSkippedUpdateLanes } from './ReactFiberWorkInProgress';
// Deviating from upstream's lazy require: NewContext only needs UpdateQueue's
// exports at call time, so a static import is safe as long as NewContext also
// reads its cyclic dependencies lazily.
import * as ReactFiberNewContext from './ReactFiberNewContext.new';

const { debugRenderPhaseSideEffectsForStrictMode } = ReactFeatureFlags;
const { disableLogs, reenableLogs } = ConsolePatchingDev;

export const UpdateState = 0;
export const ReplaceState = 1;
export const ForceUpdate = 2;
export const CaptureUpdate = 3;

// Global state that is reset at the beginning of calling `processUpdateQueue`.
// It should only be read right after calling `processUpdateQueue`, via
// `checkHasForceUpdateAfterProcessing`.
let hasForceUpdate = false;

let didWarnUpdateInsideUpdate: boolean | undefined;
let currentlyProcessingQueue: SharedQueue<any> | undefined;
if (__DEV__) {
	didWarnUpdateInsideUpdate = false;
	currentlyProcessingQueue = undefined;
}

/**
 * Resets the "currently processing" queue pointer. Only meaningful in
 * development builds, where it backs the update-inside-update warning.
 *
 * @internal
 */
export function resetCurrentlyProcessingQueue(): void {
	if (__DEV__) {
		currentlyProcessingQueue = undefined;
	}
}

// Object pool for update tables. Updates are created and discarded constantly
// during rendering, so recycling them avoids repeated table allocations.
const poolInitSize = 210;
const updatePool: Array<Update<any>> = [];
let updatePoolIndex = 0;
for (let i = 0; i < poolInitSize; i++) {
	updatePool.push({
		eventTime: -1,
		lane: -1,
		tag: -1,
		payload: undefined,
		callback: undefined,
		next: undefined,
	});
	updatePoolIndex += 1;
}

/**
 * Initializes a fiber's update queue from its memoized state.
 *
 * @internal
 */
export function initializeUpdateQueue<State>(fiber: Fiber): void {
	const queue: UpdateQueue<State> = {
		baseState: fiber.memoizedState,
		firstBaseUpdate: undefined,
		lastBaseUpdate: undefined,
		shared: {
			pending: undefined,
		},
		effects: undefined,
	};
	fiber.updateQueue = queue;
}

/**
 * Clones `current`'s update queue onto `workInProgress`, unless the queue is
 * already a clone.
 *
 * @internal
 */
export function cloneUpdateQueue<State>(current: Fiber, workInProgress: Fiber): void {
	const queue = workInProgress.updateQueue as UpdateQueue<State>;
	const currentQueue = current.updateQueue as UpdateQueue<State>;
	if (queue === currentQueue) {
		workInProgress.updateQueue = table.clone(currentQueue) as UpdateQueue<State>;
	}
}

/**
 * Creates an update record. Reuses a pooled record when one is available.
 *
 * @internal
 */
export function createUpdate(
	eventTime: number,
	lane: Lane,
	payload: any,
	callback?: (...args: Array<any>) => any
): Update<any> {
	if (updatePoolIndex > 0) {
		updatePoolIndex -= 1;
		const update = updatePool.pop()!;
		update.eventTime = eventTime;
		update.lane = lane;
		update.tag = UpdateState;
		update.payload = payload;
		update.callback = callback;
		return update;
	}

	return {
		eventTime,
		lane,
		tag: UpdateState,
		payload,
		callback,
		next: undefined,
	};
}

/**
 * Appends an update to a fiber's pending update queue.
 *
 * @internal
 */
export function enqueueUpdate<State>(fiber: Fiber, update: Update<State>): void {
	const updateQueue = fiber.updateQueue as UpdateQueue<State> | undefined;
	if (updateQueue === undefined) {
		// Only occurs if the fiber has been unmounted.
		return;
	}

	const sharedQueue = updateQueue.shared;
	const pending = sharedQueue.pending;
	if (pending === undefined) {
		// This is the first update. Create a circular list.
		update.next = update;
	} else {
		update.next = pending.next;
		pending.next = update;
	}
	sharedQueue.pending = update;

	if (__DEV__) {
		if (currentlyProcessingQueue === sharedQueue && !didWarnUpdateInsideUpdate) {
			console.error(
				'An update (setState, replaceState, or forceUpdate) was scheduled ' +
					'from inside an update function. Update functions should be pure, ' +
					'with zero side-effects. Consider using componentDidUpdate or a ' +
					'callback.'
			);
			didWarnUpdateInsideUpdate = true;
		}
	}
}

/**
 * Appends a captured update to the work-in-progress queue. Captured updates
 * are thrown by a child during the render phase and must be discarded if the
 * render is aborted, so they are only ever written to the work-in-progress
 * queue.
 *
 * @internal
 */
export function enqueueCapturedUpdate<State>(workInProgress: Fiber, capturedUpdate: Update<State>): void {
	let queue = workInProgress.updateQueue as UpdateQueue<State>;

	// Check if the work-in-progress queue is a clone.
	const current = workInProgress.alternate;
	if (current !== undefined) {
		const currentQueue = current.updateQueue as UpdateQueue<State>;
		if (queue === currentQueue) {
			// The work-in-progress queue is the same as current. This happens when
			// we bail out on a parent fiber that then captures an error thrown by
			// a child. Since we want to append the update only to the work-in
			// -progress queue, we need to clone the updates.
			let newFirst: Update<State> | undefined;
			let newLast: Update<State> | undefined;
			const firstBaseUpdate = queue.firstBaseUpdate;
			if (firstBaseUpdate !== undefined) {
				// Loop through the updates and clone them.
				let update: Update<State> | undefined = firstBaseUpdate;
				while (update !== undefined) {
					const clone: Update<State> = {
						eventTime: update.eventTime,
						lane: update.lane,
						tag: update.tag,
						payload: update.payload,
						callback: update.callback,
						next: undefined,
					};
					if (newLast === undefined) {
						newFirst = clone;
						newLast = clone;
					} else {
						newLast.next = clone;
						newLast = clone;
					}
					update = update.next;
				}

				// Append the captured update to the end of the cloned list.
				if (newLast === undefined) {
					newFirst = capturedUpdate;
					newLast = capturedUpdate;
				} else {
					newLast.next = capturedUpdate;
					newLast = capturedUpdate;
				}
			} else {
				// There are no base updates.
				newFirst = capturedUpdate;
				newLast = capturedUpdate;
			}
			queue = {
				baseState: currentQueue.baseState,
				firstBaseUpdate: newFirst,
				lastBaseUpdate: newLast,
				shared: currentQueue.shared,
				effects: currentQueue.effects,
			};
			workInProgress.updateQueue = queue;
			return;
		}
	}

	// Append the update to the end of the list.
	const lastBaseUpdate = queue.lastBaseUpdate;
	if (lastBaseUpdate === undefined) {
		queue.firstBaseUpdate = capturedUpdate;
	} else {
		lastBaseUpdate.next = capturedUpdate;
	}
	queue.lastBaseUpdate = capturedUpdate;
}

/**
 * Applies a single update to `prevState`, returning the next state.
 *
 * @internal
 */
export function getStateFromUpdate<State>(
	workInProgress: Fiber,
	_queue: UpdateQueue<State>,
	update: Update<State>,
	prevState: State,
	nextProps: any,
	_instance: any
): any {
	const updateTag = update.tag;
	if (updateTag === ReplaceState) {
		const payload = update.payload;
		if (type(payload) === 'function') {
			// Updater function
			if (__DEV__) {
				ReactFiberNewContext.enterDisallowedContextReadInDEV();
			}
			const updater = payload as (prev: State, props: unknown) => State;
			const nextState = updater(prevState, nextProps);
			if (__DEV__) {
				if (debugRenderPhaseSideEffectsForStrictMode && bit32.band(workInProgress.mode, StrictMode) !== 0) {
					disableLogs();
					const [ok, result] = xpcall(
						updater as (a: unknown, b: unknown) => unknown,
						describeError,
						prevState as unknown,
						nextProps as unknown
					) as LuaTuple<[boolean, unknown]>;
					reenableLogs();

					if (!ok) {
						error(result);
					}
				}
				ReactFiberNewContext.exitDisallowedContextReadInDEV();
			}
			return nextState;
		}
		// State object
		return payload;
	} else if (updateTag === CaptureUpdate || updateTag === UpdateState) {
		if (updateTag === CaptureUpdate) {
			workInProgress.flags = bit32.bor(bit32.band(workInProgress.flags, bit32.bnot(ShouldCapture)), DidCapture);
		}
		// Intentional fallthrough
		const payload = update.payload;
		let partialState: unknown;
		if (type(payload) === 'function') {
			// Updater function
			if (__DEV__) {
				ReactFiberNewContext.enterDisallowedContextReadInDEV();
			}
			const updater = payload as (prev: State, props: unknown) => State;
			partialState = updater(prevState, nextProps);
			if (__DEV__) {
				if (debugRenderPhaseSideEffectsForStrictMode && bit32.band(workInProgress.mode, StrictMode) !== 0) {
					disableLogs();
					const [ok, result] = xpcall(
						updater as (a: unknown, b: unknown) => unknown,
						describeError,
						prevState as unknown,
						nextProps as unknown
					) as LuaTuple<[boolean, unknown]>;
					reenableLogs();

					if (!ok) {
						error(result);
					}
				}
				ReactFiberNewContext.exitDisallowedContextReadInDEV();
			}
		} else {
			// Partial state object
			partialState = payload;
		}
		if (partialState === undefined) {
			// Undefined is treated as a no-op.
			return prevState;
		}
		// Merge the partial state and the previous state.
		return assign({}, prevState as object, partialState as object);
	} else if (updateTag === ForceUpdate) {
		hasForceUpdate = true;
		return prevState;
	}
	return prevState;
}

/**
 * Processes the pending updates on a fiber, applying those with sufficient
 * priority to compute the next memoized state.
 *
 * @internal
 */
export function processUpdateQueue<State>(workInProgress: Fiber, props: any, instance: any, renderLanes: Lanes): void {
	// This is always non-null on a ClassComponent or HostRoot.
	const queue = workInProgress.updateQueue as UpdateQueue<State>;

	hasForceUpdate = false;

	if (__DEV__) {
		currentlyProcessingQueue = queue.shared;
	}

	let firstBaseUpdate = queue.firstBaseUpdate;
	let lastBaseUpdate = queue.lastBaseUpdate;

	// Check if there are pending updates. If so, transfer them to the base queue.
	let pendingQueue = queue.shared.pending;
	if (pendingQueue !== undefined) {
		queue.shared.pending = undefined;

		// The pending queue is circular. Disconnect the pointer between first
		// and last so that it's non-circular.
		const lastPendingUpdate = pendingQueue;
		const firstPendingUpdate = lastPendingUpdate.next;
		lastPendingUpdate.next = undefined;
		// Append pending updates to base queue.
		if (lastBaseUpdate === undefined) {
			firstBaseUpdate = firstPendingUpdate;
		} else {
			lastBaseUpdate.next = firstPendingUpdate;
		}
		lastBaseUpdate = lastPendingUpdate;

		// If there's a current queue, and it's different from the base queue, then
		// we need to transfer the updates to that queue, too.
		const current = workInProgress.alternate;
		if (current !== undefined) {
			const currentQueue = current.updateQueue as UpdateQueue<State>;
			const currentLastBaseUpdate = currentQueue.lastBaseUpdate;
			if (currentLastBaseUpdate !== lastBaseUpdate) {
				if (currentLastBaseUpdate === undefined) {
					currentQueue.firstBaseUpdate = firstPendingUpdate;
				} else {
					currentLastBaseUpdate.next = firstPendingUpdate;
				}
				currentQueue.lastBaseUpdate = lastPendingUpdate;
			}
		}
	}

	// These values may change as we process the queue.
	if (firstBaseUpdate !== undefined) {
		// Iterate through the list of updates to compute the result.
		let newState = queue.baseState;
		let newLanes: Lanes = NoLanes;

		let newBaseState: State | undefined;
		let newFirstBaseUpdate: Update<State> | undefined;
		let newLastBaseUpdate: Update<State> | undefined;

		let update: Update<State> | undefined = firstBaseUpdate;
		while (update !== undefined) {
			const updateLane = update.lane;
			const updateEventTime = update.eventTime;
			if (!isSubsetOfLanes(renderLanes, updateLane)) {
				// Priority is insufficient. Skip this update.
				const clone: Update<State> = {
					eventTime: updateEventTime,
					lane: updateLane,
					tag: update.tag,
					payload: update.payload,
					callback: update.callback,
					next: undefined,
				};
				if (newLastBaseUpdate === undefined) {
					newFirstBaseUpdate = clone;
					newLastBaseUpdate = clone;
					newBaseState = newState;
				} else {
					newLastBaseUpdate.next = clone;
					newLastBaseUpdate = clone;
				}
				// Update the remaining priority in the queue.
				newLanes = mergeLanes(newLanes, updateLane);
			} else {
				// This update does have sufficient priority.
				if (newLastBaseUpdate !== undefined) {
					const clone: Update<State> = {
						eventTime: updateEventTime,
						// This update is going to be committed so we never want to
						// uncommit it. Using NoLane works because 0 is a subset of all
						// bitmasks, so this will never be skipped by the check above.
						lane: NoLane,
						tag: update.tag,
						payload: update.payload,
						callback: update.callback,
						next: undefined,
					};
					newLastBaseUpdate.next = clone;
					newLastBaseUpdate = clone;
				}

				// Process this update.
				newState = getStateFromUpdate(workInProgress, queue, update, newState, props, instance);
				const callback = update.callback;
				if (callback !== undefined && update.lane !== NoLane) {
					workInProgress.flags = bit32.bor(workInProgress.flags, Callback);
					const effects = queue.effects;
					if (effects === undefined) {
						queue.effects = [update];
					} else {
						effects.push(update);
					}
				}
			}

			update = update.next;
			if (update === undefined) {
				pendingQueue = queue.shared.pending;
				if (pendingQueue === undefined) {
					break;
				} else {
					// An update was scheduled from inside a reducer. Add the new
					// pending updates to the end of the list and keep processing.
					const lastPendingUpdate = pendingQueue;
					// Intentionally unsound: pending updates form a circular list,
					// but we unravel them when transferring them to the base queue.
					const firstPendingUpdate = lastPendingUpdate.next as Update<State>;
					lastPendingUpdate.next = undefined;
					update = firstPendingUpdate;
					queue.lastBaseUpdate = lastPendingUpdate;
					queue.shared.pending = undefined;
				}
			}
		}

		if (newLastBaseUpdate === undefined) {
			newBaseState = newState;
		}

		queue.baseState = newBaseState as State;
		queue.firstBaseUpdate = newFirstBaseUpdate;
		queue.lastBaseUpdate = newLastBaseUpdate;

		markSkippedUpdateLanes(newLanes);
		workInProgress.lanes = newLanes;
		workInProgress.memoizedState = newState;
	}

	if (__DEV__) {
		currentlyProcessingQueue = undefined;
	}
}

function callCallback(callback: (...args: Array<any>) => any, context: unknown): void {
	if (type(callback) !== 'function') {
		error(`Invalid argument passed as callback. Expected a function. Instead received: ${tostring(callback)}`);
	}
	callback(context);
}

/**
 * Resets the force-update flag before processing a queue.
 *
 * @internal
 */
export function resetHasForceUpdateBeforeProcessing(): void {
	hasForceUpdate = false;
}

/**
 * Returns whether a force update was encountered while processing the queue.
 *
 * @internal
 */
export function checkHasForceUpdateAfterProcessing(): boolean {
	return hasForceUpdate;
}

/**
 * Commits the callbacks collected by an update queue, then returns the update
 * records to the pool.
 *
 * @internal
 */
export function commitUpdateQueue<State>(_finishedWork: Fiber, finishedQueue: UpdateQueue<State>, instance: any): void {
	const effects = finishedQueue.effects;
	finishedQueue.effects = undefined;
	if (effects !== undefined) {
		for (const effect of effects) {
			const callback = effect.callback;
			if (callback !== undefined) {
				callCallback(callback, instance);
			}

			// Return this object to the pool.
			table.clear(effect);
			updatePool.push(effect);
			updatePoolIndex += 1;
		}
	}
}
