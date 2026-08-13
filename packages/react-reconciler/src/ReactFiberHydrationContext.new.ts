/**
 * Tracks the state of hydration (server-rendered tree adoption) during a
 * render.
 *
 * The Roblox renderer does not implement hydration (`supportsHydration` is
 * `false`), so every function here short-circuits on the first read of the
 * flag. The module is kept as a faithful port so the reconciler's call sites
 * stay in sync with upstream React, and so hydration can be enabled later
 * without touching the rest of the reconciler.
 *
 * Ported from
 * `react-lua/modules/react-reconciler/src/ReactFiberHydrationContext.new.lua`.
 *
 * @module ReactFiberHydrationContext
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { console, invariant, ReactFeatureFlags } from '@nrbx/react-shared';
import { createFiberFromDehydratedFragment } from './ReactFiber.new';
import type { Fiber } from './types';
import { Hydrating, Placement } from './ReactFiberFlags';
import HostConfig from './ReactFiberHostConfig';
import type {
	Container,
	HostContext,
	HydratableInstance,
	Instance,
	SuspenseInstance,
	TextInstance,
} from './ReactFiberHostConfig';
import { OffscreenLane } from './ReactFiberLane';
import type { SuspenseState } from './ReactFiberSuspenseComponent.new';
import { HostComponent, HostRoot, HostText, SuspenseComponent } from './ReactWorkTags';

// The deepest Fiber on the stack involved in a hydration context.
// This may have been an insertion or a hydration.
let hydrationParentFiber: Fiber | undefined;
let nextHydratableInstance: HydratableInstance | undefined;
let isHydrating = false;

/** Fails fast when a hydration helper is reached through an unfinished port. */
function unimplemented(message: string): never {
	print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	print(`UNIMPLEMENTED ERROR: ${message}`);
	error(`FIXME (roblox): ${message} is unimplemented`, 2);
}

export function warnIfHydrating(): void {
	if (__DEV__) {
		if (isHydrating) {
			console.error('We should not be hydrating here. This is a bug in React. Please file a bug.');
		}
	}
}

export function enterHydrationState(fiber: Fiber): boolean {
	if (HostConfig.supportsHydration !== true) {
		return false;
	}

	const parentInstance = (fiber.stateNode as { containerInfo: Container }).containerInfo;
	nextHydratableInstance = HostConfig.getFirstHydratableChild!(parentInstance);
	hydrationParentFiber = fiber;
	isHydrating = true;
	return true;
}

export function reenterHydrationStateFromDehydratedSuspenseInstance(
	fiber: Fiber,
	suspenseInstance: SuspenseInstance
): boolean {
	if (HostConfig.supportsHydration !== true) {
		return false;
	}

	nextHydratableInstance = HostConfig.getNextHydratableSibling!(suspenseInstance);
	popToNextHostParent(fiber);
	isHydrating = true;
	return true;
}

function deleteHydratableInstance(_returnFiber: Fiber | undefined, _instance: HydratableInstance): void {
	unimplemented('deleteHydratableInstance');
}

function insertNonHydratedInstance(_returnFiber: Fiber | undefined, fiber: Fiber): void {
	unimplemented('insertNonHydratedInstance');
	fiber.flags = bit32.bor(bit32.band(fiber.flags, bit32.bnot(Hydrating)), Placement);
}

function tryHydrate(fiber: Fiber, nextInstance: HydratableInstance): boolean {
	if (fiber.tag === HostComponent) {
		const type_ = fiber.type as string;
		const props = fiber.pendingProps;
		const instance = HostConfig.canHydrateInstance!(nextInstance as Instance, type_, props);
		if (instance) {
			fiber.stateNode = instance;
			return true;
		}
		return false;
	} else if (fiber.tag === HostText) {
		const text = fiber.pendingProps as string;
		const textInstance = HostConfig.canHydrateTextInstance!(nextInstance as Instance, text);
		if (textInstance) {
			fiber.stateNode = textInstance;
			return true;
		}
		return false;
	} else if (fiber.tag === SuspenseComponent) {
		if (ReactFeatureFlags.enableSuspenseServerRenderer) {
			const suspenseInstance = HostConfig.canHydrateSuspenseInstance!(nextInstance as SuspenseInstance);
			if (suspenseInstance !== undefined) {
				const suspenseState: SuspenseState = {
					dehydrated: suspenseInstance,
					retryLane: OffscreenLane,
				};
				fiber.memoizedState = suspenseState;
				// Store the dehydrated fragment as a child fiber. This simplifies
				// the code for getHostSibling and deleting nodes, since it doesn't
				// have to consider all Suspense boundaries and check if they're
				// dehydrated ones or not.
				const dehydratedFragment = createFiberFromDehydratedFragment(suspenseInstance);
				dehydratedFragment.return_ = fiber;
				fiber.child = dehydratedFragment;
				return true;
			}
		}
		return false;
	} else {
		return false;
	}
}

export function tryToClaimNextHydratableInstance(fiber: Fiber): void {
	if (!isHydrating) {
		return;
	}
	const nextInstance = nextHydratableInstance;
	if (nextInstance === undefined) {
		// Nothing to hydrate. Make it an insertion.
		insertNonHydratedInstance(hydrationParentFiber, fiber);
		isHydrating = false;
		hydrationParentFiber = fiber;
		return;
	}

	const firstAttemptedInstance = nextInstance;
	if (!tryHydrate(fiber, nextInstance)) {
		// If we can't hydrate this instance let's try the next one.
		// We use this as a heuristic. It's based on intuition and not data so it
		// might be flawed or unnecessary.
		const siblingInstance = HostConfig.getNextHydratableSibling!(firstAttemptedInstance);
		if (siblingInstance === undefined || !tryHydrate(fiber, siblingInstance)) {
			// Nothing to hydrate. Make it an insertion.
			insertNonHydratedInstance(hydrationParentFiber, fiber);
			isHydrating = false;
			hydrationParentFiber = fiber;
			return;
		}
		// We matched the next one, we'll now assume that the first one was
		// superfluous and we'll delete it. Since we can't eagerly delete it
		// we'll have to schedule a deletion. To do that, this node needs a dummy
		// fiber associated with it.
		deleteHydratableInstance(hydrationParentFiber, firstAttemptedInstance);
		nextHydratableInstance = HostConfig.getFirstHydratableChild!(siblingInstance);
	} else {
		nextHydratableInstance = HostConfig.getFirstHydratableChild!(nextInstance);
	}
	hydrationParentFiber = fiber;
}

export function prepareToHydrateHostInstance(
	fiber: Fiber,
	rootContainerInstance: Container,
	hostContext: HostContext
): boolean {
	if (HostConfig.supportsHydration !== true) {
		invariant(
			false,
			'Expected prepareToHydrateHostInstance() to never be called. ' +
				'This error is likely caused by a bug in React. Please file an issue.'
		);
	}

	const instance = fiber.stateNode as Instance;
	const updatePayload = HostConfig.hydrateInstance!(
		instance,
		fiber.type as string,
		fiber.memoizedProps,
		rootContainerInstance,
		hostContext,
		fiber
	);
	// TODO: Type this specific to this type of component.
	fiber.updateQueue = updatePayload;
	// If the update payload indicates that there is a change or if there
	// is a new ref we mark this as an update.
	return updatePayload !== undefined;
}

export function prepareToHydrateHostTextInstance(fiber: Fiber): boolean {
	if (HostConfig.supportsHydration !== true) {
		invariant(
			false,
			'Expected prepareToHydrateHostTextInstance() to never be called. ' +
				'This error is likely caused by a bug in React. Please file an issue.'
		);
	}

	const textInstance = fiber.stateNode as TextInstance;
	const textContent = fiber.memoizedProps as string;
	const shouldUpdate = HostConfig.hydrateTextInstance!(textInstance, textContent, fiber);
	if (__DEV__) {
		if (shouldUpdate) {
			// We assume that prepareToHydrateHostTextInstance is called in a
			// context where the hydration parent is the parent host component of
			// this host text.
			const returnFiber = hydrationParentFiber;
			if (returnFiber !== undefined) {
				if (returnFiber.tag === HostRoot) {
					const parentContainer = (returnFiber.stateNode as { containerInfo: Container }).containerInfo;
					HostConfig.didNotMatchHydratedContainerTextInstance!(parentContainer, textInstance, textContent);
				} else if (returnFiber.tag === HostComponent) {
					const parentType = returnFiber.type as string;
					const parentProps = returnFiber.memoizedProps;
					const parentInstance = returnFiber.stateNode as Instance;
					HostConfig.didNotMatchHydratedTextInstance!(
						parentType,
						parentProps,
						parentInstance,
						textInstance,
						textContent
					);
				}
			}
		}
	}
	return shouldUpdate;
}

export function prepareToHydrateHostSuspenseInstance(fiber: Fiber): void {
	if (HostConfig.supportsHydration !== true) {
		invariant(
			false,
			'Expected prepareToHydrateHostSuspenseInstance() to never be called. ' +
				'This error is likely caused by a bug in React. Please file an issue.'
		);
	}

	const suspenseState = fiber.memoizedState as SuspenseState;
	const suspenseInstance = suspenseState !== undefined ? suspenseState.dehydrated : undefined;

	invariant(
		suspenseInstance !== undefined,
		'Expected to have a hydrated suspense instance. ' +
			'This error is likely caused by a bug in React. Please file an issue.'
	);
	HostConfig.hydrateSuspenseInstance!(suspenseInstance, fiber);
}

function skipPastDehydratedSuspenseInstance(fiber: Fiber): HydratableInstance | undefined {
	if (HostConfig.supportsHydration !== true) {
		invariant(
			false,
			'Expected skipPastDehydratedSuspenseInstance() to never be called. ' +
				'This error is likely caused by a bug in React. Please file an issue.'
		);
	}
	const suspenseState = fiber.memoizedState as SuspenseState;
	const suspenseInstance = suspenseState !== undefined ? suspenseState.dehydrated : undefined;
	invariant(
		suspenseInstance !== undefined,
		'Expected to have a hydrated suspense instance. ' +
			'This error is likely caused by a bug in React. Please file an issue.'
	);
	return HostConfig.getNextHydratableInstanceAfterSuspenseInstance!(suspenseInstance);
}

function popToNextHostParent(fiber: Fiber): void {
	let parent = fiber.return_;
	while (
		parent !== undefined &&
		parent.tag !== HostComponent &&
		parent.tag !== HostRoot &&
		parent.tag !== SuspenseComponent
	) {
		parent = parent.return_;
	}
	hydrationParentFiber = parent;
}

export function popHydrationState(fiber: Fiber): boolean {
	if (HostConfig.supportsHydration !== true) {
		return false;
	}
	if (fiber !== hydrationParentFiber) {
		// We're deeper than the current hydration context, inside an inserted
		// tree.
		return false;
	}
	if (!isHydrating) {
		// If we're not currently hydrating but we're in a hydration context, then
		// we were an insertion and now need to pop up reenter hydration of our
		// siblings.
		popToNextHostParent(fiber);
		isHydrating = true;
		return false;
	}

	const type_ = fiber.type as string;

	// If we have any remaining hydratable nodes, we need to delete them now.
	// We only do this deeper than head and body since they tend to have random
	// other nodes in them. We also ignore components with pure text content in
	// side of them.
	// TODO: Better heuristic.
	if (
		fiber.tag !== HostComponent ||
		(type_ !== 'head' && type_ !== 'body' && !HostConfig.shouldSetTextContent(type_, fiber.memoizedProps))
	) {
		let nextInstance = nextHydratableInstance;
		while (nextInstance !== undefined) {
			deleteHydratableInstance(fiber, nextInstance);
			nextInstance = HostConfig.getNextHydratableSibling!(nextInstance);
		}
	}

	popToNextHostParent(fiber);
	if (fiber.tag === SuspenseComponent) {
		nextHydratableInstance = skipPastDehydratedSuspenseInstance(fiber);
	} else {
		if (hydrationParentFiber !== undefined) {
			nextHydratableInstance = HostConfig.getNextHydratableSibling!(fiber.stateNode as Instance);
		} else {
			nextHydratableInstance = undefined;
		}
	}
	return true;
}

export function resetHydrationState(): void {
	if (HostConfig.supportsHydration !== true) {
		return;
	}

	hydrationParentFiber = undefined;
	nextHydratableInstance = undefined;
	isHydrating = false;
}

export function getIsHydrating(): boolean {
	return isHydrating;
}
