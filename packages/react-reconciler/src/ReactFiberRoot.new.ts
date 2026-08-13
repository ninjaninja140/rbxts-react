/**
 * Creates the fiber root node that anchors a React tree to its host
 * container. The root owns the lanes, timeouts, pending context, and
 * interaction-tracing state shared by every update in the tree.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberRoot.new.lua`.
 *
 * @module ReactFiberRoot
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { ReactFeatureFlags } from '@nrbx/react-shared';
import { tracing } from '@nrbx/scheduler';
import { createHostRootFiber } from './ReactFiber.new';
import HostConfig from './ReactFiberHostConfig';
import { NoLanePriority, NoLanes, NoTimestamp, createLaneMap } from './ReactFiberLane';
import { BlockingRoot, ConcurrentRoot, LegacyRoot } from './ReactRootTags';
import { initializeUpdateQueue } from './ReactUpdateQueue.new';
import type { FiberRoot, Interaction, SuspenseHydrationCallbacks } from './types';
import type { NoTimeout } from './types';
import type { RootTag } from './ReactRootTags';

// Read lazily — `noTimeout` is spliced in by the renderer at `initialize()`.
const noTimeout = () => HostConfig.noTimeout as NoTimeout;

/**
 * Builds and returns a fully-initialized fiber root node.
 *
 * @param containerInfo - The host container backing this root.
 * @param tag - The root's mode (legacy, blocking, or concurrent).
 * @param hydrate - Whether the initial mount should attempt hydration.
 * @returns The new root node.
 * @internal
 */
function FiberRootNode(containerInfo: any, tag: RootTag, hydrate: boolean): FiberRoot {
	const rootNode: FiberRoot = {
		tag,
		containerInfo,
		pendingChildren: undefined,
		// Cyclic construction: the root points at its host root fiber, which
		// points back via stateNode.
		current: undefined as any,
		pingCache: undefined,
		finishedWork: undefined,
		timeoutHandle: noTimeout(),
		context: undefined,
		pendingContext: undefined,
		hydrate,
		mutableSourceEagerHydrationData: undefined,
		callbackNode: undefined,
		callbackPriority: NoLanePriority,
		eventTimes: createLaneMap(NoLanes),
		expirationTimes: createLaneMap(NoTimestamp),

		pendingLanes: NoLanes,
		suspendedLanes: NoLanes,
		pingedLanes: NoLanes,
		expiredLanes: NoLanes,
		mutableReadLanes: NoLanes,
		finishedLanes: NoLanes,

		entangledLanes: NoLanes,
		entanglements: createLaneMap(NoLanes),

		interactionThreadID: 0,
		memoizedInteractions: new Set<Interaction>(),
		pendingInteractionMap: new Map<number, Set<Interaction>>(),

		hydrationCallbacks: undefined,
	};

	if (ReactFeatureFlags.enableSchedulerTracing) {
		rootNode.interactionThreadID = tracing.unstable_getThreadID();
	}

	if (__DEV__) {
		if (tag === BlockingRoot) {
			(rootNode as any)._debugRootType = 'createBlockingRoot()';
		} else if (tag === ConcurrentRoot) {
			(rootNode as any)._debugRootType = 'createRoot()';
		} else if (tag === LegacyRoot) {
			(rootNode as any)._debugRootType = 'createLegacyRoot()';
		}
	}

	return rootNode;
}

/**
 * Creates a fiber root for `containerInfo` and links it to a fresh host root
 * fiber, then initializes the root fiber's update queue.
 *
 * @param containerInfo - The host container backing this root.
 * @param tag - The root's mode (legacy, blocking, or concurrent).
 * @param hydrate - Whether the initial mount should attempt hydration.
 * @param hydrationCallbacks - Suspense hydration callbacks (unused unless the
 *   suspense-callback flag is enabled).
 * @returns The new, linked fiber root.
 * @internal
 */
export function createFiberRoot(
	containerInfo: any,
	tag: RootTag,
	hydrate: boolean,
	hydrationCallbacks?: SuspenseHydrationCallbacks
): FiberRoot {
	const root: FiberRoot = FiberRootNode(containerInfo, tag, hydrate);
	if (ReactFeatureFlags.enableSuspenseCallback) {
		root.hydrationCallbacks = hydrationCallbacks;
	}

	// Cyclic construction. This cheats the type system right now because
	// stateNode is any.
	const uninitializedFiber = createHostRootFiber(tag);
	root.current = uninitializedFiber;
	uninitializedFiber.stateNode = root;

	initializeUpdateQueue(uninitializedFiber);

	return root;
}

export default {
	createFiberRoot,
};
