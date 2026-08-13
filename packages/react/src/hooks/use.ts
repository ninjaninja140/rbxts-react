/**
 * `use` — reads a Context value or resolves a Promise (suspending if needed).
 *
 * React 19's universal data-reading hook. For `Context<T>` it behaves like
 * `useContext`. For `Promise<T>` it throws the promise to trigger Suspense.
 *
 * ```tsx
 * const theme = use(ThemeContext);
 * const data = use(fetchDataPromise);
 * ```
 *
 * @module hooks/use
 * @packageDocumentation
 */

import { useContext } from './core';

declare function type(value: unknown): string;

/** Cache of resolved/rejected promises keyed by promise object. */
const promiseCache = new Map<unknown, { kind: 'fulfilled'; value: unknown } | { kind: 'rejected'; error: unknown }>();

/**
 * Reads a Context value or resolves a Promise.
 *
 * - **Context**: returns `useContext(context)` — same as the React 17 API.
 * - **Promise**: if cached, returns the resolved value or throws the error.
 *   Otherwise throws the promise to trigger a Suspense fallback.
 *
 * @param input - A Context object or a Promise.
 * @returns The Context value or the resolved Promise value.
 */
export function use<T>(input: { Provider: unknown; Consumer: unknown } | Promise<T>): T {
	if (type(input) === 'table' && (input as { Provider: unknown }).Provider !== undefined) {
		return useContext(input as { Provider: unknown; Consumer: unknown }) as unknown as T;
	}

	const promise = input as Promise<T>;

	if (promiseCache.has(promise)) {
		const cached = promiseCache.get(promise)!;
		if (cached.kind === 'fulfilled') return cached.value as T;
		throw cached.error;
	}

	// Suspend: throw the promise so React can catch and show fallback
	throw promise.then(
		(value: T) => {
			promiseCache.set(promise, { kind: 'fulfilled', value });
		},
		(err: unknown) => {
			promiseCache.set(promise, { kind: 'rejected', error: err });
		}
	);
}
