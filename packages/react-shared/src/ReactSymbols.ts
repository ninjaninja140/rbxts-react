/**
 * React's internal element-type tags.
 *
 * In JavaScript these are `Symbol.for(...)` values; in the Roblox runtime we
 * use plain numeric constants instead, which keeps element comparisons fast
 * and avoids shipping a Symbol polyfill.
 *
 * @module ReactSymbols
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

/** Tags a plain React element (`React.createElement` output). */
export const REACT_ELEMENT_TYPE = 0xeac7;

/** Tags a portal element (`ReactRoblox.createPortal` output). */
export const REACT_PORTAL_TYPE = 0xeaca;

/** Tags a fragment (`<></>` / `React.createFragment`). */
export const REACT_FRAGMENT_TYPE = 0xeacb;

/** Tags `<StrictMode>`. */
export const REACT_STRICT_MODE_TYPE = 0xeacc;

/** Tags `<Profiler>`. */
export const REACT_PROFILER_TYPE = 0xead2;

/** Tags a context provider (`<Context.Provider>`). */
export const REACT_PROVIDER_TYPE = 0xeacd;

/** Tags a context object (`React.createContext` output). */
export const REACT_CONTEXT_TYPE = 0xeace;

/** Tags a `React.forwardRef` component. */
export const REACT_FORWARD_REF_TYPE = 0xead0;

/** Tags `<Suspense>`. */
export const REACT_SUSPENSE_TYPE = 0xead1;

/** Tags `<SuspenseList>`. */
export const REACT_SUSPENSE_LIST_TYPE = 0xead8;

/** Tags a `React.memo` component. */
export const REACT_MEMO_TYPE = 0xead3;

/** Tags a `React.lazy` component. */
export const REACT_LAZY_TYPE = 0xead4;

/** Tags an experimental Block component. */
export const REACT_BLOCK_TYPE = 0xead9;

/** Tags an experimental Server Block component. */
export const REACT_SERVER_BLOCK_TYPE = 0xeada;

/** Tags an experimental Fundamental component. */
export const REACT_FUNDAMENTAL_TYPE = 0xead5;

/** Tags an experimental Scope. */
export const REACT_SCOPE_TYPE = 0xead7;

/** Tags an opaque identifier (`React.unstable_useOpaqueIdentifier` output). */
export const REACT_OPAQUE_ID_TYPE = 0xeae0;

/** Tags DebugTracing mode. */
export const REACT_DEBUG_TRACING_MODE_TYPE = 0xeae1;

/** Tags an Offscreen activity boundary. */
export const REACT_OFFSCREEN_TYPE = 0xeae2;

/** Tags a legacy hidden component. */
export const REACT_LEGACY_HIDDEN_TYPE = 0xeae3;

/** Tags a Roact-style binding (Roblox-only feature). */
export const REACT_BINDING_TYPE = 0xeae4;

/**
 * The result of iterating a table with `getIteratorFn`.
 *
 * @internal
 */
export interface IteratorResult<T> {
	value: T;
	key: unknown;
	done: boolean;
}

/**
 * An iterator function produced by {@link getIteratorFn}.
 *
 * @internal
 */
export type IteratorFn = (...args: Array<unknown>) => {
	next: () => IteratorResult<unknown>;
};

/**
 * Returns an iterator function for a table, or `undefined` if the value is
 * not iterable. Portal elements are explicitly excluded — they look like
 * tables but are not meant to be iterated.
 *
 * @internal
 */
export function getIteratorFn(maybeIterable: defined): IteratorFn | undefined {
	if (typeOf(maybeIterable) === 'table') {
		const tableValue = maybeIterable as Record<string, defined>;
		// Portals are not iterable even though they are tables.
		if (tableValue.$$typeof === REACT_PORTAL_TYPE) {
			return undefined;
		}
		return () => {
			let currentKey: unknown;
			let currentValue: unknown;
			return {
				next: () => {
					[currentKey, currentValue] = next(tableValue, currentKey);
					return {
						done: currentValue === undefined,
						// Supports Roact's table-keys-as-stable-keys feature by
						// returning the key alongside the value.
						key: currentKey,
						value: currentValue,
					};
				},
			};
		};
	}

	return undefined;
}
