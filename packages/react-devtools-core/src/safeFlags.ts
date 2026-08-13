/**
 * Feature-flag shims.
 *
 * The upstream backend uses Roblox-internal fast flags to gate behaviour. A
 * public npm package can't call `DefineFastFlag`, so these shims return a
 * sensible default instead.
 *
 * @module safeFlags
 * @packageDocumentation
 */

/**
 * Returns a getter for a fast flag.
 *
 * Because public packages can't define engine fast flags, the returned
 * function always returns the provided `value` (or `false`).
 */
export function createGetFFlag(_name: string, value?: boolean): () => boolean {
	return () => value ?? false;
}

/**
 * Returns a getter for a fast integer flag.
 *
 * Because public packages can't define engine fast ints, the returned
 * function always returns the provided `value` (or `0`).
 */
export function createGetFInt(_name: string, value: number): () => number {
	return () => value;
}
