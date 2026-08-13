/**
 * Scheduling profiler integration for the reconciler.
 *
 * Ported from `react-lua/modules/react-reconciler/src/SchedulingProfiler.lua`.
 *
 * Upstream React writes User Timing marks via the browser `performance` API.
 * Roblox has no `performance` global, so the User Timing path is compiled out
 * and the Roblox-specific `ProfilerEventCallback` registration below is what
 * actually reports profiler events.
 *
 * @module SchedulingProfiler
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { ReactFeatureFlags } from '@nrbx/react-shared';
import type { Fiber, FiberRoot, Lane, Lanes, Wakeable } from './types';

/**
 * A numeric identifier for a profiler event. See {@link profilerEventTypes}
 * for the canonical mapping.
 */
export type ProfilerEvent = number;

/**
 * Callback invoked whenever a profiler event fires.
 *
 * @param type - One of the {@link profilerEventTypes} values.
 * @param root - The fiber root associated with the event, when relevant.
 */
export type ProfilerEventCallback = (type: ProfilerEvent, root?: FiberRoot) => void;

const { enableSchedulingProfiler } = ReactFeatureFlags;

// Roblox has no global `performance` object, so the User Timing API subset
// React relies on is never available. Every User Timing mark in the upstream
// module is dead code at runtime and is therefore omitted from this port.

/**
 * Canonical profiler event identifiers.
 */
export const profilerEventTypes = {
	CommitStart: 0,
	CommitStop: 1,
	LayoutEffectsStart: 2,
	LayoutEffectsStop: 3,
	PassiveEffectsStart: 4,
	PassiveEffectsStop: 5,
	RenderStart: 6,
	RenderYield: 7,
	RenderStop: 8,
} as const;

let profilerEventCallback: ProfilerEventCallback | undefined;

/**
 * Registers a callback for reconciler profiler events. Only one callback may
 * be registered at a time; registering another logs a warning.
 */
export function registerProfilerEventCallback(callback: ProfilerEventCallback): void {
	if (profilerEventCallback !== undefined) {
		warn('SchedulingProfiler: Another event callback was already registered.');
	}
	profilerEventCallback = callback;
}

export function markCommitStarted(_lanes: Lanes): void {
	if (enableSchedulingProfiler) {
		if (profilerEventCallback !== undefined) {
			profilerEventCallback(profilerEventTypes.CommitStart);
		}
	}
}

export function markCommitStopped(root: FiberRoot): void {
	if (enableSchedulingProfiler) {
		if (profilerEventCallback !== undefined) {
			profilerEventCallback(profilerEventTypes.CommitStop, root);
		}
	}
}

export function markComponentSuspended(_fiber: Fiber, _wakeable: Wakeable): void {
	// No-op: upstream only writes User Timing marks here, which are unavailable
	// on Roblox.
}

export function markLayoutEffectsStarted(_lanes: Lanes): void {
	if (enableSchedulingProfiler) {
		if (profilerEventCallback !== undefined) {
			profilerEventCallback(profilerEventTypes.LayoutEffectsStart);
		}
	}
}

export function markLayoutEffectsStopped(): void {
	if (enableSchedulingProfiler) {
		if (profilerEventCallback !== undefined) {
			profilerEventCallback(profilerEventTypes.LayoutEffectsStop);
		}
	}
}

export function markPassiveEffectsStarted(_lanes: Lanes): void {
	if (enableSchedulingProfiler) {
		if (profilerEventCallback !== undefined) {
			profilerEventCallback(profilerEventTypes.PassiveEffectsStart);
		}
	}
}

export function markPassiveEffectsStopped(root: FiberRoot): void {
	if (enableSchedulingProfiler) {
		if (profilerEventCallback !== undefined) {
			profilerEventCallback(profilerEventTypes.PassiveEffectsStop, root);
		}
	}
}

export function markRenderStarted(_lanes: Lanes): void {
	if (enableSchedulingProfiler) {
		if (profilerEventCallback !== undefined) {
			profilerEventCallback(profilerEventTypes.RenderStart);
		}
	}
}

export function markRenderYielded(): void {
	if (enableSchedulingProfiler) {
		if (profilerEventCallback !== undefined) {
			profilerEventCallback(profilerEventTypes.RenderYield);
		}
	}
}

export function markRenderStopped(): void {
	if (enableSchedulingProfiler) {
		if (profilerEventCallback !== undefined) {
			profilerEventCallback(profilerEventTypes.RenderStop);
		}
	}
}

export function markRenderScheduled(_lane: Lane): void {
	// No-op: upstream only writes a User Timing mark here.
}

export function markForceUpdateScheduled(_fiber: Fiber, _lane: Lane): void {
	// No-op: upstream only writes a User Timing mark here.
}

export function markStateUpdateScheduled(_fiber: Fiber, _lane: Lane): void {
	// No-op: upstream only writes a User Timing mark here.
}

export default {
	profilerEventTypes,
	registerProfilerEventCallback,
	markCommitStarted,
	markCommitStopped,
	markComponentSuspended,
	markLayoutEffectsStarted,
	markLayoutEffectsStopped,
	markPassiveEffectsStarted,
	markPassiveEffectsStopped,
	markRenderStarted,
	markRenderYielded,
	markRenderStopped,
	markRenderScheduled,
	markForceUpdateScheduled,
	markStateUpdateScheduled,
};
