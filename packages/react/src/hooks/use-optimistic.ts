/**
 * `useOptimistic` — applies an optimistic update, reverting when the
 * actual state resolves.
 *
 * ```tsx
 * const [optimisticName, setOptimisticName] = useOptimistic(
 *   name,
 *   (_, newName: string) => newName,
 * );
 * ```
 *
 * @module hooks/use-optimistic
 * @packageDocumentation
 */

import { useReducer, useEffect } from './core';

/**
 * Applies an optimistic update to state. The optimistic value is returned
 * immediately while the actual state is being processed. Once the actual
 * state changes, the optimistic value syncs back.
 *
 * @param state - The actual (source-of-truth) state.
 * @param reducer - Reducer that computes the optimistic value from an action.
 * @returns `[optimisticValue, setOptimisticValue]`.
 */
export function useOptimistic<T, U>(
	state: T,
	reducer: (currentState: T, action: U) => T
): LuaTuple<[T, (action: U) => void]> {
	const [optimisticState, dispatch] = useReducer((prev: T, action: U) => reducer(prev, action), state);

	// Sync back to the real state whenever it changes externally
	useEffect(() => {
		dispatch(state as unknown as U);
	}, [state]);

	return [optimisticState, dispatch] as LuaTuple<[T, (action: U) => void]>;
}
