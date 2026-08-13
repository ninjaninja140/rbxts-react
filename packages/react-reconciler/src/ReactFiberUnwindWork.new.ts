/**
 * Unwinds a partially-rendered fiber: pops whatever context, host context,
 * Suspense context, or legacy context it pushed, converts `ShouldCapture`
 * flags into `DidCapture`, and returns the nearest boundary that must
 * re-render.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberUnwindWork.new.lua`.
 *
 * @module ReactFiberUnwindWork
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { invariant, ReactFeatureFlags } from '@nrbx/react-shared';
import { isContextProvider, popContext, popTopLevelContextObject } from './ReactFiberContext.new';
import { DidCapture, NoFlags, ShouldCapture } from './ReactFiberFlags';
import { resetHydrationState } from './ReactFiberHydrationContext.new';
import { popHostContainer, popHostContext } from './ReactFiberHostContext.new';
import { resetWorkInProgressVersions } from './ReactMutableSource.new';
import { popProvider } from './ReactFiberNewContext.new';
import { transferActualDuration } from './ReactProfilerTimer.new';
import { popSuspenseContext } from './ReactFiberSuspenseContext.new';
import type { SuspenseState } from './ReactFiberSuspenseComponent.new';
import { NoMode, ProfileMode } from './ReactTypeOfMode';
import {
	ClassComponent,
	ContextProvider,
	HostComponent,
	HostPortal,
	HostRoot,
	LegacyHiddenComponent,
	OffscreenComponent,
	SuspenseComponent,
	SuspenseListComponent,
} from './ReactWorkTags';
import type { Fiber, Lanes } from './types';

const enableSuspenseServerRenderer = ReactFeatureFlags.enableSuspenseServerRenderer;
const enableProfilerTimer = ReactFeatureFlags.enableProfilerTimer;

// ROBLOX deviation: WorkLoop is loaded lazily (on first use) to break the
// module cycle between ReactFiberUnwindWork -> ReactFiberWorkLoop. The Lua
// original deferred the `require` into the `popRenderLanes` wrapper for the
// same reason, and the WorkLoop module statically imports this one.
let ReactFiberWorkLoop: { popRenderLanes: (fiber: Fiber) => void } | undefined;

function getSiblingModule(moduleName: string): unknown {
	const parent = (script as ModuleScript).Parent;
	invariant(parent !== undefined, 'Expected module parent to exist.');
	const child = parent.FindFirstChild(moduleName);
	invariant(child?.IsA('ModuleScript') === true, "Expected sibling module '%s' to exist.", moduleName);
	return require(child as ModuleScript);
}

function popRenderLanes(fiber: Fiber): void {
	if (ReactFiberWorkLoop === undefined) {
		ReactFiberWorkLoop = getSiblingModule('ReactFiberWorkLoop.new') as NonNullable<typeof ReactFiberWorkLoop>;
	}
	ReactFiberWorkLoop.popRenderLanes(fiber);
}

/**
 * Unwinds a fiber that threw or suspended, returning the nearest boundary that
 * should re-render (or `undefined` if none exists).
 *
 * @param workInProgress - The fiber to unwind.
 * @param renderLanes - The lanes of the current render.
 * @returns The capturing boundary, or `undefined`.
 * @internal
 */
function unwindWork(workInProgress: Fiber, _renderLanes: Lanes): Fiber | undefined {
	if (workInProgress.tag === ClassComponent) {
		const Component = workInProgress.type;
		if (isContextProvider(Component)) {
			popContext(workInProgress);
		}
		const flags = workInProgress.flags;
		if (bit32.band(flags, ShouldCapture) !== 0) {
			workInProgress.flags = bit32.bor(bit32.band(flags, bit32.bnot(ShouldCapture)), DidCapture);
			if (enableProfilerTimer && bit32.band(workInProgress.mode, ProfileMode) !== NoMode) {
				transferActualDuration(workInProgress);
			}
			return workInProgress;
		}
		return undefined;
	} else if (workInProgress.tag === HostRoot) {
		popHostContainer(workInProgress);
		popTopLevelContextObject(workInProgress);
		resetWorkInProgressVersions();
		const flags = workInProgress.flags;
		invariant(
			bit32.band(flags, DidCapture) === NoFlags,
			'The root failed to unmount after an error. This is likely a bug in React. Please file an issue.'
		);
		workInProgress.flags = bit32.bor(bit32.band(flags, bit32.bnot(ShouldCapture)), DidCapture);
		return workInProgress;
	} else if (workInProgress.tag === HostComponent) {
		// TODO: popHydrationState
		popHostContext(workInProgress);
		return undefined;
	} else if (workInProgress.tag === SuspenseComponent) {
		popSuspenseContext(workInProgress);
		if (enableSuspenseServerRenderer) {
			const suspenseState = workInProgress.memoizedState as SuspenseState | undefined;
			if (suspenseState !== undefined && suspenseState.dehydrated !== undefined) {
				invariant(
					workInProgress.alternate !== undefined,
					'Threw in newly mounted dehydrated component. This is likely a bug in React. Please file an issue.'
				);
				resetHydrationState();
			}
		}
		const flags = workInProgress.flags;
		if (bit32.band(flags, ShouldCapture) !== 0) {
			workInProgress.flags = bit32.bor(bit32.band(flags, bit32.bnot(ShouldCapture)), DidCapture);
			// Captured a suspense effect. Re-render the boundary.
			if (enableProfilerTimer && bit32.band(workInProgress.mode, ProfileMode) !== NoMode) {
				transferActualDuration(workInProgress);
			}
			return workInProgress;
		}
		return undefined;
	} else if (workInProgress.tag === SuspenseListComponent) {
		popSuspenseContext(workInProgress);
		// SuspenseList doesn't actually catch anything. It should've been
		// caught by a nested boundary. If not, it should bubble through.
		return undefined;
	} else if (workInProgress.tag === HostPortal) {
		popHostContainer(workInProgress);
		return undefined;
	} else if (workInProgress.tag === ContextProvider) {
		popProvider(workInProgress);
		return undefined;
	} else if (workInProgress.tag === OffscreenComponent || workInProgress.tag === LegacyHiddenComponent) {
		popRenderLanes(workInProgress);
		return undefined;
	} else {
		return undefined;
	}
}

/**
 * Unwinds context that was pushed by an interrupted (incomplete) fiber, without
 * performing the capture-flag logic used for errors.
 *
 * @param interruptedWork - The fiber whose work was interrupted.
 * @internal
 */
function unwindInterruptedWork(interruptedWork: Fiber): void {
	if (interruptedWork.tag === ClassComponent) {
		// ROBLOX deviation: Lua doesn't support properties on functions
		let childContextTypes: unknown;
		if (typeOf(interruptedWork.type) === 'table') {
			childContextTypes = (interruptedWork.type as Record<string, unknown>).childContextTypes;
		}
		if (childContextTypes !== undefined) {
			popContext(interruptedWork);
		}
	} else if (interruptedWork.tag === HostRoot) {
		popHostContainer(interruptedWork);
		popTopLevelContextObject(interruptedWork);
		resetWorkInProgressVersions();
	} else if (interruptedWork.tag === HostComponent) {
		popHostContext(interruptedWork);
	} else if (interruptedWork.tag === HostPortal) {
		popHostContainer(interruptedWork);
	} else if (interruptedWork.tag === SuspenseComponent) {
		popSuspenseContext(interruptedWork);
	} else if (interruptedWork.tag === SuspenseListComponent) {
		popSuspenseContext(interruptedWork);
	} else if (interruptedWork.tag === ContextProvider) {
		popProvider(interruptedWork);
	} else if (interruptedWork.tag === OffscreenComponent || interruptedWork.tag === LegacyHiddenComponent) {
		popRenderLanes(interruptedWork);
		return;
	} else {
		// default
		return;
	}
}

export default {
	unwindWork,
	unwindInterruptedWork,
};
