/**
 * Minimal `Object.assign`/`Object.freeze` polyfills for Luau.
 *
 * Luau has no `Object` namespace, so these wrap the `table` library and
 * `pairs` iteration. They exist so ported reconciler code can keep the
 * familiar upstream call shapes without depending on a JS polyfill.
 *
 * @module object
 * @internal
 * @packageDocumentation
 */

/**
 * Shallow-copies all enumerable key/value pairs from `sources` (in order)
 * onto `target`, then returns `target`. Matches the observable behavior of
 * `Object.assign(target, ...sources)`.
 *
 * @internal
 */
export function assign<T extends object>(target: T, ...sources: Array<object>): T {
	for (const source of sources) {
		for (const [key, value] of pairs(source)) {
			(target as Record<string, unknown>)[key as string] = value;
		}
	}
	return target;
}

/**
 * Makes a table read-only (shallow), matching `Object.freeze` for the
 * purposes it is used for in the reconciler.
 *
 * @internal
 */
export function freeze<T extends object>(value: T): Readonly<T> {
	return table.freeze(value);
}
