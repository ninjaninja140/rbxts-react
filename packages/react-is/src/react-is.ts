/**
 * `react-is` — Type-checking utilities for React elements and special objects.
 *
 * Provides `typeOf()` to retrieve the internal `$$typeof` of a React element
 * and a suite of predicate functions (`isElement`, `isFragment`, etc.) that
 * check whether a given object is a specific React type.
 *
 * This is the React 19 `react-is` ported from `react-lua` and updated with
 * modern React types.
 *
 * @module react-is
 */

import {
	REACT_BINDING_TYPE,
	REACT_CONTEXT_TYPE,
	REACT_ELEMENT_TYPE,
	REACT_FORWARD_REF_TYPE,
	REACT_FRAGMENT_TYPE,
	REACT_LAZY_TYPE,
	REACT_MEMO_TYPE,
	REACT_PORTAL_TYPE,
	REACT_PROFILER_TYPE,
	REACT_PROVIDER_TYPE,
	REACT_STRICT_MODE_TYPE,
	REACT_SUSPENSE_TYPE,
	REACT_SUSPENSE_LIST_TYPE,
} from './ReactSymbols';

// ReactSymbol lookup table

/**
 * Map from `$$typeof` numeric value to human-readable label.
 * Useful for debugging and introspection.
 */
const REACT_SYMBOL_MAP: Record<number, string> = {
	[REACT_BINDING_TYPE]: 'react.binding',
	[REACT_CONTEXT_TYPE]: 'react.context',
	[REACT_ELEMENT_TYPE]: 'react.element',
	[REACT_FORWARD_REF_TYPE]: 'react.forward_ref',
	[REACT_FRAGMENT_TYPE]: 'react.fragment',
	[REACT_LAZY_TYPE]: 'react.lazy',
	[REACT_MEMO_TYPE]: 'react.memo',
	[REACT_PORTAL_TYPE]: 'react.portal',
	[REACT_PROFILER_TYPE]: 'react.profiler',
	[REACT_PROVIDER_TYPE]: 'react.provider',
	[REACT_STRICT_MODE_TYPE]: 'react.strict_mode',
	[REACT_SUSPENSE_TYPE]: 'react.suspense',
	[REACT_SUSPENSE_LIST_TYPE]: 'react.suspense_list',
};

// TypeOf

/**
 * Returns the React type string for `thing`, or `undefined` if `thing` is not
 * a recognized React object.
 *
 * ```ts
 * typeOf(<div />)              // → "react.element"
 * typeOf({})                   // → undefined
 * ```
 *
 * @param thing - The value to introspect.
 * @returns A React type label (e.g. `"react.element"`) or `undefined`.
 */
export function typeOf(thing: unknown): string | undefined {
	if (typeIs(thing, 'table')) {
		const obj = thing as Record<string, unknown>;
		const typeofValue = obj.$$typeof as number | undefined;
		if (typeofValue !== undefined) {
			return REACT_SYMBOL_MAP[typeofValue];
		}
	}
	return undefined;
}

// Type guard helpers

function hasTypeOf(thing: unknown, typeValue: number): boolean {
	if (typeIs(thing, 'table')) {
		return (thing as Record<string, unknown>).$$typeof === typeValue;
	}
	return false;
}

// Public type guards

/**
 * Returns `true` if `thing` is a React element (created via `createElement()` or JSX).
 */
export function isElement(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_ELEMENT_TYPE);
}

/**
 * Returns `true` if `thing` is a React context (provider or consumer).
 */
export function isContext(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_CONTEXT_TYPE) || hasTypeOf(thing, REACT_PROVIDER_TYPE);
}

/**
 * Returns `true` if `thing` is a React context consumer.
 */
export function isContextConsumer(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_CONTEXT_TYPE);
}

/**
 * Returns `true` if `thing` is a React context provider.
 */
export function isContextProvider(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_PROVIDER_TYPE);
}

/**
 * Returns `true` if `thing` is a `React.forwardRef()` wrapper.
 */
export function isForwardRef(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_FORWARD_REF_TYPE);
}

/**
 * Returns `true` if `thing` is a React fragment (`<>...</>` or `<Fragment />`).
 */
export function isFragment(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_FRAGMENT_TYPE);
}

/**
 * Returns `true` if `thing` is a `React.lazy()` wrapper.
 */
export function isLazy(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_LAZY_TYPE);
}

/**
 * Returns `true` if `thing` is a `React.memo()` wrapper.
 */
export function isMemo(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_MEMO_TYPE);
}

/**
 * Returns `true` if `thing` is a React portal.
 */
export function isPortal(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_PORTAL_TYPE);
}

/**
 * Returns `true` if `thing` is a `<React.Profiler />`.
 */
export function isProfiler(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_PROFILER_TYPE);
}

/**
 * Returns `true` if `thing` is a `<React.StrictMode />`.
 */
export function isStrictMode(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_STRICT_MODE_TYPE);
}

/**
 * Returns `true` if `thing` is a `<React.Suspense />`.
 */
export function isSuspense(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_SUSPENSE_TYPE);
}

/**
 * Returns `true` if `thing` is a `<React.SuspenseList />`.
 */
export function isSuspenseList(thing: unknown): boolean {
	return hasTypeOf(thing, REACT_SUSPENSE_LIST_TYPE);
}

// Combined validators

/**
 * Returns `true` if `thing` is **any** recognized React type (element, context,
 * lazy, memo, portal, profiler, strict mode, suspense, etc.).
 *
 * ```ts
 * isElement(<div />)     // → true
 * isElement({})          // → false
 * ```
 */
export function isValidElementType(thing: unknown): boolean {
	if (!typeIs(thing, 'table')) return false;

	const obj = thing as Record<string, unknown>;
	const typeofValue = obj.$$typeof as number | undefined;

	if (typeofValue === undefined) return false;

	return (
		typeofValue === REACT_ELEMENT_TYPE ||
		typeofValue === REACT_CONTEXT_TYPE ||
		typeofValue === REACT_PROVIDER_TYPE ||
		typeofValue === REACT_FORWARD_REF_TYPE ||
		typeofValue === REACT_FRAGMENT_TYPE ||
		typeofValue === REACT_LAZY_TYPE ||
		typeofValue === REACT_MEMO_TYPE ||
		typeofValue === REACT_PORTAL_TYPE ||
		typeofValue === REACT_PROFILER_TYPE ||
		typeofValue === REACT_STRICT_MODE_TYPE ||
		typeofValue === REACT_SUSPENSE_TYPE ||
		typeofValue === REACT_SUSPENSE_LIST_TYPE
	);
}
