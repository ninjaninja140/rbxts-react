/**
 * Tracks the dispatcher currently in use by the renderer.
 *
 * @module ReactCurrentDispatcher
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import type { MutableSource, ReactBinding, ReactBindingUpdater, ReactContext } from '../types/ReactTypes';

type BasicStateAction<S> = ((value: S) => S) | S;
type Dispatch<A> = (value: A) => void;

/**
 * The hooks dispatcher contract. The reconciler installs its own
 * implementation into {@link ReactCurrentDispatcher.current} before rendering.
 */
export interface Dispatcher {
	readContext: <T>(context: ReactContext<T>, observedBits?: number | boolean) => T;
	useState: <S>(initialState: (() => S) | S) => [S, Dispatch<BasicStateAction<S>>];
	useReducer: <S, I, A>(reducer: (state: S, action: A) => S, initialArg: I, init?: (arg: I) => S) => [S, Dispatch<A>];
	useContext: <T>(context: ReactContext<T>, observedBits?: number | boolean) => T;
	useRef: <T>(initialValue: T) => { current: T };
	/** Roact-style bindings (Roblox-only feature). */
	useBinding: <T>(initialValue: T) => [ReactBinding<T>, ReactBindingUpdater<T>];
	useEffect: (create: () => (() => void) | void, deps?: Array<unknown>) => void;
	useLayoutEffect: (create: () => (() => void) | void, deps?: Array<unknown>) => void;
	useCallback: <T>(callback: T, deps?: Array<unknown>) => T;
	useMemo: <T>(nextCreate: () => T, deps?: Array<unknown>) => T;
	useImperativeHandle: <T>(
		ref: { current: T | undefined } | ((inst: T | undefined) => unknown) | undefined,
		create: () => T,
		deps?: Array<unknown>
	) => void;
	useDebugValue: <T>(value: T, formatterFn?: (value: T) => unknown) => void;
	useDeferredValue?: <T>(value: T) => T;
	useTransition?: () => [(callback: () => void) => void, boolean];
	useMutableSource: <Source, Snapshot>(
		source: MutableSource<Source>,
		getSnapshot: (source: Source) => Snapshot,
		subscribe: (source: Source, callback: (snapshot: Snapshot) => void) => () => void
	) => Snapshot;
	useOpaqueIdentifier: () => unknown;
	unstable_isNewReconciler?: boolean;
}

/**
 * The mutable dispatcher slot.
 *
 * @internal
 */
const ReactCurrentDispatcher: { current: Dispatcher | undefined } = {
	current: undefined,
};

export default ReactCurrentDispatcher;
