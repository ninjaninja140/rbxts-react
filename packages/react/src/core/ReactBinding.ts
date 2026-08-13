/**
 * Roact-style mutable bindings (a Roblox-only React extension).
 *
 * A binding is a boxed value that the renderer subscribes to; when the value
 * changes every mounted instance using it re-renders with the new value.
 *
 * ```ts
 * const [count, setCount] = React.createBinding(0);
 * setCount(1);
 * print(count.getValue()); // 1
 * ```
 *
 * @module ReactBinding
 * @packageDocumentation
 */

import type { ReactBinding, ReactBindingUpdater } from '@nrbx/react-shared';
import { ReactSymbols } from '@nrbx/react-shared';
import { Symbol } from '@nrbx/react-shared';
import { __DEV__ } from '@nrbx/react-globals';
import createSignal from './createSignal';

const REACT_BINDING_TYPE = ReactSymbols.REACT_BINDING_TYPE;

// A private, unforgeable key used to reach the binding's implementation table
// from the public binding object.
const BindingImpl = Symbol.named('BindingImpl') as unknown as string;

interface BindingInternalImpl<T> {
	value: T;
	subscribe: (callback: (value: T) => void) => () => void;
	update: (newValue: T) => void;
	getValue: () => T;
}

/** The public shape of a binding, plus the fields attached on creation. */
type BindingInternal<T> = ReactBinding<T> & {
	$$typeof: number;
	_source?: string;
};

/**
 * Reaches through a public binding object to its private implementation table.
 *
 * The public binding only exposes `getValue`/`map` through a shared metatable;
 * the actual state lives under the `BindingImpl` key, which is a string cast
 * from a named Symbol so it is unforgeable at runtime but indexable by
 * roblox-ts.
 *
 * @internal
 */
function getImpl<T>(binding: unknown): BindingInternalImpl<T> {
	return (binding as unknown as Record<string, defined>)[BindingImpl] as BindingInternalImpl<T>;
}

/**
 * Private implementation shared by the public metatable and the static API.
 *
 * @internal
 */
// The members of this table are property-style arrow functions, not method
// syntax. Method syntax would emit an implicit `self` parameter in Lua, but
// these helpers are always called with dot syntax (`BindingInternalApi.getValue`
// passes the binding as the first explicit argument). Arrow functions emit the
// exact argument list the original Lua used.
const BindingInternalApi = {
	update: <T>(binding: unknown, newValue: T) => {
		getImpl<T>(binding).update(newValue);
	},

	subscribe: <T>(binding: unknown, callback: (value: T) => void): (() => void) => {
		return getImpl<T>(binding).subscribe(callback);
	},

	getValue: <T>(binding: unknown): T => {
		return getImpl<T>(binding).getValue();
	},

	create: <T>(initialValue: T): [ReactBinding<T>, ReactBindingUpdater<T>] => {
		const [subscribe, fire] = createSignal();
		const impl: BindingInternalImpl<T> = {
			value: initialValue,
			subscribe: subscribe as unknown as (callback: (value: T) => void) => () => void,
			update: (newValue: T) => {
				impl.value = newValue;
				fire(newValue);
			},
			getValue: () => impl.value,
		};

		let source: string | undefined;
		if (__DEV__) {
			source = debug.traceback('Binding created at:', 3);
		}

		const binding = setmetatable(
			{
				$$typeof: REACT_BINDING_TYPE,
				[BindingImpl]: impl,
				_source: source,
			} as unknown as BindingInternal<T>,
			BindingPublicMeta as unknown as LuaMetatable<BindingInternal<T>>
		);

		return [binding as ReactBinding<T>, impl.update];
	},

	map: <T, U>(upstreamBinding: ReactBinding<T>, predicate: (value: T) => U): ReactBinding<U> => {
		if (__DEV__) {
			assert(
				typeOf(upstreamBinding) === 'table' &&
					(upstreamBinding as unknown as Record<string, defined>).$$typeof === REACT_BINDING_TYPE,
				'Expected `self` to be a binding'
			);
			assert(typeOf(predicate) === 'function', 'Expected arg #1 to be a function');
		}

		const impl: BindingInternalImpl<U> = {
			value: predicate(BindingInternalApi.getValue(upstreamBinding)),
			subscribe: (callback: (value: U) => void) =>
				BindingInternalApi.subscribe(upstreamBinding, (newValue: T) => {
					callback(predicate(newValue));
				}),
			update: () => {
				error('Bindings created by Binding:map(fn) cannot be updated directly', 2);
			},
			getValue: () => predicate(BindingInternalApi.getValue(upstreamBinding)),
		};

		let source: string | undefined;
		if (__DEV__) {
			source = debug.traceback('Mapped binding created at:', 3);
		}

		return setmetatable(
			{
				$$typeof: REACT_BINDING_TYPE,
				[BindingImpl]: impl,
				_source: source,
			} as unknown as BindingInternal<U>,
			BindingPublicMeta as unknown as LuaMetatable<BindingInternal<U>>
		) as ReactBinding<U>;
	},

	join: <T>(upstreamBindings: Record<string, ReactBinding<unknown>>): ReactBinding<T> => {
		if (__DEV__) {
			assert(typeOf(upstreamBindings) === 'table', 'Expected arg #1 to be of type table');
			for (const [key, value] of pairs(upstreamBindings)) {
				if (
					typeOf(value) !== 'table' ||
					(value as unknown as Record<string, defined>).$$typeof !== REACT_BINDING_TYPE
				) {
					error(
						string.format(
							'Expected arg #1 to contain only bindings, but key %q had a non-binding value',
							tostring(key)
						),
						2
					);
				}
			}
		}

		const getValue = () => {
			const value: Record<string, unknown> = {};
			for (const [key, upstream] of pairs(upstreamBindings)) {
				value[key as string] = BindingInternalApi.getValue(upstream);
			}
			return value as T;
		};

		const impl: BindingInternalImpl<T> = {
			value: getValue(),
			subscribe: (callback: (value: T) => void) => {
				const disconnects: Record<string, () => void> = {};
				for (const [key, upstream] of pairs(upstreamBindings)) {
					disconnects[key as string] = BindingInternalApi.subscribe(upstream, () => {
						callback(getValue());
					});
				}
				return () => {
					for (const [, disconnect] of pairs(disconnects)) {
						disconnect();
					}
					table.clear(disconnects);
				};
			},
			update: () => {
				error('Bindings created by joinBindings(...) cannot be updated directly', 2);
			},
			getValue,
		};

		let source: string | undefined;
		if (__DEV__) {
			source = debug.traceback('Joined binding created at:', 2);
		}

		return setmetatable(
			{
				$$typeof: REACT_BINDING_TYPE,
				[BindingImpl]: impl,
				_source: source,
			} as unknown as BindingInternal<T>,
			BindingPublicMeta as unknown as LuaMetatable<BindingInternal<T>>
		) as ReactBinding<T>;
	},
};

// The shared metatable. Methods are written as property-style arrow functions
// (not method syntax) so the emitted Lua functions take the receiver as their
// first explicit argument. The renderer calls them with colon syntax
// (`binding:getValue()`), which passes the binding as that first argument.
const BindingPublicMeta = {
	__index: {
		getValue: <T>(binding: ReactBinding<T>) => BindingInternalApi.getValue(binding),
		map: <T, U>(binding: ReactBinding<T>, predicate: (value: T) => U) => BindingInternalApi.map(binding, predicate),
	},
	__tostring: (self_: ReactBinding<unknown>) =>
		string.format('RoactBinding(%s)', tostring(BindingInternalApi.getValue(self_))),
} as unknown as LuaMetatable<ReactBinding<unknown>>;

export default BindingInternalApi;
