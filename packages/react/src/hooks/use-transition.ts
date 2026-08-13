/**
 * `useTransition` — non-blocking transition with pending flag.
 *
 * ```tsx
 * const [isPending, startTransition] = useTransition();
 * startTransition(() => setResults(search(query)));
 * ```
 *
 * @module hooks/use-transition
 * @packageDocumentation
 */

import { useState } from './core';

/**
 * Returns `[isPending, startTransition]`.
 *
 * `startTransition` defers its callback via `task.defer()` so that
 * higher-priority updates like user input aren't blocked.
 *
 * @returns A tuple of `[isPending, startTransition]`.
 */
export function useTransition(): LuaTuple<[boolean, (callback: () => void) => void]> {
	const [isPending, setPending] = useState(false);

	const startTransition = (callback: () => void): void => {
		setPending(true);
		task.defer(() => {
			callback();
			setPending(false);
		});
	};

	return [isPending, startTransition] as LuaTuple<[boolean, (callback: () => void) => void]>;
}
