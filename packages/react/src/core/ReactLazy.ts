/**
 * `lazy` — defers loading a component until it is first rendered.
 *
 * ```ts
 * const MyComponent = React.lazy(() => import("./MyComponent"));
 * ```
 *
 * @module ReactLazy
 * @packageDocumentation
 */

import { __DEV__ } from '@nrbx/react-globals';
import { console, ReactSymbols, type Thenable } from '@nrbx/react-shared';
import inspect from './inspect';

const REACT_LAZY_TYPE = ReactSymbols.REACT_LAZY_TYPE;

const Uninitialized = -1;
const Pending = 0;
const Resolved = 1;
const Rejected = 2;

/** A lazy module: a thenable resolving to a table with a `default` export. */
type LazyModule<T> = { default: T } & Record<string, unknown>;

interface UninitializedPayload<T> {
	_status: number;
	_result: () => Thenable<LazyModule<T>>;
}

interface PendingPayload<T> {
	_status: number;
	_result: Thenable<LazyModule<T>>;
}

/** `Thenable` declares `andThen` with a `self` parameter; this self-less alias
 * is what the runtime actually calls (colon call passes `self` implicitly). */
type SelfLessThenable<T> = {
	andThen: (onFulfilled: (moduleObject: LazyModule<T>) => void, onRejected: (error_: unknown) => void) => void;
};

interface ResolvedPayload<T> {
	_status: number;
	_result: T;
}

interface RejectedPayload {
	_status: number;
	_result: unknown;
}

type Payload<T> = UninitializedPayload<T> | PendingPayload<T> | ResolvedPayload<T> | RejectedPayload;

/**
 * A lazy component reference resolved by the reconciler on first render.
 */
export interface LazyComponent<T> {
	$$typeof: number;
	_payload: Payload<T>;
	_init: (payload: Payload<T>) => T;
}

function lazyInitializer<T>(payload: Payload<T>): T {
	if (payload._status === Uninitialized) {
		const ctor = (payload as UninitializedPayload<T>)._result;
		const thenable = ctor();

		// Transition to the pending state.
		const pending = payload as unknown as PendingPayload<T>;
		pending._status = Pending;
		pending._result = thenable;

		(thenable as unknown as SelfLessThenable<T>).andThen(
			(moduleObject: LazyModule<T>) => {
				if (payload._status === Pending) {
					const defaultExport = moduleObject.default;
					if (__DEV__ && defaultExport === undefined) {
						console.error(
							'lazy: Expected the result of a dynamic import() call. ' +
								'Instead received: `%s`\n\nYour code should look like: \n  ' +
								'const MyComponent = lazy(() => import("../MyComponent"))',
							inspect(moduleObject)
						);
					}
					// Transition to the resolved state.
					const resolved = payload as unknown as ResolvedPayload<T>;
					resolved._status = Resolved;
					resolved._result = defaultExport;
				}
			},
			(error_: unknown) => {
				if (payload._status === Pending) {
					// Transition to the rejected state.
					const rejected = payload as unknown as RejectedPayload;
					rejected._status = Rejected;
					rejected._result = error_;
				}
			}
		);
	}

	if (payload._status === Resolved) {
		return (payload as ResolvedPayload<T>)._result;
	}
	throw (payload as RejectedPayload)._result;
}

/**
 * Creates a lazy component.
 *
 * @param ctor - A function returning a thenable that resolves to a module with
 * a `default` export.
 */
function lazy<T>(ctor: () => Thenable<LazyModule<T>>): LazyComponent<T> {
	const payload: Payload<T> = {
		_status: Uninitialized,
		_result: ctor,
	} as UninitializedPayload<T>;

	const lazyType: LazyComponent<T> = {
		$$typeof: REACT_LAZY_TYPE,
		_payload: payload,
		_init: lazyInitializer as (p: Payload<T>) => T,
	};

	if (__DEV__) {
		// In production these would be plain fields; in DEV we trap assignments
		// to `defaultProps`/`propTypes` and warn, since Luau functions/tables can't
		// carry them meaningfully on a lazy wrapper.
		let defaultProps: unknown;
		let propTypes: unknown;
		const blockWrites = {
			__index: () => undefined,
			__newindex: () => undefined,
		} as LuaMetatable<LazyComponent<T>>;

		setmetatable(lazyType, {
			__index: (_self: object, key: string) => {
				if (key === 'defaultProps') {
					return defaultProps;
				}
				if (key === 'propTypes') {
					return propTypes;
				}
				return undefined;
			},
			__newindex: (_self: object, key: string, value: defined) => {
				if (key === 'defaultProps') {
					console.error(
						'React.lazy(...): It is not supported to assign `defaultProps` to ' +
							'a lazy component import. Either specify them where the component ' +
							'is defined, or create a wrapping component around it.'
					);
					defaultProps = value;
					setmetatable(lazyType, blockWrites);
				} else if (key === 'propTypes') {
					console.error(
						'React.lazy(...): It is not supported to assign `propTypes` to ' +
							'a lazy component import. Either specify them where the component ' +
							'is defined, or create a wrapping component around it.'
					);
					propTypes = value;
					setmetatable(lazyType, blockWrites);
				} else {
					rawset(lazyType, key, value);
				}
			},
		} as LuaMetatable<LazyComponent<T>>);
	}

	return lazyType;
}

export default { lazy };
