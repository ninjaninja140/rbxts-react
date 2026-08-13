/**
 * Context dependency tracking for the fiber reconciler.
 *
 * Tracks which contexts a component reads during render so that, when a
 * provider's value changes, only the fibers that actually depend on that
 * context get re-rendered. The dependencies are stored as a linked list on the
 * fiber and reset before each render pass.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberNewContext.new.lua`.
 *
 * @module ReactFiberNewContext
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { console, objectIs } from '@nrbx/react-shared';
import type { ReactContext } from '@nrbx/react-shared';

import HostConfig from './ReactFiberHostConfig';
import { MAX_SIGNED_31_BIT_INT } from './MaxInts';
import {
	includesSomeLane,
	isSubsetOfLanes,
	mergeLanes,
	NoLanes,
	NoTimestamp,
	pickArbitraryLane,
} from './ReactFiberLane';
import { createCursor, pop, push } from './ReactFiberStack.new';
import type { StackCursor } from './ReactFiberStack.new';
import { ClassComponent, ContextProvider } from './ReactWorkTags';
import type { ContextDependency, Fiber, Lanes, Update } from './types';
import * as ReactUpdateQueue from './ReactUpdateQueue.new';

// Luau has no `Number.MAX_SAFE_INTEGER`; the upstream `typeof` check compares
// against the JS constant, so we replicate its value here.
const MAX_SAFE_INTEGER = 9007199254740991;

// Read lazily — `isPrimaryRenderer` is spliced in by the renderer at
// `initialize()` time, long after this module's body has executed.
const isPrimaryRenderer = () => HostConfig.isPrimaryRenderer;

// NewContext is part of a static import cycle with ReactUpdateQueue
// (UpdateQueue imports NewContext for its DEV-only disallowed-read guards, and
// NewContext imports UpdateQueue for these two exports). roblox-ts hoists
// imports, so either side can observe a partially-initialized module table.
// Forwarding at call time is what keeps both directions safe.
const createUpdate = (eventTime: number, lane: number, payload?: any, callback?: (...args: Array<any>) => any) =>
	ReactUpdateQueue.createUpdate(eventTime, lane, payload, callback);
const ForceUpdate = () => ReactUpdateQueue.ForceUpdate;

const valueCursor: StackCursor<unknown> = createCursor<unknown>(undefined);

// Used in DEV to detect multiple renderers using the same context.
let rendererSigil: object | undefined;
if (__DEV__) {
	rendererSigil = {};
}

let currentlyRenderingFiber: Fiber | undefined;
let lastContextDependency: ContextDependency<any> | undefined;
let lastContextWithAllBitsObserved: ReactContext<any> | undefined;

let isDisallowedContextReadInDEV = false;

/**
 * Called right before React yields execution so `readContext` cannot be
 * called outside of the render phase.
 *
 * @internal
 */
export function resetContextDependencies(): void {
	currentlyRenderingFiber = undefined;
	lastContextDependency = undefined;
	lastContextWithAllBitsObserved = undefined;
	if (__DEV__) {
		isDisallowedContextReadInDEV = false;
	}
}

/**
 * Marks a region where context reads are disallowed (used by hooks such as
 * `useReducer` and `useMemo`).
 *
 * @internal
 */
export function enterDisallowedContextReadInDEV(): void {
	if (__DEV__) {
		isDisallowedContextReadInDEV = true;
	}
}

/**
 * Ends a disallowed-read region.
 *
 * @internal
 */
export function exitDisallowedContextReadInDEV(): void {
	if (__DEV__) {
		isDisallowedContextReadInDEV = false;
	}
}

/**
 * Pushes a provider's new value onto the context stack.
 *
 * @param providerFiber - The fiber of the `<Context.Provider>` being rendered.
 * @param nextValue - The value the provider is now exposing.
 * @internal
 */
export function pushProvider<T>(providerFiber: Fiber, nextValue: T): void {
	const context = (providerFiber.type as { _context: ReactContext<T> })._context;

	if (isPrimaryRenderer()) {
		push(valueCursor, context._currentValue, providerFiber);

		context._currentValue = nextValue;
		if (__DEV__) {
			if (context._currentRenderer !== undefined && context._currentRenderer !== rendererSigil) {
				console.error(
					'Detected multiple renderers concurrently rendering the ' +
						'same context provider. This is currently unsupported.'
				);
			}
			context._currentRenderer = rendererSigil;
		}
	} else {
		push(valueCursor, context._currentValue2, providerFiber);

		context._currentValue2 = nextValue;
		if (__DEV__) {
			if (context._currentRenderer2 !== undefined && context._currentRenderer2 !== rendererSigil) {
				console.error(
					'Detected multiple renderers concurrently rendering the ' +
						'same context provider. This is currently unsupported.'
				);
			}
			context._currentRenderer2 = rendererSigil;
		}
	}
}

/**
 * Restores the previous value when a provider unmounts or finishes rendering.
 *
 * @param providerFiber - The fiber of the `<Context.Provider>` being popped.
 * @internal
 */
export function popProvider(providerFiber: Fiber): void {
	const currentValue = valueCursor.current;

	pop(valueCursor, providerFiber);

	const context = (providerFiber.type as { _context: ReactContext<any> })._context;
	if (isPrimaryRenderer()) {
		context._currentValue = currentValue;
	} else {
		context._currentValue2 = currentValue;
	}
}

/**
 * Computes the changed-bits value used to decide whether a consumer should be
 * re-rendered. Returns `0` when `oldValue` and `newValue` are identical.
 *
 * @param context - The context whose value changed.
 * @param newValue - The new value.
 * @param oldValue - The previous value.
 * @returns The changed-bits bitmask.
 * @internal
 */
export function calculateChangedBits<T>(context: ReactContext<T>, newValue: T, oldValue: T): number {
	if (objectIs(oldValue, newValue)) {
		// No change.
		return 0;
	}

	let changedBits = MAX_SIGNED_31_BIT_INT;
	if (typeOf(context._calculateChangedBits) === 'function') {
		changedBits = (context._calculateChangedBits as (a: T, b: T) => number)(oldValue, newValue);
	}

	// Upstream floors the value with a bitwise `| 0`; `math.floor` is the
	// direct Luau equivalent.
	return math.floor(changedBits);
}

/**
 * Marks `renderLanes` as pending on every ancestor of `parent`, including
 * their alternates.
 *
 * @param parent - The fiber whose ancestors need their child lanes updated.
 * @param renderLanes - The lanes being scheduled.
 * @internal
 */
export function scheduleWorkOnParentPath(parent: Fiber | undefined, renderLanes: Lanes): void {
	let node = parent;
	while (node !== undefined) {
		const alternate = node.alternate;
		if (!isSubsetOfLanes(node.childLanes, renderLanes)) {
			node.childLanes = mergeLanes(node.childLanes, renderLanes);
			if (alternate !== undefined) {
				alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes);
			}
		} else if (alternate !== undefined && !isSubsetOfLanes(alternate.childLanes, renderLanes)) {
			alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes);
		} else {
			// Neither alternate was updated, which means the rest of the
			// ancestor path already has sufficient priority.
			break;
		}
		node = node.return_;
	}
}

/**
 * Walks the subtree below a changed provider and schedules work on every fiber
 * whose dependency list references that context.
 *
 * @param workInProgress - The provider fiber whose value changed.
 * @param context - The context that changed.
 * @param changedBits - The changed-bits bitmask for this update.
 * @param renderLanes - The lanes being rendered.
 * @internal
 */
export function propagateContextChange<T>(
	workInProgress: Fiber,
	context: ReactContext<T>,
	changedBits: number,
	renderLanes: Lanes
): void {
	let fiber = workInProgress.child;
	if (fiber !== undefined) {
		// Set the return pointer of the child to the work-in-progress fiber.
		fiber.return_ = workInProgress;
	}
	while (fiber !== undefined) {
		let nextFiber: Fiber | undefined;

		// Visit this fiber.
		const list = fiber.dependencies;
		if (list !== undefined) {
			nextFiber = fiber.child;

			let dependency = list.firstContext;
			while (dependency !== undefined) {
				// Check if the context matches.
				if (dependency.context === context && bit32.band(dependency.observedBits, changedBits) !== 0) {
					// Match! Schedule an update on this fiber.

					if (fiber.tag === ClassComponent) {
						// Schedule a force update on the work-in-progress.
						const update = createUpdate(NoTimestamp, pickArbitraryLane(renderLanes));
						update.tag = ForceUpdate();
						// TODO: Because we don't have a work-in-progress, this will add the
						// update to the current fiber too, which means it will persist even if
						// this render is thrown away. Since it's a race condition, not sure
						// it's worth fixing.

						// Inlined `enqueueUpdate` to remove the interleaved update check.
						const updateQueue = fiber.updateQueue as unknown;
						if (updateQueue === undefined) {
							// Only occurs if the fiber has been unmounted.
						} else {
							const sharedQueue = (updateQueue as { shared: { pending: Update<unknown> | undefined } })
								.shared;
							const pending = sharedQueue.pending;
							if (pending === undefined) {
								// This is the first update. Create a circular list.
								update.next = update;
							} else {
								update.next = pending.next;
								pending.next = update;
							}
							sharedQueue.pending = update;
						}
					}

					fiber.lanes = bit32.bor(fiber.lanes, renderLanes);
					const alternate = fiber.alternate;
					if (alternate !== undefined) {
						alternate.lanes = bit32.bor(alternate.lanes, renderLanes);
					}
					scheduleWorkOnParentPath(fiber.return_, renderLanes);

					// Mark the updated lanes on the list, too.
					list.lanes = bit32.bor(list.lanes, renderLanes);

					// Since we already found a match, we can stop traversing the
					// dependency list.
					break;
				}
				dependency = dependency.next;
			}
		} else if (fiber.tag === ContextProvider) {
			// Don't scan deeper if this is a matching provider.
			if ((fiber.type as unknown) === (workInProgress.type as unknown)) {
				nextFiber = undefined;
			} else {
				nextFiber = fiber.child;
			}
		} else {
			// Traverse down.
			nextFiber = fiber.child;
		}

		if (nextFiber !== undefined) {
			// Set the return pointer of the child to the work-in-progress fiber.
			nextFiber.return_ = fiber;
		} else {
			// No child. Traverse to next sibling.
			nextFiber = fiber;
			while (nextFiber !== undefined) {
				if (nextFiber === workInProgress) {
					// We're back to the root of this subtree. Exit.
					nextFiber = undefined;
					break;
				}
				const sibling = nextFiber.sibling;
				if (sibling !== undefined) {
					// Set the return pointer of the sibling to the work-in-progress fiber.
					sibling.return_ = nextFiber.return_;
					nextFiber = sibling;
					break;
				}
				// No more siblings. Traverse up.
				nextFiber = nextFiber.return_;
			}
		}
		fiber = nextFiber;
	}
}

/**
 * Prepares a fiber to read context, resetting its dependency list and marking
 * it as having received work if its dependencies have pending updates.
 *
 * @param workInProgress - The fiber about to render.
 * @param renderLanes - The lanes being rendered.
 * @param markWorkInProgressReceivedUpdate - Callback used to flag that the
 *   fiber performed work. Passed in as an argument to break the static import
 *   cycle with `ReactFiberBeginWork.new`.
 * @internal
 */
export function prepareToReadContext(
	workInProgress: Fiber,
	renderLanes: Lanes,
	markWorkInProgressReceivedUpdate: () => void
): void {
	currentlyRenderingFiber = workInProgress;
	lastContextDependency = undefined;
	lastContextWithAllBitsObserved = undefined;

	const dependencies = workInProgress.dependencies;
	if (dependencies !== undefined) {
		const firstContext = dependencies.firstContext;
		if (firstContext !== undefined) {
			if (includesSomeLane(dependencies.lanes, renderLanes)) {
				// Context list has a pending update. Mark that this fiber performed work.
				markWorkInProgressReceivedUpdate();
			}
			// Reset the work-in-progress list.
			dependencies.firstContext = undefined;
		}
	}
}

/**
 * Reads the current value of a context and records the dependency so future
 * changes to that context re-render the reading fiber.
 *
 * @param context - The context to read.
 * @param observedBits - Optional bitset limiting which changes are observed.
 * @returns The current context value.
 * @internal
 */
export function readContext<T>(context: ReactContext<T>, observedBits?: number | boolean): T {
	if (__DEV__) {
		// This warning would fire if you read context inside a Hook like useMemo.
		// Unlike the class check below, it's not enforced in production for perf.
		if (isDisallowedContextReadInDEV) {
			console.error(
				'Context can only be read while React is rendering. ' +
					'In classes, you can read it in the render method or getDerivedStateFromProps. ' +
					'In function components, you can read it directly in the function body, but not ' +
					'inside Hooks like useReducer() or useMemo().'
			);
		}
	}

	if (lastContextWithAllBitsObserved === context) {
		// Nothing to do. We already observe everything in this context.
	} else if (observedBits === false || observedBits === 0) {
		// Do not observe any updates.
	} else {
		let resolvedObservedBits: number;
		if (typeOf(observedBits) !== 'number' || observedBits === MAX_SAFE_INTEGER) {
			// Observe all updates.
			lastContextWithAllBitsObserved = context;
			resolvedObservedBits = MAX_SAFE_INTEGER;
		} else {
			resolvedObservedBits = observedBits as number;
		}

		const contextItem: ContextDependency<any> = {
			context,
			observedBits: resolvedObservedBits,
			next: undefined,
		};

		if (lastContextDependency === undefined) {
			if (currentlyRenderingFiber === undefined) {
				error(
					'Context can only be read while React is rendering. ' +
						'In classes, you can read it in the render method or getDerivedStateFromProps. ' +
						'In function components, you can read it directly in the function body, but not ' +
						'inside Hooks like useReducer() or useMemo().'
				);
			}

			// This is the first dependency for this component. Create a new list.
			lastContextDependency = contextItem;
			currentlyRenderingFiber.dependencies = {
				lanes: NoLanes,
				firstContext: contextItem,
			};
		} else {
			// Append a new context item.
			lastContextDependency.next = contextItem;
			lastContextDependency = contextItem;
		}
	}
	return isPrimaryRenderer() ? context._currentValue : context._currentValue2;
}
