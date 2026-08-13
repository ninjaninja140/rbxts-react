/**
 * `useId` — Generates a unique, stable ID string.
 *
 * Uses `HttpService:GenerateGUID()` when available, falling back to a
 * monotonically-incrementing counter.
 *
 * ```tsx
 * const id = useId(); // ":r1-aB3dEfGh"
 * ```
 *
 * @module hooks/use-id
 * @packageDocumentation
 */

import { useState } from './core';

let _counter = 0;

/**
 * Generates a unique, stable ID string.
 *
 * The ID is stable across re-renders and unique per component instance.
 * Uses `HttpService:GenerateGUID()` for randomness when available,
 * falling back to a counter-only format.
 *
 * @returns A unique ID string like `":r1-aB3dEfGh"`.
 */
export function useId(): string {
	const [id] = useState<string>(() => {
		_counter += 1;
		try {
			const http = game.GetService('HttpService') as HttpService;
			return `:r${_counter}-${http.GenerateGUID(false).sub(1, 8)}`;
		} catch {
			return `:r${_counter}:`;
		}
	});
	return id;
}
