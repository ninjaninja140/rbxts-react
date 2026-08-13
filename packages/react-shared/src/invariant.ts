/**
 * Assertion helper used throughout the React internals.
 *
 * Use `invariant()` to assert state which your program assumes to be true.
 * Provide `printf`-style formatting (only `%s` is supported) plus arguments
 * to describe what broke and what was expected.
 *
 * The message is always included at runtime — there is no production build
 * step to strip it, so keep messages concise.
 *
 * @module invariant
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

/**
 * Throws an error if `condition` is false.
 *
 * @param condition - The condition to check.
 * @param format - A `string.format`-style format string.
 * @param args - Format arguments.
 * @internal
 */
export default function invariant(condition: boolean, format: string, ...args: Array<unknown>): asserts condition {
	if (!condition) {
		error(string.format(format, ...(args as Array<string | number>)));
	}
}
