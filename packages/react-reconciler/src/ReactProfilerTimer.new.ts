/**
 * Measures how long individual fibers spend rendering and committing, and
 * attributes those durations to the nearest `<Profiler>` ancestor.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactProfilerTimer.new.lua`.
 *
 * @module ReactProfilerTimer
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { ReactFeatureFlags } from '@nrbx/react-shared';
import { unstable_now } from '@nrbx/scheduler';
import { Profiler } from './ReactWorkTags';
import type { Fiber } from './types';

const enableProfilerTimer = ReactFeatureFlags.enableProfilerTimer;
const enableProfilerCommitHooks = ReactFeatureFlags.enableProfilerCommitHooks;

const now = unstable_now;

/** Fields read off a `<Profiler>` fiber's state node during timing accounting. */
type ProfilerStateNode = {
	effectDuration: number;
	passiveEffectDuration: number;
};

/**
 * The set of timing functions used by the work loop to account for render and
 * commit time on `<Profiler>` components.
 *
 * @internal
 */
export type ProfilerTimer = {
	getCommitTime: () => number;
	recordCommitTime: () => void;
	startProfilerTimer: (fiber: Fiber) => void;
	stopProfilerTimerIfRunning: (fiber: Fiber) => void;
	stopProfilerTimerIfRunningAndRecordDelta: (fiber: Fiber, overrideBaseTime: boolean) => void;
	recordLayoutEffectDuration: (fiber: Fiber) => void;
	recordPassiveEffectDuration: (fiber: Fiber) => void;
	startLayoutEffectTimer: () => void;
	startPassiveEffectTimer: () => void;
	transferActualDuration: (fiber: Fiber) => void;
};

let commitTime = 0;
let layoutEffectStartTime = -1;
let profilerStartTime = -1;
let passiveEffectStartTime = -1;

/**
 * Returns the timestamp of the most recent commit.
 *
 * @returns The commit time in milliseconds.
 * @internal
 */
export function getCommitTime(): number {
	return commitTime;
}

/**
 * Records the current time as the commit time.
 *
 * @internal
 */
export function recordCommitTime(): void {
	if (!enableProfilerTimer) {
		return;
	}
	commitTime = now();
}

/**
 * Marks the start of rendering `fiber`, stamping its actual start time.
 *
 * @param fiber - The profiler fiber entering render.
 * @internal
 */
export function startProfilerTimer(fiber: Fiber): void {
	if (!enableProfilerTimer) {
		return;
	}

	profilerStartTime = now();

	if (fiber.actualStartTime !== undefined && fiber.actualStartTime < 0) {
		fiber.actualStartTime = now();
	}
}

/**
 * Cancels a running profiler timer.
 *
 * @param _fiber - Unused; kept for API symmetry.
 * @internal
 */
export function stopProfilerTimerIfRunning(_fiber: Fiber): void {
	if (!enableProfilerTimer) {
		return;
	}
	profilerStartTime = -1;
}

/**
 * Stops a running profiler timer and records the elapsed time against
 * `fiber`, optionally replacing its self base duration.
 *
 * @param fiber - The profiler fiber whose render just ended.
 * @param overrideBaseTime - Whether to set `selfBaseDuration` directly.
 * @internal
 */
export function stopProfilerTimerIfRunningAndRecordDelta(fiber: Fiber, overrideBaseTime: boolean): void {
	if (!enableProfilerTimer) {
		return;
	}

	if (profilerStartTime >= 0) {
		const elapsedTime = now() - profilerStartTime;
		fiber.actualDuration = (fiber.actualDuration ?? 0) + elapsedTime;
		if (overrideBaseTime) {
			fiber.selfBaseDuration = elapsedTime;
		}
		profilerStartTime = -1;
	}
}

/**
 * Records the duration of a completed layout effect on the nearest profiler
 * ancestor.
 *
 * @param fiber - The fiber whose layout effect just finished.
 * @internal
 */
export function recordLayoutEffectDuration(fiber: Fiber): void {
	if (!enableProfilerTimer || !enableProfilerCommitHooks) {
		return;
	}

	if (layoutEffectStartTime >= 0) {
		const elapsedTime = now() - layoutEffectStartTime;

		layoutEffectStartTime = -1;

		// Store duration on the next nearest Profiler ancestor.
		let parentFiber = fiber.return_;
		while (parentFiber !== undefined) {
			if (parentFiber.tag === Profiler) {
				const parentStateNode = parentFiber.stateNode as ProfilerStateNode;
				parentStateNode.effectDuration += elapsedTime;
				break;
			}
			parentFiber = parentFiber.return_;
		}
	}
}

/**
 * Records the duration of a completed passive effect on the nearest profiler
 * ancestor.
 *
 * @param fiber - The fiber whose passive effect just finished.
 * @internal
 */
export function recordPassiveEffectDuration(fiber: Fiber): void {
	if (!enableProfilerTimer || !enableProfilerCommitHooks) {
		return;
	}

	if (passiveEffectStartTime >= 0) {
		const elapsedTime = now() - passiveEffectStartTime;

		passiveEffectStartTime = -1;

		// Store duration on the next nearest Profiler ancestor.
		let parentFiber = fiber.return_;
		while (parentFiber !== undefined) {
			if (parentFiber.tag === Profiler) {
				const parentStateNode = parentFiber.stateNode as ProfilerStateNode | undefined;
				if (parentStateNode !== undefined) {
					// Detached fibers have their state node cleared out. In
					// that case the return pointer is also cleared out, so we
					// won't be able to report the time spent in this
					// Profiler's subtree.
					parentStateNode.passiveEffectDuration += elapsedTime;
				}
				break;
			}
			parentFiber = parentFiber.return_;
		}
	}
}

/**
 * Marks the start of a layout effect.
 *
 * @internal
 */
export function startLayoutEffectTimer(): void {
	if (!enableProfilerTimer || !enableProfilerCommitHooks) {
		return;
	}
	layoutEffectStartTime = now();
}

/**
 * Marks the start of a passive effect.
 *
 * @internal
 */
export function startPassiveEffectTimer(): void {
	if (!enableProfilerTimer || !enableProfilerCommitHooks) {
		return;
	}
	passiveEffectStartTime = now();
}

/**
 * Transfers the actual durations of a fiber's children onto the fiber itself.
 * Used when the work of multiple passes must be counted together.
 *
 * @param fiber - The fiber whose children's time should be folded in.
 * @internal
 */
export function transferActualDuration(fiber: Fiber): void {
	// Transfer time spent rendering these children so we don't lose it after
	// we rerender. This is used as a helper in special cases where we should
	// count the work of multiple passes.
	let child = fiber.child;
	while (child !== undefined) {
		fiber.actualDuration = (fiber.actualDuration ?? 0) + (child.actualDuration ?? 0);
		child = child.sibling;
	}
}

export default {
	getCommitTime,
	recordCommitTime,
	recordLayoutEffectDuration,
	recordPassiveEffectDuration,
	startLayoutEffectTimer,
	startPassiveEffectTimer,
	startProfilerTimer,
	stopProfilerTimerIfRunning,
	stopProfilerTimerIfRunningAndRecordDelta,
	transferActualDuration,
};
