/**
 * Public hook entry points.
 *
 * Every hook here is a thin wrapper that resolves the currently installed
 * dispatcher (owned by the reconciler) and forwards the call to it. Hooks must
 * only be called while a function component is rendering, because that is the
 * only time the reconciler leaves a dispatcher installed; calling one outside
 * of render produces the familiar "invalid hook call" error.
 *
 * @module ReactHooks
 * @packageDocumentation
 */

import { __DEV__ } from '@nrbx/react-globals';
import { console, ReactSharedInternals } from '@nrbx/react-shared';
import type {
	Dispatcher,
	MutableSource,
	MutableSourceGetSnapshotFn,
	MutableSourceSubscribeFn,
	ReactBinding,
	ReactBindingUpdater,
	ReactContext,
} from '@nrbx/react-shared';

const { ReactCurrentDispatcher } = ReactSharedInternals;

type BasicStateAction<S> = ((value: S) => S) | S;
type Dispatch<A> = (value: A) => void;

/**
 * Returns the dispatcher installed by the reconciler, or `undefined` when
 * called outside of a render (in which case the caller produces an error).
 *
 * @internal
 */
function resolveDispatcher(): Dispatcher {
	const dispatcher = ReactCurrentDispatcher.current;
	if (__DEV__) {
		if (dispatcher === undefined) {
			console.error(
				'Invalid hook call. Hooks can only be called inside of the body of a function component. ' +
					'This could happen for one of the following reasons:\n' +
					'1. You might have mismatching versions of React and the renderer\n' +
					'2. You might be breaking the Rules of Hooks\n' +
					'3. You might have more than one copy of React in the same app\n' +
					'See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.'
			);
		}
	}
	// Accessing a nil field on the dispatcher (or indexing nil itself) raises a
	// native error here, which is intentional: it keeps the hot path free of an
	// extra branch. The error is only reachable by violating the Rules of Hooks.
	return dispatcher as Dispatcher;
}

/**
 * Reads the nearest value from a context created with `React.createContext`.
 *
 * ```tsx
 * const Theme = React.createContext("light");
 * const theme = useContext(Theme);
 * ```
 */
export function useContext<T>(Context: ReactContext<T>, unstable_observedBits?: number | boolean): T {
	const dispatcher = resolveDispatcher();
	if (__DEV__) {
		if (unstable_observedBits !== undefined) {
			console.error(
				'useContext() second argument is reserved for future use in React. ' +
					'Passing it is not supported. You passed: %s.',
				tostring(unstable_observedBits)
			);
		}

		// Warn if someone passes Context.Consumer or Context.Provider by mistake.
		const contextObject = Context as unknown as { _context?: ReactContext<T> };
		if (contextObject._context !== undefined) {
			const realContext = contextObject._context;
			if ((realContext.Consumer as unknown) === (Context as unknown)) {
				console.error(
					'Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be ' +
						'removed in a future major release. Did you mean to call useContext(Context) instead?'
				);
			} else if ((realContext.Provider as unknown) === (Context as unknown)) {
				console.error(
					'Calling useContext(Context.Provider) is not supported. ' +
						'Did you mean to call useContext(Context) instead?'
				);
			}
		}
	}
	return dispatcher.useContext(Context, unstable_observedBits);
}

/**
 * Returns a stateful value and a function to update it.
 *
 * ```tsx
 * const [count, setCount] = useState(0);
 * ```
 */
export function useState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>] {
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
}

/**
 * An alternative to `useState` for complex state logic that involves multiple
 * sub-values, or when the next state depends on the previous one.
 */
export function useReducer<S, I, A>(
	reducer: (state: S, action: A) => S,
	initialArg: I,
	init?: (arg: I) => S
): [S, Dispatch<A>] {
	const dispatcher = resolveDispatcher();
	return dispatcher.useReducer(reducer, initialArg, init);
}

/**
 * Returns a mutable ref object whose `.current` property is initialized to the
 * passed argument. The object persists for the full lifetime of the component.
 */
export function useRef<T>(initialValue: T): { current: T } {
	const dispatcher = resolveDispatcher();
	return dispatcher.useRef(initialValue);
}

/**
 * Creates a Roact-style binding that can be assigned directly to Roblox
 * instance properties. Updating a binding does not re-render the component,
 * which makes it well suited to high-frequency updates such as animations.
 *
 * This is a Roblox-specific extension; web React has no equivalent.
 */
export function useBinding<T>(initialValue: T): [ReactBinding<T>, ReactBindingUpdater<T>] {
	const dispatcher = resolveDispatcher();
	return dispatcher.useBinding(initialValue);
}

/**
 * Runs an imperative, possibly effectful function after the component commits.
 *
 * @param create - The effect. May return a cleanup function.
 * @param deps - If present, the effect only runs when one of these changes.
 */
export function useEffect(create: () => (() => void) | void, deps?: Array<unknown>): void {
	const dispatcher = resolveDispatcher();
	dispatcher.useEffect(create, deps);
	return;
}

/**
 * Identical to `useEffect`, but fires synchronously after the renderer has
 * applied changes. Prefer `useEffect` unless you need to measure or mutate
 * something before the next paint.
 */
export function useLayoutEffect(create: () => (() => void) | void, deps?: Array<unknown>): void {
	const dispatcher = resolveDispatcher();
	dispatcher.useLayoutEffect(create, deps);
	return;
}

/**
 * Returns a memoized callback that only changes when one of `deps` changes.
 */
export function useCallback<T>(callback: T, deps?: Array<unknown>): T {
	const dispatcher = resolveDispatcher();
	return dispatcher.useCallback(callback, deps);
}

/**
 * Returns a memoized value, recomputed only when one of `deps` changes.
 */
export function useMemo<T>(create: () => T, deps?: Array<unknown>): T {
	const dispatcher = resolveDispatcher();
	return dispatcher.useMemo(create, deps);
}

/**
 * Customizes the instance value exposed to parent components through `ref`.
 * Should be used together with `React.forwardRef`.
 */
export function useImperativeHandle<T>(
	ref: { current: T | undefined } | ((inst: T | undefined) => unknown) | undefined,
	create: () => T,
	deps?: Array<unknown>
): void {
	const dispatcher = resolveDispatcher();
	dispatcher.useImperativeHandle(ref, create, deps);
	return;
}

/**
 * Attaches a label to a custom hook for display in React DevTools.
 */
export function useDebugValue<T>(value: T, formatterFn?: (value: T) => unknown): void {
	if (__DEV__) {
		const dispatcher = resolveDispatcher();
		dispatcher.useDebugValue(value, formatterFn);
		return;
	}
}

/**
 * Returns an opaque identifier unique to the component. DevTools and other
 * tooling use this to track component identity.
 */
export function useOpaqueIdentifier(): unknown {
	const dispatcher = resolveDispatcher();
	return dispatcher.useOpaqueIdentifier();
}

/**
 * Subscribes to an external mutable source and re-renders when its snapshot
 * changes. This is the low-level primitive behind `useSyncExternalStore`.
 */
export function useMutableSource<Source, Snapshot>(
	source: MutableSource<Source>,
	getSnapshot: MutableSourceGetSnapshotFn<Source, Snapshot>,
	subscribe: MutableSourceSubscribeFn<Source, Snapshot>
): Snapshot {
	const dispatcher = resolveDispatcher();
	return dispatcher.useMutableSource(source, getSnapshot, subscribe);
}

/**
 * A shared frozen empty object used by the runtime where an allocation-free
 * placeholder is needed.
 *
 * @internal
 */
export const emptyObject: Record<string, never> = {};
