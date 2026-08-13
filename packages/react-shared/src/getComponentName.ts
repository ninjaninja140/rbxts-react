/**
 * Extracts a human-readable name from a component type.
 *
 * Mirrors upstream `getComponentName.js`, handling host string types, function
 * components, context consumers/providers, forwardRef, memo, lazy, and the
 * fragment/profiler/strict/suspense marker values.
 *
 * @module getComponentName
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { consoleTable as console } from './console';
import {
	REACT_BLOCK_TYPE,
	REACT_CONTEXT_TYPE,
	REACT_FORWARD_REF_TYPE,
	REACT_FRAGMENT_TYPE,
	REACT_LAZY_TYPE,
	REACT_MEMO_TYPE,
	REACT_PORTAL_TYPE,
	REACT_PROFILER_TYPE,
	REACT_PROVIDER_TYPE,
	REACT_STRICT_MODE_TYPE,
	REACT_SUSPENSE_LIST_TYPE,
	REACT_SUSPENSE_TYPE,
} from './ReactSymbols';
import { describeError } from './ErrorHandling';

type KeyedTable = Record<string, unknown>;

function getWrappedName(outerType: KeyedTable, innerType: unknown, wrapperName: string): string {
	const outerDisplayName = outerType.displayName;
	if (type(outerDisplayName) === 'string') {
		return outerDisplayName as string;
	}

	const functionName = getFunctionName(innerType);
	if (functionName !== '') {
		return string.format('%s(%s)', wrapperName, functionName);
	}
	return wrapperName;
}

function getFunctionName(innerType: unknown): string {
	if (type(innerType) === 'table') {
		const tbl = innerType as KeyedTable;
		const displayName = tbl.displayName;
		if (type(displayName) === 'string') {
			return displayName as string;
		}
		const name = tbl.name;
		if (type(name) === 'string') {
			return name as string;
		}
	}
	return '';
}

function getContextName(context: KeyedTable): string {
	const displayName = context.displayName;
	if (type(displayName) === 'string') {
		return displayName as string;
	}
	return 'Context';
}

/**
 * Returns the display name of a component type, or `undefined` for host roots,
 * text nodes, and invalid types.
 *
 * @param type_ - The component type to inspect.
 * @internal
 */
function getComponentName(type_: unknown): string | undefined {
	if (type_ === undefined) {
		return undefined;
	}

	const typeofType = type(type_);

	if (__DEV__) {
		if (typeofType === 'table' && type((type_ as KeyedTable).tag) === 'number') {
			console.warn(
				'Received an unexpected object in getComponentName(). ' +
					'This is likely a bug in React. Please file an issue.'
			);
		}
	}

	if (typeofType === 'function') {
		const [name] = debug.info(type_ as Callback, 'n');
		if (name !== undefined && name.size() > 0) {
			return name;
		}
		const [source, line] = debug.info(type_ as Callback, 'sl');
		return string.format('%s:%d', source, line);
	}

	if (typeofType === 'string') {
		return type_ as string;
	}

	if (type_ === REACT_FRAGMENT_TYPE) {
		return 'Fragment';
	} else if (type_ === REACT_PORTAL_TYPE) {
		return 'Portal';
	} else if (type_ === REACT_PROFILER_TYPE) {
		return 'Profiler';
	} else if (type_ === REACT_STRICT_MODE_TYPE) {
		return 'StrictMode';
	} else if (type_ === REACT_SUSPENSE_TYPE) {
		return 'Suspense';
	} else if (type_ === REACT_SUSPENSE_LIST_TYPE) {
		return 'SuspenseList';
	}

	if (typeofType === 'table') {
		const tbl = type_ as KeyedTable;
		const typeProp = tbl.$$typeof as number | undefined;

		if (typeProp === REACT_CONTEXT_TYPE) {
			return `${getContextName(tbl)}.Consumer`;
		} else if (typeProp === REACT_PROVIDER_TYPE) {
			const provider = tbl as { _context: KeyedTable };
			return `${getContextName(provider._context)}.Provider`;
		} else if (typeProp === REACT_FORWARD_REF_TYPE) {
			const forwardRef = tbl as { render: unknown } & KeyedTable;
			return getWrappedName(forwardRef, forwardRef.render, 'ForwardRef');
		} else if (typeProp === REACT_MEMO_TYPE) {
			const memo = tbl as { type: unknown };
			return getComponentName(memo.type);
		} else if (typeProp === REACT_BLOCK_TYPE) {
			const block = tbl as { _render: unknown };
			return getComponentName(block._render);
		} else if (typeProp === REACT_LAZY_TYPE) {
			const lazy = tbl as { _payload: unknown; _init: (payload: unknown) => unknown };
			const [ok, result] = xpcall(lazy._init, describeError, lazy._payload);
			if (ok) {
				return getComponentName(result);
			}
			return undefined;
		} else {
			// Class components are tables in Luau; prefer `displayName`/`name`
			// and fall back to a custom `__tostring` if present.
			const displayName = tbl.displayName;
			if (type(displayName) === 'string') {
				return displayName as string;
			}
			const name = tbl.name;
			if (type(name) === 'string') {
				return name as string;
			}
			const mt = getmetatable(tbl);
			if (mt !== undefined && rawget(mt, '__tostring') !== undefined) {
				return tostring(tbl);
			}
		}
	}

	return undefined;
}

export default getComponentName;
