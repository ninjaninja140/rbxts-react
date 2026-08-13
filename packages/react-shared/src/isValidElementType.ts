/**
 * Determines whether a value is a valid React element type.
 *
 * @module isValidElementType
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import {
	REACT_BLOCK_TYPE,
	REACT_CONTEXT_TYPE,
	REACT_DEBUG_TRACING_MODE_TYPE,
	REACT_FORWARD_REF_TYPE,
	REACT_FRAGMENT_TYPE,
	REACT_FUNDAMENTAL_TYPE,
	REACT_LAZY_TYPE,
	REACT_LEGACY_HIDDEN_TYPE,
	REACT_MEMO_TYPE,
	REACT_PROFILER_TYPE,
	REACT_PROVIDER_TYPE,
	REACT_SERVER_BLOCK_TYPE,
	REACT_STRICT_MODE_TYPE,
	REACT_SUSPENSE_TYPE,
} from './ReactSymbols';

/**
 * Returns whether `type_` can be used as a React element type.
 *
 * @param type_ - The candidate element type.
 * @internal
 */
function isValidElementType(type_: unknown): boolean {
	const typeofType = type(type_);
	if (typeofType === 'string' || typeofType === 'function') {
		return true;
	}

	if (
		type_ === REACT_FRAGMENT_TYPE ||
		type_ === REACT_PROFILER_TYPE ||
		type_ === REACT_DEBUG_TRACING_MODE_TYPE ||
		type_ === REACT_STRICT_MODE_TYPE ||
		type_ === REACT_SUSPENSE_TYPE ||
		type_ === REACT_LEGACY_HIDDEN_TYPE
	) {
		return true;
	}

	if (typeofType === 'table') {
		const tbl = type_ as Record<string, unknown>;

		// Class components are tables whose metatable marks them as components.
		if ((tbl as { isReactComponent?: boolean }).isReactComponent === true) {
			return true;
		}

		const elementType = tbl.$$typeof as number | undefined;
		if (
			elementType === REACT_LAZY_TYPE ||
			elementType === REACT_MEMO_TYPE ||
			elementType === REACT_PROVIDER_TYPE ||
			elementType === REACT_CONTEXT_TYPE ||
			elementType === REACT_FORWARD_REF_TYPE ||
			elementType === REACT_FUNDAMENTAL_TYPE ||
			elementType === REACT_BLOCK_TYPE ||
			(tbl[1] as number | undefined) === REACT_SERVER_BLOCK_TYPE
		) {
			return true;
		}
	}

	return false;
}

export default isValidElementType;
