/**
 * Feature-flag shims.
 *
 * The upstream Roblox runtime reads fast flags through `game:DefineFastFlag`
 * / `game:GetFastFlag`, which are only available inside the Roblox engine. A
 * public npm package can't call those, so these shims return a fixed default
 * instead. Callers can pass the default they want a flag to resolve to.
 *
 * @module SafeFlags
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

/**
 * Returns a getter for a fast flag.
 *
 * Because public packages can't define engine fast flags, the returned
 * function always returns the provided `value` (or `false`).
 *
 * @param name - The name of the fast flag (unused outside Roblox).
 * @param value - The default value to return. Defaults to `false`.
 * @returns A zero-argument function returning the default value.
 */
export function createGetFFlag(_name: string, value?: boolean): () => boolean {
	return () => value ?? false;
}

/**
 * Returns a getter for a fast integer flag.
 *
 * Because public packages can't define engine fast ints, the returned
 * function always returns the provided `value`.
 *
 * @param name - The name of the fast int flag (unused outside Roblox).
 * @param value - The default value to return.
 * @returns A zero-argument function returning the default value.
 */
export function createGetFInt(_name: string, value: number): () => number {
	return () => value;
}
