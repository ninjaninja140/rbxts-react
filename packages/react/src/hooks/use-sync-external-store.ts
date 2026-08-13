/**
 * `useSyncExternalStore` — subscribes to an external store.
 *
 * Implemented as the recommended shim from the React docs: `useState`
 * for forcing re-renders plus `useEffect` for subscribing.
 *
 * ```tsx
 * const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
 * ```
 *
 * @module hooks/use-sync-external-store
 * @packageDocumentation
 */

import { useState, useEffect } from './core';

/**
 * Subscribes to an external store and returns its current snapshot.
 * Re-renders when the store notifies a change.
 *
 * @param subscribe - Callback accepting a listener; returns unsubscribe.
 * @param getSnapshot - Returns the current store value.
 * @param _getServerSnapshot - Server snapshot (stubbed — no SSR on Roblox).
 * @returns The current store value.
 */
export function useSyncExternalStore<T>(
	subscribe: (callback: () => void) => () => void,
	getSnapshot: () => T,
	_getServerSnapshot?: () => T
): T {
	const [state, setState] = useState(getSnapshot);

	useEffect(() => {
		return subscribe(() => {
			setState(getSnapshot());
		});
	}, [subscribe, getSnapshot]);

	return state;
}
