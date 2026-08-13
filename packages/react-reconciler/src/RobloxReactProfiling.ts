/**
 * Targeted performance insights for the Roblox Microprofiler.
 *
 * Ported from `react-lua/modules/react-reconciler/src/RobloxReactProfiling.lua`.
 *
 * The profile functions become no-ops unless `_G.__REACT_MICROPROFILER_LEVEL`
 * is set at module load time, keeping production overhead at zero.
 */

/// <reference types="@rbxts/types" />

import { getComponentName } from '@nrbx/react-shared';
import { HostComponent, HostText } from './ReactWorkTags';
import type { Fiber, FiberRoot } from './types';

// ReactMicroprofilerLevel levels.
const LEVEL_ROOTS_LOG_ONLY = 1; // Level 1: Roots for logging only.
const LEVEL_ROOTS = 5; // Level 5: Roots + commit time in the Microprofiler.
const LEVEL_FIBERS = 10; // Level 10: Individual fiber "units of work".

const ReactMicroprofilerLevel: number = ((_G as Record<string, unknown>).__REACT_MICROPROFILER_LEVEL as number) || 0;

export type Marker = {
	id: string;
	startTime: number;
	endTime: number;
};

export type SamplerCallback = (marker: Marker) => void;

function noop(..._args: Array<unknown>): void {}

let enableRootSampling = false;
let timerSamplingCallback: SamplerCallback | undefined;

// Used to inhibit profileend() calls that no longer match the originating
// profilebegin(...) frame.
let numActiveProfilesInFrame = 0;

if (ReactMicroprofilerLevel >= LEVEL_ROOTS) {
	game.GetService('RunService').Heartbeat.Connect(() => {
		numActiveProfilesInFrame = 0;
	});
}

const microprofiler =
	ReactMicroprofilerLevel >= LEVEL_ROOTS
		? {
				profilebegin: (name: string) => {
					debug.profilebegin(name);
					numActiveProfilesInFrame += 1;
				},
				profileend: () => {
					if (numActiveProfilesInFrame > 0) {
						debug.profileend();
						numActiveProfilesInFrame -= 1;
					}
				},
			}
		: {
				profilebegin: noop,
				profileend: noop,
			};

export function startTimerSampling(timerSamplingCallbackFn: SamplerCallback): void {
	if (enableRootSampling) {
		warn('RobloxReactProfiling Timer Sampling already running.');
	}
	enableRootSampling = true;
	timerSamplingCallback = timerSamplingCallbackFn;
}

export function endTimerSampling(): void {
	enableRootSampling = false;
	timerSamplingCallback = undefined;
}

function getFirstStringKey(t: Record<string, unknown>): string | undefined {
	for (const [key] of pairs(t)) {
		if (typeIs(key, 'string')) {
			return key as string;
		}
	}
	return undefined;
}

function startTimer(marker: Marker): void {
	if (enableRootSampling) {
		marker.startTime = os.clock();
	}
}

function endTimer(marker: Marker): void {
	if (enableRootSampling) {
		marker.endTime = os.clock();
		if (timerSamplingCallback) {
			timerSamplingCallback(marker);
		}
	}
}

function profileRootBeforeUnitOfWorkImpl(root: FiberRoot): Marker | undefined {
	const rootFiber = root.current;
	let profileId: string | undefined;

	if (rootFiber) {
		if (rootFiber.memoizedProps) {
			// Expecting a props table with a single item.
			profileId = getFirstStringKey(rootFiber.memoizedProps as Record<string, unknown>);
		}

		const rootStateNode = rootFiber.stateNode as { containerInfo?: { Name?: string } } | undefined;
		if (profileId === undefined && rootStateNode && rootStateNode.containerInfo) {
			profileId = rootStateNode.containerInfo.Name;
		}
	}

	// Note: investigate HostRoot vs HostPortal for this condition.
	if (profileId === 'Folder' && rootFiber.child) {
		const fiber = rootFiber.child;
		let folderProfileId: string | undefined;
		if (fiber.memoizedProps) {
			folderProfileId = getFirstStringKey(fiber.memoizedProps as Record<string, unknown>);
		}

		const fiberStateNode = fiber.stateNode as { containerInfo?: { Name?: string } } | undefined;
		if (folderProfileId === undefined && fiberStateNode && fiberStateNode.containerInfo) {
			folderProfileId = fiberStateNode.containerInfo.Name;
		}
		if (folderProfileId !== undefined) {
			profileId = folderProfileId;
		}
	}

	if (profileId !== undefined) {
		const marker: Marker = {
			id: profileId,
			startTime: 0,
			endTime: 0,
		};
		startTimer(marker);
		microprofiler.profilebegin(profileId);
		return marker;
	}

	return undefined;
}

function profileRootAfterYieldingImpl(marker: Marker | undefined): void {
	if (marker) {
		endTimer(marker);
		microprofiler.profileend();
	}
}

function profileUnitOfWorkBeforeImpl(unitOfWork: Fiber): boolean {
	let profileId = getComponentName(unitOfWork.type);

	if (unitOfWork.key) {
		profileId = `${tostring(unitOfWork.key)}=${profileId || '?'}`;
	}

	let rootName: string | undefined;
	if (unitOfWork.stateNode) {
		if (unitOfWork.tag === HostComponent || unitOfWork.tag === HostText) {
			const layerCollector = (unitOfWork.stateNode as Instance).FindFirstAncestorWhichIsA('LayerCollector');
			if (layerCollector) {
				rootName = `[${layerCollector.GetFullName()}] `;
			}
		}
	}

	if (rootName) {
		profileId = `${rootName} : ${profileId || '?'}`;
	}

	if (profileId !== undefined) {
		microprofiler.profilebegin(profileId);
		return true;
	}

	return false;
}

function profileUnitOfWorkAfterImpl(profileRunning: boolean): void {
	if (profileRunning) {
		microprofiler.profileend();
	}
}

function profileCommitBeforeImpl(): void {
	microprofiler.profilebegin('Commit');
}

function profileCommitAfterImpl(): void {
	microprofiler.profileend();
}

// The public exports become no-ops below their relevant profiler level,
// matching the conditional return-table in the Lua source.
export const profileRootBeforeUnitOfWork: (root: FiberRoot) => Marker | undefined =
	ReactMicroprofilerLevel >= LEVEL_ROOTS_LOG_ONLY
		? profileRootBeforeUnitOfWorkImpl
		: (noop as unknown as (root: FiberRoot) => Marker | undefined);

export const profileRootAfterYielding: (marker: Marker | undefined) => void =
	ReactMicroprofilerLevel >= LEVEL_ROOTS_LOG_ONLY
		? profileRootAfterYieldingImpl
		: (noop as unknown as (marker: Marker | undefined) => void);

export const profileUnitOfWorkBefore: (unitOfWork: Fiber) => boolean =
	ReactMicroprofilerLevel >= LEVEL_FIBERS
		? profileUnitOfWorkBeforeImpl
		: (noop as unknown as (unitOfWork: Fiber) => boolean);

export const profileUnitOfWorkAfter: (profileRunning: boolean) => void =
	ReactMicroprofilerLevel >= LEVEL_FIBERS
		? profileUnitOfWorkAfterImpl
		: (noop as unknown as (profileRunning: boolean) => void);

export const profileCommitBefore: () => void =
	ReactMicroprofilerLevel >= LEVEL_ROOTS ? profileCommitBeforeImpl : (noop as unknown as () => void);

export const profileCommitAfter: () => void =
	ReactMicroprofilerLevel >= LEVEL_ROOTS ? profileCommitAfterImpl : (noop as unknown as () => void);

export default {
	startTimerSampling,
	endTimerSampling,
	profileRootBeforeUnitOfWork,
	profileRootAfterYielding,
	profileUnitOfWorkBefore,
	profileUnitOfWorkAfter,
	profileCommitBefore,
	profileCommitAfter,
};
