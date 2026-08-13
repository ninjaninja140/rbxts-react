/**
 * `useDeferredValue` — defers a value, keeping the stale version visible
 * during rapid updates.
 *
 * ```tsx
 * const deferredQuery = useDeferredValue(query);
 * ```
 *
 * @module hooks/use-deferred-value
 * @packageDocumentation
 */

import { useState, useEffect } from './core';

/**
 * Defers a value — returns the previous value while the current value is
 * being applied, which helps avoid loading spinners for fast transitions.
 *
 * @param value - The latest value to defer.
 * @returns The deferred (slightly stale) value.
 */
export function useDeferredValue<T>(value: T): T {
	const [deferred, setDeferred] = useState(value);

	useEffect(() => {
		setDeferred(value);
	}, [value]);

	return deferred;
}
