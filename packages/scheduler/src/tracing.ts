/**
 * Scheduler tracing — tracks "interactions" (units of work triggered by a
 * discrete user action) so profiling tools can attribute scheduled work to the
 * interaction that caused it.
 *
 * Ported from `react-lua/modules/scheduler/src/Tracing.lua` and
 * `TracingSubscriptions.lua`. This is the module upstream exposes as
 * `scheduler/tracing`; the reconciler accesses it through `Scheduler.tracing`.
 *
 * Tracing is gated behind `enableSchedulerTracing`, which is `__PROFILE__`
 * (false in the default build), so the hot paths below are compiled away at
 * runtime but kept fully implemented for correctness.
 *
 * @module tracing
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { ReactFeatureFlags } from '@nrbx/react-shared';

const enableSchedulerTracing = ReactFeatureFlags.enableSchedulerTracing;

export type Interaction = {
	__count: number;
	id: number;
	name: string;
	timestamp: number;
};

export type Subscriber = {
	/** A new interaction has been created via the trace() method. */
	onInteractionTraced: (interaction: Interaction) => void;
	/** All scheduled async work for an interaction has finished. */
	onInteractionScheduledWorkCompleted: (interaction: Interaction) => void;
	/** New async work has been scheduled for a set of interactions. */
	onWorkScheduled: (interactions: Set<Interaction>, threadID: number) => void;
	/** A batch of scheduled work has been canceled. */
	onWorkCanceled: (interactions: Set<Interaction>, threadID: number) => void;
	/** A batch of work has started for a set of interactions. */
	onWorkStarted: (interactions: Set<Interaction>, threadID: number) => void;
	/** A batch of work has completed for a set of interactions. */
	onWorkStopped: (interactions: Set<Interaction>, threadID: number) => void;
};

export type InteractionsRef = { current: Set<Interaction> };
export type SubscriberRef = { current: Subscriber | undefined };

type Callback = (...args: defined[]) => defined;

const DEFAULT_THREAD_ID = 0;

// Counters used to generate unique IDs.
let interactionIDCounter = 0;
let threadIDCounter = 0;

// Set of currently traced interactions. Interactions "stack" — newly traced
// interactions are appended to the previously active set. When an interaction
// goes out of scope, the previous set (if any) is restored.
let interactionsRef: InteractionsRef | undefined;

// Listener(s) to notify when interactions begin and end.
let subscriberRef: SubscriberRef | undefined;

if (enableSchedulerTracing) {
	interactionsRef = { current: new Set<Interaction>() };
	subscriberRef = { current: undefined };
}

export const __interactionsRef = interactionsRef;
export const __subscriberRef = subscriberRef;

/**
 * Runs `callback` with the current interaction set temporarily cleared, then
 * restores it. Used to run work that should not be attributed to any
 * interaction.
 */
export function unstable_clear(callback: Callback): defined {
	if (!enableSchedulerTracing) {
		return callback();
	}

	const ref = interactionsRef as InteractionsRef;
	const prevInteractions = ref.current;
	ref.current = new Set<Interaction>();

	const [ok, result] = pcall(callback);
	ref.current = prevInteractions;

	if (!ok) {
		error(result as defined);
	}

	return result;
}

/**
 * Returns the set of currently traced interactions, or `undefined` when
 * tracing is disabled.
 */
export function unstable_getCurrent(): Set<Interaction> | undefined {
	if (!enableSchedulerTracing) {
		return undefined;
	}
	return (interactionsRef as InteractionsRef).current;
}

/**
 * Returns a monotonically increasing thread ID, unique for each call.
 */
export function unstable_getThreadID(): number {
	threadIDCounter += 1;
	return threadIDCounter;
}

/**
 * Traces a new interaction: runs `callback` inside the new interaction scope,
 * notifying subscribers when the interaction is created and when its
 * synchronous portion begins and ends.
 */
export function unstable_trace(name: string, timestamp: number, callback: Callback, threadID_?: number): defined {
	const threadID = threadID_ !== undefined ? threadID_ : DEFAULT_THREAD_ID;

	if (!enableSchedulerTracing) {
		return callback();
	}

	const ref = interactionsRef as InteractionsRef;
	const subRef = subscriberRef as SubscriberRef;

	const interaction: Interaction = {
		__count: 1,
		id: interactionIDCounter,
		name,
		timestamp,
	};
	interactionIDCounter += 1;

	const prevInteractions = ref.current;

	// Traced interactions should stack/accumulate. To do that, clone the
	// current interactions. The previous set will be restored upon completion.
	const interactions = new Set<Interaction>();
	for (const prevInteraction of prevInteractions) {
		interactions.add(prevInteraction);
	}
	interactions.add(interaction);
	ref.current = interactions;

	const subscriber = subRef.current;
	let returnValue: defined | undefined;

	const [ok, result] = pcall(() => {
		if (subscriber !== undefined) {
			subscriber.onInteractionTraced(interaction);
		}
	});
	const [ok2, result2] = pcall(() => {
		if (subscriber !== undefined) {
			subscriber.onWorkStarted(interactions, threadID);
		}
	});
	const [ok3, result3] = pcall(() => {
		returnValue = callback();
	});
	ref.current = prevInteractions;
	const [ok4, result4] = pcall(() => {
		if (subscriber !== undefined) {
			subscriber.onWorkStopped(interactions, threadID);
		}
	});
	interaction.__count -= 1;

	// If no async work was scheduled for this interaction, notify subscribers
	// that it's completed.
	if (subscriber !== undefined && interaction.__count === 0) {
		subscriber.onInteractionScheduledWorkCompleted(interaction);
	}

	if (!ok4) error(result4 as defined);
	if (!ok3) error(result3 as defined);
	if (!ok2) error(result2 as defined);
	if (!ok) error(result as defined);

	return returnValue as defined;
}

export type Wrapped = Callback & { cancel: () => void };

/**
 * Wraps `callback` so that it is run inside the current interaction scope,
 * returning a callable object with an attached `cancel()` method.
 */
export function unstable_wrap(callback: Callback, threadID: number | undefined): defined {
	const tid = threadID === undefined ? DEFAULT_THREAD_ID : threadID;

	if (!enableSchedulerTracing) {
		return callback as defined;
	}

	const ref = interactionsRef as InteractionsRef;
	const wrappedInteractions = ref.current;

	let subscriber = (subscriberRef as SubscriberRef).current;
	if (subscriber !== undefined) {
		subscriber.onWorkScheduled(wrappedInteractions, tid);
	}

	// Update the pending async work count for the current interactions.
	for (const interaction of wrappedInteractions) {
		interaction.__count += 1;
	}

	let hasRun = false;

	const _wrapped = (...args: defined[]): defined => {
		const prevInteractions = ref.current;
		ref.current = wrappedInteractions;

		subscriber = (subscriberRef as SubscriberRef).current;

		const [ok, result] = pcall(() => {
			let returnValue: defined | undefined;

			const [ok2, result2] = pcall(() => {
				if (subscriber !== undefined) {
					subscriber.onWorkStarted(wrappedInteractions, tid);
				}
			});
			const [ok3, result3] = pcall(() => {
				returnValue = callback(...args);
			});
			ref.current = prevInteractions;

			if (subscriber !== undefined) {
				subscriber.onWorkStopped(wrappedInteractions, tid);
			}

			if (!ok3) error(result3 as defined);
			if (!ok2) error(result2 as defined);

			return returnValue as defined;
		});

		if (!hasRun) {
			// We only expect a wrapped function to be executed once, but in the
			// event that it's executed more than once, only decrement the
			// outstanding interaction counts once.
			hasRun = true;

			for (const interaction of wrappedInteractions) {
				interaction.__count -= 1;
				if (subscriber !== undefined && interaction.__count === 0) {
					subscriber.onInteractionScheduledWorkCompleted(interaction);
				}
			}
		}

		if (!ok) error(result as defined);
		return result;
	};

	const _cancel = () => {
		subscriber = (subscriberRef as SubscriberRef).current;

		const [ok, result] = pcall(() => {
			if (subscriber !== undefined) {
				subscriber.onWorkCanceled(wrappedInteractions, tid);
			}
		});

		for (const interaction of wrappedInteractions) {
			interaction.__count -= 1;
			if (subscriber !== undefined && interaction.__count === 0) {
				subscriber.onInteractionScheduledWorkCompleted(interaction);
			}
		}

		if (!ok) error(result as defined);
	};

	const wrapped = _wrapped as Wrapped;
	wrapped.cancel = _cancel;

	return wrapped as defined;
}

type SubscriberSet = Map<Subscriber, boolean>;

let subscribers: SubscriberSet | undefined;
if (enableSchedulerTracing) {
	subscribers = new Map<Subscriber, boolean>();
}

/**
 * Registers a subscriber to be notified of interaction lifecycle events.
 */
export function unstable_subscribe(subscriber: Subscriber): void {
	if (enableSchedulerTracing) {
		const subs = subscribers as SubscriberSet;
		subs.set(subscriber, true);

		if (subs.size() === 1) {
			(subscriberRef as SubscriberRef).current = {
				onInteractionScheduledWorkCompleted,
				onInteractionTraced,
				onWorkCanceled,
				onWorkScheduled,
				onWorkStarted,
				onWorkStopped,
			};
		}
	}
}

/**
 * Removes a previously registered subscriber.
 */
export function unstable_unsubscribe(subscriber: Subscriber): void {
	if (enableSchedulerTracing) {
		const subs = subscribers as SubscriberSet;
		subs.delete(subscriber);

		if (subs.size() === 0) {
			(subscriberRef as SubscriberRef).current = undefined;
		}
	}
}

function onInteractionTraced(interaction: Interaction): void {
	let didCatchError = false;
	let caughtError: defined | undefined;

	for (const [subscriber] of subscribers as SubscriberSet) {
		const [ok, result] = pcall(subscriber.onInteractionTraced, interaction);
		if (!ok) {
			const error_ = result;
			if (!didCatchError) {
				didCatchError = true;
				caughtError = error_ as defined;
			}
		}
	}

	if (didCatchError) error(caughtError as defined);
}

function onInteractionScheduledWorkCompleted(interaction: Interaction): void {
	let didCatchError = false;
	let caughtError: defined | undefined;

	for (const [subscriber] of subscribers as SubscriberSet) {
		const [ok, result] = pcall(subscriber.onInteractionScheduledWorkCompleted, interaction);
		if (!ok) {
			const error_ = result;
			if (!didCatchError) {
				didCatchError = true;
				caughtError = error_ as defined;
			}
		}
	}

	if (didCatchError) error(caughtError as defined);
}

function onWorkScheduled(interactions: Set<Interaction>, threadID: number): void {
	let didCatchError = false;
	let caughtError: defined | undefined;

	for (const [subscriber] of subscribers as SubscriberSet) {
		const [ok, result] = pcall(subscriber.onWorkScheduled, interactions, threadID);
		if (!ok) {
			const error_ = result;
			if (!didCatchError) {
				didCatchError = true;
				caughtError = error_ as defined;
			}
		}
	}

	if (didCatchError) error(caughtError as defined);
}

function onWorkStarted(interactions: Set<Interaction>, threadID: number): void {
	let didCatchError = false;
	let caughtError: defined | undefined;

	for (const [subscriber] of subscribers as SubscriberSet) {
		const [ok, result] = pcall(subscriber.onWorkStarted, interactions, threadID);
		if (!ok) {
			const error_ = result;
			if (!didCatchError) {
				didCatchError = true;
				caughtError = error_ as defined;
			}
		}
	}

	if (didCatchError) error(caughtError as defined);
}

function onWorkStopped(interactions: Set<Interaction>, threadID: number): void {
	let didCatchError = false;
	let caughtError: defined | undefined;

	for (const [subscriber] of subscribers as SubscriberSet) {
		const [ok, result] = pcall(subscriber.onWorkStopped, interactions, threadID);
		if (!ok) {
			const error_ = result;
			if (!didCatchError) {
				didCatchError = true;
				caughtError = error_ as defined;
			}
		}
	}

	if (didCatchError) error(caughtError as defined);
}

function onWorkCanceled(interactions: Set<Interaction>, threadID: number): void {
	let didCatchError = false;
	let caughtError: defined | undefined;

	for (const [subscriber] of subscribers as SubscriberSet) {
		const [ok, result] = pcall(subscriber.onWorkCanceled, interactions, threadID);
		if (!ok) {
			const error_ = result;
			if (!didCatchError) {
				didCatchError = true;
				caughtError = error_ as defined;
			}
		}
	}

	if (didCatchError) error(caughtError as defined);
}
