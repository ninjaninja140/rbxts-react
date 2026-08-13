/**
 * `cache` and `startTransition` — utility functions from React 19.
 *
 * @module hooks/cache
 * @packageDocumentation
 */

/**
 * Caches the result of a function based on its arguments.
 * Calls with the same arguments return the cached result.
 *
 * ```tsx
 * const getUser = cache(async (id: number) => dataService.GetUser(id));
 * const a = await getUser(1); // fetches from service
 * const b = await getUser(1); // returns cached result
 * ```
 *
 * @param fn - The function to cache.
 * @returns A memoized version of `fn`.
 */
export function cache<T extends (...args: never[]) => unknown>(fn: T): T {
	const store = new Map<string, unknown>();

	const cached = (...args: never[]): unknown => {
		const key = args.map((a) => tostring(a)).join('\0');
		if (store.has(key)) return store.get(key);
		const result = fn(...args);
		store.set(key, result);
		return result;
	};

	return cached as unknown as T;
}

/**
 * Starts a non-blocking transition — defers the callback so higher-
 * priority updates (input handling, animations) aren't blocked.
 *
 * ```tsx
 * startTransition(() => {
 *   setSearchResults(expensiveSearch(query));
 * });
 * ```
 *
 * @param callback - The callback to defer.
 */
export function startTransition(callback: () => void): void {
	task.defer(callback);
}
