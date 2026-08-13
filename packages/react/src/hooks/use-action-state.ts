/**
 * `useActionState` — manages form action state with pending flag.
 *
 * React 19's hook for server actions / form submissions. Returns the
 * latest state, a dispatch function, and a pending boolean.
 *
 * ```tsx
 * const [state, submitAction, isPending] = useActionState(
 *   async (prevState, formData: MyData) => {
 *     await saveToServer(formData);
 *     return { success: true };
 *   },
 *   { success: false },
 * );
 * ```
 *
 * @module hooks/use-action-state
 * @packageDocumentation
 */

import { useState } from './core';
import { useTransition } from './use-transition';

/**
 * Manages async action state with a pending flag.
 *
 * @param action - Async function `(prevState, payload) => newState`.
 * @param initialState - Initial state value.
 * @param _permalink - Ignored on Roblox (no SSR permalink support).
 * @returns `[state, dispatch, isPending]`.
 */
export function useActionState<S, P>(
	action: (state: Awaited<S>, payload: P) => S | Promise<S>,
	initialState: Awaited<S>,
	_permalink?: string
): LuaTuple<[Awaited<S>, (payload: P) => void, boolean]> {
	const [state, setState] = useState<Awaited<S>>(initialState);
	const [isPending, startTransition] = useTransition();

	const dispatch = (payload: P): void => {
		startTransition(() => {
			Promise.resolve(action(state, payload) as S | PromiseLike<S>)
				.then((newState) => setState(newState as Awaited<S>))
				.catch((err) => {
					warn(`useActionState: action failed: ${err}`);
				});
		});
	};

	return [state, dispatch, isPending] as LuaTuple<[Awaited<S>, (payload: P) => void, boolean]>;
}
