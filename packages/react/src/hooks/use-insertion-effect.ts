/**
 * `useInsertionEffect` — fires synchronously before layout effects.
 *
 * On Roblox this delegates to `useLayoutEffect` since there is no CSSOM
 * to inject styles into. Provided for React 19 API compatibility.
 *
 * ```tsx
 * useInsertionEffect(() => {
 *   // setup that must run before layout measurement
 * }, []);
 * ```
 *
 * @module hooks/use-insertion-effect
 * @packageDocumentation
 */

import { useLayoutEffect } from './core';

/**
 * Fires synchronously before layout effects.
 *
 * @param effect - The effect callback; optionally returns cleanup.
 * @param deps - Optional dependency array.
 */
export function useInsertionEffect(effect: () => (() => void) | void, deps?: unknown[]): void {
	useLayoutEffect(effect, deps);
}
