/**
 * `useEffectEvent` — stable callback that always reads latest props/state.
 *
 * This hook provides a stable function reference that never changes
 * (doesn't need to be in dependency arrays) while always calling the
 * latest version of your callback.
 *
 * ```tsx
 * const onTick = useEffectEvent((deltaTime: number) => {
 *   print(positionRef.current); // always reads latest position
 * });
 *
 * useEffect(() => {
 *   const conn = RunService.Heartbeat.Connect(onTick);
 *   return () => conn.Disconnect();
 * }, []); // onTick doesn't need to be a dependency!
 * ```
 *
 * @module hooks/use-effect-event
 * @packageDocumentation
 */

import { useRef, useCallback } from './core';

/**
 * Returns a stable callback wrapper that always delegates to the latest
 * version of the provided function.
 *
 * @param callback - The event handler.
 * @returns A stable function reference.
 */
export function useEffectEvent<T extends (...args: Array<unknown>) => void>(callback: T): T {
	const ref = useRef(callback);
	ref.current = callback;

	const stable = useCallback((...args: Array<unknown>) => {
		(ref.current as (...a: Array<unknown>) => void)(...args);
	}, []) as unknown as T;

	return stable;
}
