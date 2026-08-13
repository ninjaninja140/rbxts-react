/**
 * Core React hooks — thin typed wrappers around the native runtime.
 *
 * Each function delegates directly to the hooks implemented in
 * `@nrbx/react`'s own `core` module (`./core/ReactHooks`). No polyfilling or
 * extra logic here — just typed passthroughs, with `useMemoCompare` (a Roblox
 * extension) implemented natively on top of `useRef` + `useEffect`.
 *
 * @module hooks/core
 * @packageDocumentation
 */

import {
	useCallback as coreUseCallback,
	useContext as coreUseContext,
	useEffect as coreUseEffect,
	useImperativeHandle as coreUseImperativeHandle,
	useLayoutEffect as coreUseLayoutEffect,
	useMemo as coreUseMemo,
	useReducer as coreUseReducer,
	useRef as coreUseRef,
	useState as coreUseState,
} from '../core';

// useRef

/**
 * Stores a mutable value that persists across re-renders. Mutating
 * `.current` does NOT trigger a re-render.
 *
 * ```tsx
 * const btnRef = useRef<TextButton>();
 * btnRef.current?.CaptureFocus();
 * ```
 */
export function useRef<T>(initialValue?: T): { current: T | undefined } {
	return coreUseRef(initialValue as T) as { current: T | undefined };
}

// useState

/**
 * Stores a stateful value. Changing it via the setter triggers a re-render.
 *
 * ```tsx
 * const [count, setCount] = useState(0);
 * const [name, setName] = useState<string>();
 * ```
 */
export function useState<S>(initialState: S | (() => S)): LuaTuple<[S, (newState: S | ((prevState: S) => S)) => void]> {
	return coreUseState(initialState) as unknown as LuaTuple<[S, (ns: S | ((prev: S) => S)) => void]>;
}

// useReducer

/**
 * Accepts a reducer function and initial state.
 *
 * ```tsx
 * const [state, dispatch] = useReducer(
 *   (state, action: { type: string }) => {
 *     if (action.type === "inc") return { count: state.count + 1 };
 *     return state;
 *   },
 *   { count: 0 },
 * );
 * ```
 */
export function useReducer<R extends (state: any, action: any) => any>(
	reducer: R,
	initialState: Parameters<R>[0]
): LuaTuple<[Parameters<R>[0], (action: Parameters<R>[1]) => void]> {
	return coreUseReducer(reducer as never, initialState as never) as unknown as LuaTuple<
		[Parameters<R>[0], (a: Parameters<R>[1]) => void]
	>;
}

// useEffect

/**
 * Runs a side-effect after every render. Returns an optional cleanup
 * function that runs before the next effect or on unmount.
 *
 * ```tsx
 * useEffect(() => {
 *   const conn = signal.Connect(handler);
 *   return () => conn.Disconnect();
 * }, [signal]);
 * ```
 */
export function useEffect(effect: () => (() => void) | void, deps?: unknown[]): void {
	coreUseEffect(effect, deps);
}

// useLayoutEffect

/**
 * Like `useEffect` but fires synchronously after Roblox instance mutations.
 * Prefer `useEffect` unless you need to read layout measurements.
 *
 * ```tsx
 * useLayoutEffect(() => {
 *   const size = element.AbsoluteSize;
 * }, []);
 * ```
 */
export function useLayoutEffect(effect: () => (() => void) | void, deps?: unknown[]): void {
	coreUseLayoutEffect(effect, deps);
}

// useMemo

/**
 * A memoized value. Only recomputes when dependencies change.
 *
 * ```tsx
 * const sorted = useMemo(() => sortItems(items), [items]);
 * ```
 */
export function useMemo<T>(factory: () => T, deps: unknown[]): T {
	return coreUseMemo(factory, deps) as T;
}

// useCallback

/**
 * A memoized callback. Only changes when dependencies change.
 *
 * ```tsx
 * const onClick = useCallback(() => handleClick(id), [id]);
 * ```
 */
export function useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: unknown[]): T {
	return coreUseCallback(callback, deps) as T;
}

// useContext

/**
 * Reads a React Context value.
 *
 * ```tsx
 * const theme = useContext(ThemeContext);
 * ```
 */
export function useContext<T>(context: unknown): T {
	return coreUseContext(context as never) as T;
}

// useMemoCompare

/**
 * Accepts a value and a comparison function; only keeps the *new* value when
 * the comparison reports the two values as different. This keeps the returned
 * value referentially stable across re-renders for as long as it compares
 * equal, which lets memoized children skip re-rendering.
 *
 * ```tsx
 * const query = useMemoCompare(searchTerm, (a, b) => a === b);
 * ```
 */
export function useMemoCompare<T>(value: T, compare?: (a: T, b: T) => boolean): T {
	const ref = coreUseRef(value);
	const previous = ref.current;
	const isEqual = compare !== undefined ? compare(previous, value) : previous === value;

	coreUseEffect(() => {
		if (!isEqual) {
			ref.current = value;
		}
	});

	return isEqual ? previous : value;
}

// useImperativeHandle

/**
 * Imperative handle for use with `forwardRef`.
 *
 * ```tsx
 * useImperativeHandle(ref, () => ({ focus: () => ref.current?.CaptureFocus() }));
 * ```
 */
export function useImperativeHandle<T, R extends T>(
	ref: { current?: T } | ((val: T) => void) | undefined,
	createHandle: () => R,
	deps?: unknown[]
): void {
	coreUseImperativeHandle(ref as { current: T | undefined }, createHandle, deps);
}
