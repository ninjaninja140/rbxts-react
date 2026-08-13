/**
 * Lanes are a priority model for scheduling updates. Each lane is a bit in a
 * 31-bit integer; higher bits represent higher priority. The reconciler uses
 * lanes to decide what work to render next and to model suspensions, retries,
 * and entanglements between updates.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberLane.lua`.
 *
 * @module ReactFiberLane
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { console, invariant } from '@nrbx/react-shared';
import type { FiberRoot, Lane, LaneMap, LanePriority, Lanes, ReactPriorityLevel } from './types';
import {
	IdlePriority as IdleSchedulerPriority,
	ImmediatePriority as ImmediateSchedulerPriority,
	LowPriority as LowSchedulerPriority,
	NoPriority as NoSchedulerPriority,
	NormalPriority as NormalSchedulerPriority,
	UserBlockingPriority as UserBlockingSchedulerPriority,
} from './ReactFiberSchedulerPriorities.roblox';

export const SyncLanePriority: LanePriority = 15;
export const SyncBatchedLanePriority: LanePriority = 14;

const InputDiscreteHydrationLanePriority: LanePriority = 13;
export const InputDiscreteLanePriority: LanePriority = 12;

const InputContinuousHydrationLanePriority: LanePriority = 11;
export const InputContinuousLanePriority: LanePriority = 10;

const DefaultHydrationLanePriority: LanePriority = 9;
export const DefaultLanePriority: LanePriority = 8;

const TransitionHydrationPriority: LanePriority = 7;
export const TransitionPriority: LanePriority = 6;

const RetryLanePriority: LanePriority = 5;

const SelectiveHydrationLanePriority: LanePriority = 4;

const IdleHydrationLanePriority: LanePriority = 3;
const IdleLanePriority: LanePriority = 2;

const OffscreenLanePriority: LanePriority = 1;

export const NoLanePriority: LanePriority = 0;

export const NoLanes: Lanes = 0b0000000000000000000000000000000;
export const NoLane: Lane = 0b0000000000000000000000000000000;

export const SyncLane: Lane = 0b0000000000000000000000000000001;
export const SyncBatchedLane: Lanes = 0b0000000000000000000000000000010;

export const InputDiscreteHydrationLane: Lane = 0b0000000000000000000000000000100;
const InputDiscreteLanes: Lanes = 0b0000000000000000000000000011000;

const InputContinuousHydrationLane: Lane = 0b0000000000000000000000000100000;
const InputContinuousLanes: Lanes = 0b0000000000000000000000011000000;

export const DefaultHydrationLane: Lane = 0b0000000000000000000000100000000;
export const DefaultLanes: Lanes = 0b0000000000000000000111000000000;

const TransitionHydrationLane: Lane = 0b0000000000000000001000000000000;
const TransitionLanes: Lanes = 0b0000000001111111110000000000000;

export const RetryLanes: Lanes = 0b0000011110000000000000000000000;
export const SomeRetryLane: Lanes = 0b0000010000000000000000000000000;

export const SelectiveHydrationLane: Lane = 0b0000100000000000000000000000000;

const NonIdleLanes = 0b0000111111111111111111111111111;

export const IdleHydrationLane: Lane = 0b0001000000000000000000000000000;
const IdleLanes: Lanes = 0b0110000000000000000000000000000;

export const OffscreenLane: Lane = 0b1000000000000000000000000000000;

export const NoTimestamp = -1;

let currentUpdateLanePriority: LanePriority = NoLanePriority;

/**
 * Returns the lane priority currently in scope for update scheduling.
 */
export function getCurrentUpdateLanePriority(): LanePriority {
	return currentUpdateLanePriority;
}

/**
 * Sets the lane priority used for subsequently scheduled updates.
 */
export function setCurrentUpdateLanePriority(newLanePriority: LanePriority): void {
	currentUpdateLanePriority = newLanePriority;
}

// "Register" used by getHighestPriorityLanes and getNextLanes to "return" two
// values (the selected lanes and their priority) from a single call.
let return_highestLanePriority: LanePriority = DefaultLanePriority;

function getHighestPriorityLanes(lanes: Lanes | Lane): Lanes {
	if (bit32.band(SyncLane, lanes) !== NoLanes) {
		return_highestLanePriority = SyncLanePriority;
		return SyncLane;
	}
	if (bit32.band(SyncBatchedLane, lanes) !== NoLanes) {
		return_highestLanePriority = SyncBatchedLanePriority;
		return SyncBatchedLane;
	}
	if (bit32.band(InputDiscreteHydrationLane, lanes) !== NoLanes) {
		return_highestLanePriority = InputDiscreteHydrationLanePriority;
		return InputDiscreteHydrationLane;
	}
	const inputDiscreteLanes = bit32.band(InputDiscreteLanes, lanes);
	if (inputDiscreteLanes !== NoLanes) {
		return_highestLanePriority = InputDiscreteLanePriority;
		return inputDiscreteLanes;
	}
	if (bit32.band(lanes, InputContinuousHydrationLane) !== NoLanes) {
		return_highestLanePriority = InputContinuousHydrationLanePriority;
		return InputContinuousHydrationLane;
	}
	const inputContinuousLanes = bit32.band(InputContinuousLanes, lanes);
	if (inputContinuousLanes !== NoLanes) {
		return_highestLanePriority = InputContinuousLanePriority;
		return inputContinuousLanes;
	}
	if (bit32.band(lanes, DefaultHydrationLane) !== NoLanes) {
		return_highestLanePriority = DefaultHydrationLanePriority;
		return DefaultHydrationLane;
	}
	const defaultLanes = bit32.band(DefaultLanes, lanes);
	if (defaultLanes !== NoLanes) {
		return_highestLanePriority = DefaultLanePriority;
		return defaultLanes;
	}
	if (bit32.band(lanes, TransitionHydrationLane) !== NoLanes) {
		return_highestLanePriority = TransitionHydrationPriority;
		return TransitionHydrationLane;
	}
	const transitionLanes = bit32.band(TransitionLanes, lanes);
	if (transitionLanes !== NoLanes) {
		return_highestLanePriority = TransitionPriority;
		return transitionLanes;
	}
	const retryLanes = bit32.band(RetryLanes, lanes);
	if (retryLanes !== NoLanes) {
		return_highestLanePriority = RetryLanePriority;
		return retryLanes;
	}
	if (bit32.band(lanes, SelectiveHydrationLane) !== 0) {
		return_highestLanePriority = SelectiveHydrationLanePriority;
		return SelectiveHydrationLane;
	}
	if (bit32.band(lanes, IdleHydrationLane) !== NoLanes) {
		return_highestLanePriority = IdleHydrationLanePriority;
		return IdleHydrationLane;
	}
	const idleLanes = bit32.band(IdleLanes, lanes);
	if (idleLanes !== NoLanes) {
		return_highestLanePriority = IdleLanePriority;
		return idleLanes;
	}
	if (bit32.band(OffscreenLane, lanes) !== NoLanes) {
		return_highestLanePriority = OffscreenLanePriority;
		return OffscreenLane;
	}
	if (__DEV__) {
		console.error('Should have found matching lanes. This is a bug in React.');
	}
	// This shouldn't be reachable, but as a fallback, return the entire bitmask.
	return_highestLanePriority = DefaultLanePriority;
	return lanes;
}

/**
 * Maps a scheduler priority level to its equivalent lane priority.
 */
export function schedulerPriorityToLanePriority(schedulerPriorityLevel: ReactPriorityLevel): LanePriority {
	if (schedulerPriorityLevel === ImmediateSchedulerPriority) {
		return SyncLanePriority;
	} else if (schedulerPriorityLevel === UserBlockingSchedulerPriority) {
		return InputContinuousLanePriority;
	} else if (schedulerPriorityLevel === NormalSchedulerPriority || schedulerPriorityLevel === LowSchedulerPriority) {
		// TODO: Handle LowSchedulerPriority, somehow. Maybe the same lane as hydration.
		return DefaultLanePriority;
	} else if (schedulerPriorityLevel === IdleSchedulerPriority) {
		return IdleLanePriority;
	} else {
		return NoLanePriority;
	}
}

/**
 * Maps a lane priority back to a scheduler priority level.
 */
export function lanePriorityToSchedulerPriority(lanePriority: LanePriority): ReactPriorityLevel {
	if (lanePriority === SyncLanePriority || lanePriority === SyncBatchedLanePriority) {
		return ImmediateSchedulerPriority;
	} else if (
		lanePriority === InputDiscreteHydrationLanePriority ||
		lanePriority === InputDiscreteLanePriority ||
		lanePriority === InputContinuousHydrationLanePriority ||
		lanePriority === InputContinuousLanePriority
	) {
		return UserBlockingSchedulerPriority;
	} else if (
		lanePriority === DefaultHydrationLanePriority ||
		lanePriority === DefaultLanePriority ||
		lanePriority === TransitionHydrationPriority ||
		lanePriority === TransitionPriority ||
		lanePriority === SelectiveHydrationLanePriority ||
		lanePriority === RetryLanePriority
	) {
		return NormalSchedulerPriority;
	} else if (
		lanePriority === IdleHydrationLanePriority ||
		lanePriority === IdleLanePriority ||
		lanePriority === OffscreenLanePriority
	) {
		return IdleSchedulerPriority;
	} else if (lanePriority === NoLanePriority) {
		return NoSchedulerPriority;
	} else {
		invariant(false, 'Invalid update priority: %s. This is a bug in React.', lanePriority);
		error('unreachable');
	}
}

/**
 * Picks the next set of lanes to work on for a root, given the lanes
 * currently being worked on.
 */
export function getNextLanes(root: FiberRoot, wipLanes: Lanes): Lanes {
	// Early bailout if there's no pending work left.
	const pendingLanes = root.pendingLanes;
	if (pendingLanes === NoLanes) {
		return_highestLanePriority = NoLanePriority;
		return NoLanes;
	}

	let nextLanes = NoLanes;
	let nextLanePriority = NoLanePriority;

	const expiredLanes = root.expiredLanes;
	const suspendedLanes = root.suspendedLanes;
	const pingedLanes = root.pingedLanes;

	// Check if any work has expired.
	if (expiredLanes !== NoLanes) {
		nextLanes = expiredLanes;
		return_highestLanePriority = SyncLanePriority;
		nextLanePriority = SyncLanePriority;
	} else {
		// Do not work on any idle work until all the non-idle work has finished,
		// even if the work is suspended.
		const nonIdlePendingLanes = bit32.band(pendingLanes, NonIdleLanes);
		if (nonIdlePendingLanes !== NoLanes) {
			const nonIdleUnblockedLanes = bit32.band(nonIdlePendingLanes, bit32.bnot(suspendedLanes));
			if (nonIdleUnblockedLanes !== NoLanes) {
				nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);
				nextLanePriority = return_highestLanePriority;
			} else {
				const nonIdlePingedLanes = bit32.band(nonIdlePendingLanes, pingedLanes);
				if (nonIdlePingedLanes !== NoLanes) {
					nextLanes = getHighestPriorityLanes(nonIdlePingedLanes);
					nextLanePriority = return_highestLanePriority;
				}
			}
		} else {
			// The only remaining work is Idle.
			const unblockedLanes = bit32.band(pendingLanes, bit32.bnot(suspendedLanes));
			if (unblockedLanes !== NoLanes) {
				nextLanes = getHighestPriorityLanes(unblockedLanes);
				nextLanePriority = return_highestLanePriority;
			} else {
				if (pingedLanes !== NoLanes) {
					nextLanes = getHighestPriorityLanes(pingedLanes);
					nextLanePriority = return_highestLanePriority;
				}
			}
		}
	}

	if (nextLanes === NoLanes) {
		// This should only be reachable if we're suspended.
		return NoLanes;
	}

	// If there are higher priority lanes, we'll include them even if they are
	// suspended. Inlined getEqualOrHigherPriorityLanes for the hot path.
	nextLanes = bit32.band(pendingLanes, bit32.lshift(getLowestPriorityLane(nextLanes), 1) - 1);

	// If we're already in the middle of a render, switching lanes will interrupt
	// it and we'll lose our progress. We should only do this if the new lanes
	// are higher priority.
	if (
		wipLanes !== NoLanes &&
		wipLanes !== nextLanes &&
		// If we already suspended with a delay, then interrupting is fine.
		bit32.band(wipLanes, suspendedLanes) === NoLanes
	) {
		getHighestPriorityLanes(wipLanes);
		const wipLanePriority = return_highestLanePriority;
		if (nextLanePriority <= wipLanePriority) {
			return wipLanes;
		} else {
			return_highestLanePriority = nextLanePriority;
		}
	}

	// Check for entangled lanes and add them to the batch. Entanglement means
	// two updates must render together, typically because they share a source.
	const entangledLanes = root.entangledLanes;
	if (entangledLanes !== NoLanes) {
		const entanglements = root.entanglements;
		let lanes = bit32.band(nextLanes, entangledLanes);
		while (lanes > 0) {
			const index = pickArbitraryLaneIndex(lanes);
			const lane = bit32.lshift(1, index);

			nextLanes = bit32.bor(nextLanes, entanglements[index]);

			lanes = bit32.band(lanes, bit32.bnot(lane));
		}
	}

	return nextLanes;
}

/**
 * Returns the most recent event time among the given lanes.
 */
export function getMostRecentEventTime(root: FiberRoot, lanes: Lanes): number {
	const eventTimes = root.eventTimes;

	let mostRecentEventTime = NoTimestamp;
	let lanes_ = lanes;
	while (lanes_ > 0) {
		const index = pickArbitraryLaneIndex(lanes_);
		const lane = bit32.lshift(1, index);

		const eventTime = eventTimes[index];
		if (eventTime > mostRecentEventTime) {
			mostRecentEventTime = eventTime;
		}

		lanes_ = bit32.band(lanes_, bit32.bnot(lane));
	}

	return mostRecentEventTime;
}

/**
 * Computes when a lane's update should be considered starved and forced to
 * finish (or `NoTimestamp` if the lane never expires).
 */
export function computeExpirationTime(lane: Lane, currentTime: number): number {
	getHighestPriorityLanes(lane);
	const priority = return_highestLanePriority;
	if (priority >= InputContinuousLanePriority) {
		// User interactions should expire slightly more quickly.
		return currentTime + 250;
	} else if (priority >= TransitionPriority) {
		return currentTime + 5000;
	} else {
		// Anything idle priority or lower should never expire.
		return NoTimestamp;
	}
}

/**
 * Marks any pending lanes whose expiration time has passed as expired.
 */
export function markStarvedLanesAsExpired(root: FiberRoot, currentTime: number): void {
	const pendingLanes = root.pendingLanes;
	const suspendedLanes = root.suspendedLanes;
	const pingedLanes = root.pingedLanes;
	const expirationTimes = root.expirationTimes;

	let lanes = pendingLanes;
	while (lanes > 0) {
		const index = pickArbitraryLaneIndex(lanes);
		const lane = bit32.lshift(1, index);

		const expirationTime = expirationTimes[index];
		if (expirationTime === NoTimestamp) {
			// Found a pending lane with no expiration time. If it's not suspended,
			// or if it's pinged, assume it's CPU-bound and compute a new expiration.
			if (bit32.band(lane, suspendedLanes) === NoLanes || bit32.band(lane, pingedLanes) !== NoLanes) {
				// Assumes timestamps are monotonically increasing.
				expirationTimes[index] = computeExpirationTime(lane, currentTime);
			}
		} else if (expirationTime <= currentTime) {
			// This lane expired.
			root.expiredLanes = bit32.bor(root.expiredLanes, lane);
		}

		lanes = bit32.band(lanes, bit32.bnot(lane));
	}
}

/**
 * Returns the highest priority pending lanes regardless of whether they are
 * suspended.
 */
export function getHighestPriorityPendingLanes(root: FiberRoot): Lanes {
	return getHighestPriorityLanes(root.pendingLanes);
}

/**
 * Returns the lanes to retry synchronously after an error.
 */
export function getLanesToRetrySynchronouslyOnError(root: FiberRoot): Lanes {
	const everythingButOffscreen = bit32.band(root.pendingLanes, bit32.bnot(OffscreenLane));
	if (everythingButOffscreen !== NoLanes) {
		return everythingButOffscreen;
	}
	if (bit32.band(everythingButOffscreen, OffscreenLane) !== 0) {
		return OffscreenLane;
	}
	return NoLanes;
}

/**
 * Returns the priority of the lanes most recently selected by `getNextLanes`.
 */
export function returnNextLanesPriority(): LanePriority {
	return return_highestLanePriority;
}

/**
 * Returns true when the lanes contain any non-idle work.
 */
export function includesNonIdleWork(lanes: Lanes): boolean {
	return bit32.band(lanes, NonIdleLanes) !== NoLanes;
}

/**
 * Returns true when the lanes contain only retry lanes.
 */
export function includesOnlyRetries(lanes: Lanes): boolean {
	return bit32.band(lanes, RetryLanes) === lanes;
}

/**
 * Returns true when the lanes contain only transition lanes.
 */
export function includesOnlyTransitions(lanes: Lanes): boolean {
	return bit32.band(lanes, TransitionLanes) === lanes;
}

/**
 * Picks a single lane for an update at the given priority, avoiding lanes
 * already being worked on.
 */
export function findUpdateLane(lanePriority: LanePriority, wipLanes: Lanes): Lane {
	if (lanePriority === NoLanePriority) {
		// No work to schedule.
	} else if (lanePriority === SyncLanePriority) {
		return SyncLane;
	} else if (lanePriority === SyncBatchedLanePriority) {
		return SyncBatchedLane;
	} else if (lanePriority === InputDiscreteLanePriority) {
		const lane = pickArbitraryLane(bit32.band(InputDiscreteLanes, bit32.bnot(wipLanes)));
		if (lane === NoLane) {
			// Shift to the next priority level.
			return findUpdateLane(InputContinuousLanePriority, wipLanes);
		}
		return lane;
	} else if (lanePriority === InputContinuousLanePriority) {
		const lane = pickArbitraryLane(bit32.band(InputContinuousLanes, bit32.bnot(wipLanes)));
		if (lane === NoLane) {
			// Shift to the next priority level.
			return findUpdateLane(DefaultLanePriority, wipLanes);
		}
		return lane;
	} else if (lanePriority === DefaultLanePriority) {
		let lane = pickArbitraryLane(bit32.band(DefaultLanes, bit32.bnot(wipLanes)));
		if (lane === NoLane) {
			// If all the default lanes are already being worked on, look for a
			// lane in the transition range.
			lane = pickArbitraryLane(bit32.band(TransitionLanes, bit32.bnot(wipLanes)));
			if (lane === NoLane) {
				// All the transition lanes are taken, too. This should be very rare,
				// but as a last resort, pick a default lane. This will interrupt the
				// current work-in-progress render.
				lane = pickArbitraryLane(DefaultLanes);
			}
		}
		return lane;
	} else if (
		lanePriority === TransitionPriority || // Should be handled by findTransitionLane instead.
		lanePriority === RetryLanePriority // Should be handled by findRetryLane instead.
	) {
		// No work to schedule.
	} else if (lanePriority === IdleLanePriority) {
		let lane = pickArbitraryLane(bit32.band(IdleLanes, bit32.bnot(wipLanes)));
		if (lane === NoLane) {
			lane = pickArbitraryLane(IdleLanes);
		}
		return lane;
	}
	// The remaining priorities are not valid for updates.
	invariant(false, 'Invalid update priority: %s. This is a bug in React.', lanePriority);
	error('unreachable');
}

/**
 * Picks a lane for a transition update, preferring lanes without pending work.
 */
export function findTransitionLane(wipLanes: Lanes, pendingLanes: Lanes): Lane {
	// First look for lanes that are completely unclaimed, i.e. have no pending work.
	let lane = pickArbitraryLane(bit32.band(TransitionLanes, bit32.bnot(pendingLanes)));
	if (lane === NoLane) {
		// If all lanes have pending work, look for a lane that isn't currently
		// being worked on.
		lane = pickArbitraryLane(bit32.band(TransitionLanes, bit32.bnot(wipLanes)));
		if (lane === NoLane) {
			// If everything is being worked on, pick any lane. This interrupts the
			// current work-in-progress.
			lane = pickArbitraryLane(TransitionLanes);
		}
	}
	return lane;
}

/**
 * Picks a lane for a Suspense retry, avoiding lanes already being worked on.
 */
export function findRetryLane(wipLanes: Lanes): Lane {
	let lane = pickArbitraryLane(bit32.band(RetryLanes, bit32.bnot(wipLanes)));
	if (lane === NoLane) {
		lane = pickArbitraryLane(RetryLanes);
	}
	return lane;
}

function getHighestPriorityLane(lanes: Lanes): Lane {
	return bit32.band(lanes, -lanes);
}

function getLowestPriorityLane(lanes: Lanes): Lane {
	// This finds the most significant non-zero bit.
	const index = 31 - bit32.countlz(lanes);
	if (index < 0) {
		return NoLanes;
	} else {
		return bit32.lshift(1, index);
	}
}

function _getEqualOrHigherPriorityLanes(lanes: Lanes | Lane): Lanes {
	return bit32.lshift(getLowestPriorityLane(lanes), 1) - 1;
}

/**
 * Picks any lane from the mask. Which one doesn't matter for correctness.
 */
export function pickArbitraryLane(lanes: Lanes): Lane {
	return getHighestPriorityLane(lanes);
}

function pickArbitraryLaneIndex(lanes: Lanes): number {
	return 31 - bit32.countlz(lanes);
}

/**
 * Returns true when `a` and `b` share at least one lane.
 */
export function includesSomeLane(a: Lanes | Lane, b: Lanes | Lane): boolean {
	return bit32.band(a, b) !== NoLanes;
}

/**
 * Returns true when `subset` is fully contained in `set`.
 */
export function isSubsetOfLanes(set: Lanes, subset: Lanes | Lane): boolean {
	return bit32.band(set, subset) === subset;
}

/**
 * Merges two lane masks.
 */
export function mergeLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
	return bit32.bor(a, b);
}

/**
 * Removes `subset` from `set`.
 */
export function removeLanes(set: Lanes, subset: Lanes | Lane): Lanes {
	return bit32.band(set, bit32.bnot(subset));
}

/**
 * Treats a single lane as a group of lanes (changes the type only).
 */
export function laneToLanes(lane: Lane): Lanes {
	return lane;
}

/**
 * Returns the higher priority of two lanes.
 */
export function higherPriorityLane(a: Lane, b: Lane): Lane {
	// This works because the bit ranges decrease in priority as you go left.
	if (a !== NoLane && b !== NoLane) {
		if (a < b) {
			return a;
		}
		return b;
	} else {
		if (a !== NoLane) {
			return a;
		}
		return b;
	}
}

/**
 * Returns the higher of two lane priorities.
 */
export function higherLanePriority(a: LanePriority, b: LanePriority): LanePriority {
	if (a !== NoLanePriority && a > b) {
		return a;
	} else {
		return b;
	}
}

/**
 * Creates a new lane-indexed map where every slot is pre-filled with
 * `initial`.
 */
export function createLaneMap<T>(initial: T): LaneMap<T> {
	const laneMap: LaneMap<T> = {
		0: initial,
		1: initial,
		2: initial,
		3: initial,
		4: initial,
		5: initial,
		6: initial,
		7: initial,
		8: initial,
		9: initial,
		10: initial,
		11: initial,
		12: initial,
		13: initial,
		14: initial,
		15: initial,
		16: initial,
		17: initial,
		18: initial,
		19: initial,
		20: initial,
		21: initial,
		22: initial,
		23: initial,
		24: initial,
		25: initial,
		26: initial,
		27: initial,
		28: initial,
		29: initial,
		30: initial,
		31: initial,
	};
	return laneMap;
}

/**
 * Records that a lane has new pending work at `eventTime`.
 */
export function markRootUpdated(root: FiberRoot, updateLane: Lane, eventTime: number): void {
	root.pendingLanes = bit32.bor(root.pendingLanes, updateLane);

	// Unsuspend any update at equal or lower priority.
	const higherPriorityLanes = updateLane - 1; // Turns 0b1000 into 0b0111.

	root.suspendedLanes = bit32.band(root.suspendedLanes, higherPriorityLanes);
	root.pingedLanes = bit32.band(root.pingedLanes, higherPriorityLanes);

	const eventTimes = root.eventTimes;
	const index = 31 - bit32.countlz(updateLane);
	// We can always overwrite an existing timestamp because we prefer the most
	// recent event, and we assume time is monotonically increasing.
	eventTimes[index] = eventTime;
}

/**
 * Records that a set of lanes has suspended.
 */
export function markRootSuspended(root: FiberRoot, suspendedLanes: Lanes): void {
	root.suspendedLanes = bit32.bor(root.suspendedLanes, suspendedLanes);
	root.pingedLanes = bit32.band(root.pingedLanes, bit32.bnot(suspendedLanes));

	// The suspended lanes are no longer CPU-bound. Clear their expiration times.
	const expirationTimes = root.expirationTimes;
	let lanes = suspendedLanes;
	while (lanes > 0) {
		const index = pickArbitraryLaneIndex(lanes);
		const lane = bit32.lshift(1, index);

		expirationTimes[index] = NoTimestamp;

		lanes = bit32.band(lanes, bit32.bnot(lane));
	}
}

/**
 * Records that a suspended lane has been pinged (a promise resolved).
 */
export function markRootPinged(root: FiberRoot, pingedLanes: Lanes, _eventTime: number): void {
	root.pingedLanes = bit32.bor(root.pingedLanes, bit32.band(root.suspendedLanes, pingedLanes));
}

/**
 * Marks the given lanes as expired if they are pending.
 */
export function markRootExpired(root: FiberRoot, expiredLanes: Lanes): void {
	root.expiredLanes = bit32.bor(root.expiredLanes, bit32.band(expiredLanes, root.pendingLanes));
}

/**
 * Marks any pending discrete input lanes as expired.
 */
export function markDiscreteUpdatesExpired(root: FiberRoot): void {
	root.expiredLanes = bit32.bor(root.expiredLanes, bit32.band(InputDiscreteLanes, root.pendingLanes));
}

/**
 * Returns true when the lanes contain discrete input work.
 */
export function hasDiscreteLanes(lanes: Lanes): boolean {
	return bit32.band(lanes, InputDiscreteLanes) !== NoLanes;
}

/**
 * Records that a mutable source read happened on a pending lane.
 */
export function markRootMutableRead(root: FiberRoot, updateLane: Lane): void {
	root.mutableReadLanes = bit32.bor(root.mutableReadLanes, bit32.band(updateLane, root.pendingLanes));
}

/**
 * Marks a root as finished for all lanes except `remainingLanes`.
 */
export function markRootFinished(root: FiberRoot, remainingLanes: Lanes): void {
	const noLongerPendingLanes = bit32.band(root.pendingLanes, bit32.bnot(remainingLanes));

	root.pendingLanes = remainingLanes;

	// Let's try everything again.
	root.suspendedLanes = 0;
	root.pingedLanes = 0;

	root.expiredLanes = bit32.band(root.expiredLanes, remainingLanes);
	root.mutableReadLanes = bit32.band(root.mutableReadLanes, remainingLanes);

	root.entangledLanes = bit32.band(root.entangledLanes, remainingLanes);

	const entanglements = root.entanglements;
	const eventTimes = root.eventTimes;
	const expirationTimes = root.expirationTimes;

	// Clear the lanes that no longer have pending work.
	let lanes = noLongerPendingLanes;
	while (lanes > 0) {
		const index = pickArbitraryLaneIndex(lanes);
		const lane = bit32.lshift(1, index);

		entanglements[index] = NoLanes;
		eventTimes[index] = NoTimestamp;
		expirationTimes[index] = NoTimestamp;

		lanes = bit32.band(lanes, bit32.bnot(lane));
	}
}

/**
 * Records that a set of lanes must render together.
 */
export function markRootEntangled(root: FiberRoot, entangledLanes: Lanes): void {
	root.entangledLanes = bit32.bor(root.entangledLanes, entangledLanes);

	const entanglements = root.entanglements;
	let lanes = entangledLanes;
	while (lanes > 0) {
		const index = pickArbitraryLaneIndex(lanes);
		const lane = bit32.lshift(1, index);

		entanglements[index] = bit32.bor(entanglements[index], entangledLanes);

		lanes = bit32.band(lanes, bit32.bnot(lane));
	}
}

/**
 * Returns the hydration lane that should be "bumped" to when a render at
 * `renderLanes` completes, or `NoLane` when no hydration is appropriate.
 */
export function getBumpedLaneForHydration(root: FiberRoot, renderLanes: Lanes): Lane {
	getHighestPriorityLanes(renderLanes);
	const highestLanePriority = return_highestLanePriority;

	let lane: Lane = NoLane;

	if (highestLanePriority === SyncLanePriority || highestLanePriority === SyncBatchedLanePriority) {
		lane = NoLane;
	} else if (
		highestLanePriority === InputDiscreteHydrationLanePriority ||
		highestLanePriority === InputDiscreteLanePriority
	) {
		lane = InputDiscreteHydrationLane;
	} else if (
		highestLanePriority === InputContinuousHydrationLanePriority ||
		highestLanePriority === InputContinuousLanePriority
	) {
		lane = InputContinuousHydrationLane;
	} else if (highestLanePriority === DefaultHydrationLanePriority || highestLanePriority === DefaultLanePriority) {
		lane = DefaultHydrationLane;
	} else if (highestLanePriority === TransitionHydrationPriority || highestLanePriority === TransitionPriority) {
		lane = TransitionHydrationLane;
	} else if (highestLanePriority === RetryLanePriority) {
		// Shouldn't be reachable under normal circumstances, so there's no
		// dedicated lane for retry priority. Use the one for long transitions.
		lane = TransitionHydrationLane;
	} else if (highestLanePriority === SelectiveHydrationLanePriority) {
		lane = SelectiveHydrationLane;
	} else if (highestLanePriority === IdleHydrationLanePriority || highestLanePriority === IdleLanePriority) {
		lane = IdleHydrationLane;
	} else if (highestLanePriority === OffscreenLanePriority || highestLanePriority === NoLanePriority) {
		lane = NoLane;
	} else {
		invariant(false, 'Invalid lane: %s. This is a bug in React.', tostring(lane));
	}

	// Check if the lane we chose is suspended. If so, that indicates that we
	// already attempted and failed to hydrate at that level. Also check if we're
	// already rendering that lane, which is rare but could happen.
	if (bit32.band(lane, bit32.bor(root.suspendedLanes, renderLanes)) !== NoLane) {
		// Give up trying to hydrate and fall back to client render.
		return NoLane;
	}

	return lane;
}

export default {
	SyncLanePriority,
	SyncBatchedLanePriority,
	InputDiscreteLanePriority,
	InputContinuousLanePriority,
	DefaultLanePriority,
	TransitionPriority,
	NoLanePriority,
	NoLanes,
	NoLane,
	SyncLane,
	SyncBatchedLane,
	InputDiscreteHydrationLane,
	DefaultHydrationLane,
	DefaultLanes,
	RetryLanes,
	SomeRetryLane,
	SelectiveHydrationLane,
	IdleHydrationLane,
	OffscreenLane,
	NoTimestamp,
	getCurrentUpdateLanePriority,
	setCurrentUpdateLanePriority,
	schedulerPriorityToLanePriority,
	lanePriorityToSchedulerPriority,
	getNextLanes,
	getMostRecentEventTime,
	computeExpirationTime,
	markStarvedLanesAsExpired,
	getHighestPriorityPendingLanes,
	getLanesToRetrySynchronouslyOnError,
	returnNextLanesPriority,
	includesNonIdleWork,
	includesOnlyRetries,
	includesOnlyTransitions,
	findUpdateLane,
	findTransitionLane,
	findRetryLane,
	pickArbitraryLane,
	includesSomeLane,
	isSubsetOfLanes,
	mergeLanes,
	removeLanes,
	laneToLanes,
	higherPriorityLane,
	higherLanePriority,
	createLaneMap,
	markRootUpdated,
	markRootSuspended,
	markRootPinged,
	markRootExpired,
	markDiscreteUpdatesExpired,
	hasDiscreteLanes,
	markRootMutableRead,
	markRootFinished,
	markRootEntangled,
	getBumpedLaneForHydration,
};
