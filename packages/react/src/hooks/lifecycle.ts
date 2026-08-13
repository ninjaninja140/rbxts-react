/**
 * Utility lifecycle hooks.
 *
 * @module hooks/lifecycle
 * @packageDocumentation
 */

import { useEffect } from './core';

/**
 * Registers a callback to run on mount and unmount.
 *
 * ```tsx
 * useLifecycle(() => {
 *   print("mounted");
 *   return () => print("unmounting");
 * });
 * ```
 *
 * @param callback - Called on mount; optionally returns an unmount cleanup.
 */
export function useLifecycle(callback: () => (() => void) | void): void {
	useEffect(callback, []);
}

/**
 * Debug hook — a no-op on Roblox React 17.
 *
 * @param _value - The value to label in DevTools.
 * @param _format - Optional formatting function.
 */
export function useDebugValue<T>(_value: T, _format?: (val: T) => string): void {
	// No-op: React 17 Roblox runtime doesn't support DevTools labels
}
