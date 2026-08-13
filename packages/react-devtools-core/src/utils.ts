/**
 * Shared utility functions for the DevTools backend.
 *
 * Ported from `react-devtools-shared/src/utils.js` (React 17).
 *
 * @module utils
 * @packageDocumentation
 */

import {
	CONTEXT_NUMBER,
	ELEMENT_NUMBER,
	FORWARD_REF_NUMBER,
	FRAGMENT_NUMBER,
	LAZY_NUMBER,
	MEMO_NUMBER,
	PORTAL_NUMBER,
	PROFILER_NUMBER,
	PROVIDER_NUMBER,
	STRICT_MODE_NUMBER,
	SUSPENSE_LIST_NUMBER,
	SUSPENSE_NUMBER,
} from './backend/ReactSymbols';
import {
	LOCAL_STORAGE_FILTER_PREFERENCES_KEY,
	LOCAL_STORAGE_SHOULD_BREAK_ON_CONSOLE_ERRORS,
	LOCAL_STORAGE_SHOULD_PATCH_CONSOLE_KEY,
	TREE_OPERATION_ADD,
	TREE_OPERATION_REMOVE,
	TREE_OPERATION_REORDER_CHILDREN,
	TREE_OPERATION_UPDATE_TREE_BASE_DURATION,
} from './constants';
import { localStorageGetItem, localStorageSetItem } from './storage';
import type { ComponentFilter } from './types';
import {
	ComponentFilterElementType,
	ElementTypeClass,
	ElementTypeForwardRef,
	ElementTypeFunction,
	ElementTypeHostComponent,
	ElementTypeMemo,
	ElementTypeRoot,
	type ElementType,
} from './types';

const JSON = game.GetService('HttpService');

/** Maximum length of an inline preview before it is truncated. */
const MAX_PREVIEW_STRING_LENGTH = 50;

/** Cache for display names keyed by component type. */
const cachedDisplayNames = new Map<unknown, string>();

// Small language-level helpers (Roblox has no Object.keys / Array.isArray).

/**
 * Returns `true` when `value` is a Lua array (a table whose keys are all
 * contiguous integers starting at 1).
 */
export function isArray(value: unknown): value is Array<defined> {
	if (type(value) !== 'table') {
		return false;
	}
	const [firstKey] = next(value as object);
	return firstKey === undefined || type(firstKey) === 'number';
}

/**
 * Returns a shallow copy of `arr` between `fromIndex` (inclusive) and
 * `toIndex` (exclusive), following standard JavaScript `Array.slice`
 * semantics (0-based).
 */
export function slice<T extends defined>(arr: ReadonlyArray<T>, fromIndex: number, toIndex: number): Array<T> {
	const result: T[] = [];
	for (let i = fromIndex; i < toIndex; i++) {
		const value = arr[i];
		if (value !== undefined) {
			result.push(value);
		}
	}
	return result;
}

/**
 * Removes `deleteCount` elements from `arr` starting at `index` (0-based).
 */
export function splice<T extends defined>(arr: Array<T>, index: number, deleteCount: number): void {
	for (let i = 0; i < deleteCount; i++) {
		arr.remove(index);
	}
}

// Component names

/**
 * Extracts a human-readable name from a component type.
 *
 * Mirrors React's `getComponentName` implementation, handling host string
 * types, function components, context consumers/providers, forwardRef, memo,
 * lazy, and fragment/profiler/strict/suspense markers.
 */
export function getComponentName(type_: unknown): string | undefined {
	if (type_ === undefined) {
		return undefined;
	}

	const typeofType = type(type_);

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

	if (type_ === FRAGMENT_NUMBER) {
		return 'Fragment';
	} else if (type_ === PORTAL_NUMBER) {
		return 'Portal';
	} else if (type_ === PROFILER_NUMBER) {
		return 'Profiler';
	} else if (type_ === STRICT_MODE_NUMBER) {
		return 'StrictMode';
	} else if (type_ === SUSPENSE_NUMBER) {
		return 'Suspense';
	} else if (type_ === SUSPENSE_LIST_NUMBER) {
		return 'SuspenseList';
	}

	if (typeofType === 'table') {
		const tbl = type_ as Record<string, unknown>;
		const typeProp = tbl.$$typeof as number | undefined;

		if (typeProp === CONTEXT_NUMBER) {
			return `${getContextName(tbl)}.Consumer`;
		} else if (typeProp === PROVIDER_NUMBER) {
			const provider = tbl as { _context: Record<string, unknown> };
			return `${getContextName(provider._context)}.Provider`;
		} else if (typeProp === FORWARD_REF_NUMBER) {
			const forwardRef = tbl as { render: unknown; displayName?: string; name?: string };
			return getWrappedName(forwardRef, forwardRef.render, 'ForwardRef');
		} else if (typeProp === MEMO_NUMBER) {
			const memo = tbl as { type: unknown };
			return getComponentName(memo.type);
		} else if (typeProp === LAZY_NUMBER) {
			const lazy = tbl as { _payload: unknown; _init: (payload: unknown) => unknown };
			const [ok, result] = pcall(lazy._init, lazy._payload);
			if (ok) {
				return getComponentName(result);
			}
			return undefined;
		} else {
			const displayName = tbl.displayName;
			if (typeofTypeOf(displayName) === 'string') {
				return displayName as string;
			}
			const name = tbl.name;
			if (typeofTypeOf(name) === 'string') {
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

function typeofTypeOf(value: unknown): string {
	return type(value);
}

function getContextName(context: Record<string, unknown>): string {
	const displayName = context.displayName;
	if (typeofTypeOf(displayName) === 'string') {
		return displayName as string;
	}
	return 'Context';
}

function getWrappedName(outerType: Record<string, unknown>, innerType: unknown, wrapperName: string): string {
	const displayName = outerType.displayName;
	if (typeofTypeOf(displayName) === 'string') {
		return displayName as string;
	}

	const functionName = getFunctionName(innerType);
	if (functionName !== '') {
		return string.format('%s(%s)', wrapperName, functionName);
	}
	return wrapperName;
}

function getFunctionName(innerType: unknown): string {
	if (type(innerType) === 'table') {
		const tbl = innerType as Record<string, unknown>;
		const displayName = tbl.displayName;
		if (typeofTypeOf(displayName) === 'string') {
			return displayName as string;
		}
		const name = tbl.name;
		if (typeofTypeOf(name) === 'string') {
			return name as string;
		}
	}
	return '';
}

// Sorting / keys

/**
 * Sort comparator that orders keys descending by their string representation.
 * Used by {@link formatDataForPreview} to keep previews stable.
 */
export function alphaSortKeys(a: string | number, b: string | number): boolean {
	return tostring(a) > tostring(b);
}

/**
 * Returns all enumerable keys of a table.
 *
 * Replaces `Object.keys`, which is unavailable in Luau. For plain tables this
 * collects both array and dictionary keys.
 */
export function getAllEnumerableKeys(obj: object): Array<string | number> {
	const keys: (string | number)[] = [];
	for (const [key] of pairs(obj as Record<string, unknown>)) {
		keys.push(key as string | number);
	}
	return keys;
}

// Display names

/**
 * Resolves a component type to a display name.
 *
 * Checks the Roblox-specific `__componentName` field first, then `name`,
 * then falls back to extracting the function name for function components.
 */
export function getDisplayName(type_: unknown, fallbackName?: string): string {
	const fallback = fallbackName ?? 'Anonymous';
	const fromCache = cachedDisplayNames.get(type_);
	if (fromCache !== undefined) {
		return fromCache;
	}

	let displayName = fallback;

	if (type(type_) === 'table') {
		const tbl = type_ as Record<string, unknown>;
		if (type(tbl.__componentName) === 'string') {
			displayName = tbl.__componentName as string;
		} else if (type(tbl.name) === 'string' && tbl.name !== '') {
			displayName = tbl.name as string;
		}
	} else if (type(type_) === 'function') {
		displayName = getComponentName(type_) ?? displayName;
	}

	cachedDisplayNames.set(type_, displayName);
	return displayName;
}

/**
 * Returns `wrapperName(displayName)`, mirroring React's wrapped name helper.
 */
export function getWrappedDisplayName(
	outerType: unknown,
	innerType: unknown,
	wrapperName: string,
	fallbackName?: string
): string {
	const displayName = type(outerType) === 'table' ? (outerType as Record<string, unknown>).displayName : undefined;
	if (typeofTypeOf(displayName) === 'string') {
		return displayName as string;
	}
	return `${wrapperName}(${getDisplayName(innerType, fallbackName)})`;
}

// UIDs

let uidCounter = 0;

/** Returns a monotonically increasing id. */
export function getUID(): number {
	uidCounter += 1;
	return uidCounter;
}

// UTF conversion

/**
 * Rebuilds a UTF-8 string from a sequence of codepoints produced by
 * {@link utfEncodeString}.
 */
export function utfDecodeString(codePoints: Array<number>): string {
	const seq: number[] = [];
	let i = 0;
	while (i < codePoints.size()) {
		const cp = codePoints[i];
		if (cp >= 0x10000) {
			// Paired surrogate from the encode step; skip the low placeholder.
			seq.push(cp);
			i += 2;
		} else {
			seq.push(cp);
			i += 1;
		}
	}
	return utf8.char(...seq);
}

/**
 * Converts a UTF-8 string into a table of UTF-16 codepoints, simulating
 * JavaScript's UTF-16 string encoding.
 */
export function utfEncodeString(str: string): Array<number> {
	const utf16Units: number[] = [];
	for (const [, codepoint] of utf8.codes(str)) {
		if (codepoint < 0x10000) {
			utf16Units.push(codepoint);
		} else {
			const cp = codepoint - 0x10000;
			const high = math.floor(cp / 0x400) + 0xd800;
			const low = (cp % 0x400) + 0xdc00;
			utf16Units.push(high);
			utf16Units.push(low);
		}
	}

	const result: number[] = [];
	for (let i = 0; i < utf16Units.size(); i++) {
		const current = utf16Units[i];
		if (current >= 0xd800 && current <= 0xdbff && i < utf16Units.size() - 1) {
			const nextUnit = utf16Units[i + 1];
			if (nextUnit >= 0xdc00 && nextUnit <= 0xdfff) {
				result[i] = (current - 0xd800) * 0x400 + (nextUnit - 0xdc00) + 0x10000;
			} else {
				result[i] = current;
			}
		} else {
			result[i] = current;
		}
	}

	return result;
}

// Operations log

/**
 * Pretty-prints a tree operations array for debugging.
 */
export function printOperationsArray(operations: Array<number | string>): void {
	const rendererID = operations[0] as number;
	const rootID = operations[1] as number;
	const logs: string[] = [];
	logs.push(string.format('operations for renderer:%s and root:%s', tostring(rendererID), tostring(rootID)));

	let i = 2;
	const stringTable: string[] = [];
	stringTable.push(''); // ID 0 is the empty string.

	const stringTableSize = operations[i] as number;
	i += 1;
	const stringTableEnd = i + stringTableSize;
	while (i < stringTableEnd) {
		stringTable.push(operations[i] as string);
		i += 1;
	}

	while (i < operations.size()) {
		const operation = operations[i] as number;
		if (operation === TREE_OPERATION_ADD) {
			const id = operations[i + 1] as number;
			const type_ = operations[i + 2] as ElementType;
			i += 3;
			if (type_ === ElementTypeRoot) {
				logs.push(string.format('Add new root node %d', id));
				i += 1; // supportsProfiling
				i += 1; // hasOwnerMetadata
			} else {
				const parentID = operations[i] as number;
				i += 1;
				i += 1; // ownerID
				const displayNameStringID = operations[i] as number;
				const displayName = stringTable[displayNameStringID];
				i += 1;
				i += 1; // key
				logs.push(string.format('Add node %d (%s) as child of %d', id, displayName ?? 'null', parentID));
			}
		} else if (operation === TREE_OPERATION_REMOVE) {
			const removeLength = operations[i + 1] as number;
			i += 2;
			for (let removeIndex = 0; removeIndex < removeLength; removeIndex++) {
				const id = operations[i] as number;
				i += 1;
				logs.push(string.format('Remove node %d', id));
			}
		} else if (operation === TREE_OPERATION_REORDER_CHILDREN) {
			const id = operations[i + 1] as number;
			const numChildren = operations[i + 2] as number;
			i += 3;
			const children: string[] = [];
			for (let childIndex = 0; childIndex < numChildren; childIndex++) {
				children.push(tostring(operations[i] as number));
				i += 1;
			}
			logs.push(string.format('Re-order node %d children %s', id, children.join(',')));
		} else if (operation === TREE_OPERATION_UPDATE_TREE_BASE_DURATION) {
			i += 3;
		} else {
			error(string.format('Unsupported Bridge operation %d', operation));
		}
	}

	print(logs.join('\n  '));
}

// Component filters

/** Returns the default component filter (hide host components). */
export function getDefaultComponentFilters(): Array<ComponentFilter> {
	return [
		{
			type: ComponentFilterElementType,
			value: ElementTypeHostComponent,
			isEnabled: true,
		},
	];
}

/** Reads saved component filters from storage, falling back to defaults. */
export function getSavedComponentFilters(): Array<ComponentFilter> {
	const [ok, result] = pcall(() => {
		const raw = localStorageGetItem(LOCAL_STORAGE_FILTER_PREFERENCES_KEY);
		if (raw !== undefined) {
			return JSON.JSONDecode(raw as string) as Array<ComponentFilter>;
		}
		return undefined;
	});
	if (!ok) {
		return getDefaultComponentFilters();
	}
	return (result as Array<ComponentFilter>) ?? getDefaultComponentFilters();
}

/** Persists component filters to storage. */
export function saveComponentFilters(componentFilters: Array<ComponentFilter>): void {
	localStorageSetItem(LOCAL_STORAGE_FILTER_PREFERENCES_KEY, JSON.JSONEncode(componentFilters));
}

// Console preferences

/** Returns whether component stacks should be appended to console messages. */
export function getAppendComponentStack(): boolean {
	const [ok, result] = pcall(() => {
		const raw = localStorageGetItem(LOCAL_STORAGE_SHOULD_PATCH_CONSOLE_KEY);
		if (raw !== undefined) {
			return JSON.JSONDecode(raw as string) as boolean;
		}
		return undefined;
	});
	if (!ok) {
		return true;
	}
	return (result as boolean) ?? true;
}

/** Stores whether component stacks should be appended to console messages. */
export function setAppendComponentStack(value: boolean): void {
	localStorageSetItem(LOCAL_STORAGE_SHOULD_PATCH_CONSOLE_KEY, JSON.JSONEncode(value));
}

/** Returns whether the debugger should break on console errors. */
export function getBreakOnConsoleErrors(): boolean {
	const [ok, result] = pcall(() => {
		const raw = localStorageGetItem(LOCAL_STORAGE_SHOULD_BREAK_ON_CONSOLE_ERRORS);
		if (raw !== undefined) {
			return JSON.JSONDecode(raw as string) as boolean;
		}
		return undefined;
	});
	if (ok) {
		return (result as boolean) ?? false;
	}
	return false;
}

/** Stores whether the debugger should break on console errors. */
export function setBreakOnConsoleErrors(value: boolean): void {
	localStorageSetItem(LOCAL_STORAGE_SHOULD_BREAK_ON_CONSOLE_ERRORS, JSON.JSONEncode(value));
}

// HOC name splitting

/**
 * Splits a display name into its wrapped display name and a list of HOC
 * wrappers (e.g. `withRouter(connect(Component))` → `Component`,
 * `["withRouter", "connect"]`).
 */
export function separateDisplayNameAndHOCs(
	displayName: string | undefined,
	type_: ElementType
): [string | undefined, Array<string> | undefined] {
	if (displayName === undefined) {
		return [undefined, undefined];
	}

	let hocDisplayNames: Array<string> | undefined;

	if (
		type_ === ElementTypeClass ||
		type_ === ElementTypeForwardRef ||
		type_ === ElementTypeFunction ||
		type_ === ElementTypeMemo
	) {
		const [findStart] = string.find(displayName, '(', 1, true);
		if (findStart !== undefined) {
			const hocTable: string[] = [];
			for (const captures of string.gmatch(displayName, '[^()]+')) {
				hocTable.push(captures[0] as string);
			}

			const count = hocTable.size();
			const lastMatch = hocTable[count - 1];
			hocTable.remove(count - 1);

			displayName = lastMatch;
			hocDisplayNames = hocTable;
		}
	}

	if (type_ === ElementTypeMemo) {
		if (hocDisplayNames === undefined) {
			hocDisplayNames = ['Memo'];
		} else {
			hocDisplayNames.unshift('Memo');
		}
	} else if (type_ === ElementTypeForwardRef) {
		if (hocDisplayNames === undefined) {
			hocDisplayNames = ['ForwardRef'];
		} else {
			hocDisplayNames.unshift('ForwardRef');
		}
	}

	return [displayName, hocDisplayNames];
}

// Shallow comparison

/** Returns `true` when any top-level value of `prev` differs from `next_`. */
export function shallowDiffers(prev: object, next_: object): boolean {
	for (const [key, value] of pairs(prev as Record<string, unknown>)) {
		if ((next_ as Record<string, unknown>)[key as string] !== value) {
			return true;
		}
	}
	return false;
}

// Path-based object mutation

/** Reads the value at `path` inside `object`. */
export function getInObject(object: object, path: Array<string | number>): unknown {
	let reduced: unknown = object;
	for (const attr of path) {
		if (reduced !== undefined && type(reduced) === 'table') {
			const tbl = reduced as Record<string | number, unknown>;
			if (tbl[attr] !== undefined) {
				reduced = tbl[attr];
				continue;
			}
		}
		return undefined;
	}
	return reduced;
}

/** Deletes the value at `path` inside `object`. */
export function deletePathInObject(object: object | undefined, path: Array<string | number>): void {
	const length = path.size();
	const last = path[length - 1];
	if (object === undefined) {
		return;
	}
	const parent = getInObject(object, slice(path, 0, length - 1));
	if (parent !== undefined && type(parent) === 'table') {
		if (isArray(parent)) {
			splice(parent as Array<defined>, last as number, 1);
		} else {
			(parent as Record<string | number, unknown>)[last as string | number] = undefined;
		}
	}
}

/** Renames the value at `oldPath` to `newPath` inside `object`. */
export function renamePathInObject(
	object: object | undefined,
	oldPath: Array<string | number>,
	newPath: Array<string | number>
): void {
	const length = oldPath.size();
	if (object === undefined) {
		return;
	}
	const parent = getInObject(object, slice(oldPath, 0, length - 1));
	if (parent !== undefined && type(parent) === 'table') {
		const lastOld = oldPath[length - 1];
		const lastNew = newPath[length - 1];
		if (isArray(parent)) {
			const arr = parent as Array<defined>;
			arr[lastNew as number] = arr[lastOld as number];
			splice(arr, lastOld as number, 1);
		} else {
			const tbl = parent as Record<string | number, unknown>;
			tbl[lastNew as string | number] = tbl[lastOld as string | number];
			tbl[lastOld as string | number] = undefined;
		}
	}
}

/** Sets the value at `path` inside `object`. */
export function setInObject(object: object | undefined, path: Array<string | number>, value: unknown): void {
	const length = path.size();
	const last = path[length - 1];
	if (object === undefined) {
		return;
	}
	const parent = getInObject(object, slice(path, 0, length - 1));
	if (parent !== undefined && type(parent) === 'table') {
		(parent as Record<string | number, unknown>)[last as string | number] = value;
	}
}

// Data type detection

/** Returns `true` when `data` is a React element. */
export function isElement(data: unknown): boolean {
	return type(data) === 'table' && (data as Record<string, unknown>).$$typeof === ELEMENT_NUMBER;
}

/**
 * Returns the `$$typeof` marker of a React element, resolving markers that
 * live on the element's `type` field (fragment, profiler, context, memo,
 * forwardRef, lazy, provider) the same way React's `typeOf` helper does.
 */
export function elementTypeOf(data: unknown): number | undefined {
	if (type(data) !== 'table') {
		return undefined;
	}
	const tbl = data as Record<string, unknown>;
	const elementType = tbl.$$typeof as number;
	if (elementType === ELEMENT_NUMBER) {
		const type_ = tbl.type;
		if (
			type_ === FRAGMENT_NUMBER ||
			type_ === PROFILER_NUMBER ||
			type_ === STRICT_MODE_NUMBER ||
			type_ === SUSPENSE_NUMBER ||
			type_ === SUSPENSE_LIST_NUMBER
		) {
			return type_ as number;
		}
		if (type(type_) === 'table') {
			const innerElementType = (type_ as Record<string, unknown>).$$typeof as number;
			if (
				innerElementType === CONTEXT_NUMBER ||
				innerElementType === FORWARD_REF_NUMBER ||
				innerElementType === LAZY_NUMBER ||
				innerElementType === MEMO_NUMBER ||
				innerElementType === PROVIDER_NUMBER
			) {
				return innerElementType;
			}
		}
		return elementType;
	}
	if (elementType === PORTAL_NUMBER) {
		return elementType;
	}
	return undefined;
}

/** Returns a descriptive type string for `data`. */
export function getDataType(data: unknown): string {
	if (data === undefined) {
		return 'nil';
	}

	if (isElement(data)) {
		return 'react_element';
	}

	const type_ = type(data);
	if (type_ === 'boolean') {
		return 'boolean';
	} else if (type_ === 'function') {
		return 'function';
	} else if (type_ === 'number') {
		const num = data as number;
		if (num !== num) {
			return 'nan';
		} else if (num === math.huge || num === -math.huge) {
			return 'infinity';
		} else {
			return 'number';
		}
	} else if (type_ === 'table') {
		if (isArray(data)) {
			return 'array';
		}
		return 'table';
	} else if (type_ === 'string') {
		return 'string';
	} else if (type_ === 'nil') {
		return 'nil';
	} else {
		return 'unknown';
	}
}

/**
 * Resolves a display name for a React element, accounting for the element's
 * `$$typeof` marker and its `type` field.
 */
export function getDisplayNameForReactElement(element: unknown): string | undefined {
	const elementType = elementTypeOf(element);
	if (elementType === CONTEXT_NUMBER) {
		return 'ContextConsumer';
	} else if (elementType === PROVIDER_NUMBER) {
		return 'ContextProvider';
	} else if (elementType === FORWARD_REF_NUMBER) {
		return 'ForwardRef';
	} else if (elementType === FRAGMENT_NUMBER) {
		return 'Fragment';
	} else if (elementType === LAZY_NUMBER) {
		return 'Lazy';
	} else if (elementType === MEMO_NUMBER) {
		return 'Memo';
	} else if (elementType === PORTAL_NUMBER) {
		return 'Portal';
	} else if (elementType === PROFILER_NUMBER) {
		return 'Profiler';
	} else if (elementType === STRICT_MODE_NUMBER) {
		return 'StrictMode';
	} else if (elementType === SUSPENSE_NUMBER) {
		return 'Suspense';
	} else if (elementType === SUSPENSE_LIST_NUMBER) {
		return 'SuspenseList';
	}

	const type_ = type(element) === 'table' ? (element as Record<string, unknown>).type : undefined;
	if (type(type_) === 'string') {
		return type_ as string;
	} else if (type(type_) === 'function') {
		return getDisplayName(type_, 'Anonymous');
	} else if (type_ !== undefined) {
		return 'NotImplementedInDevtools';
	} else {
		return 'Element';
	}
}

// Preview formatting

function truncateForDisplay(value: string, length?: number): string {
	const limit = length ?? MAX_PREVIEW_STRING_LENGTH;
	if (value.size() > limit) {
		return `${string.sub(value, 1, limit + 1)}…`;
	}
	return value;
}

/**
 * Builds a Chrome-style inline preview string for `data`.
 */
export function formatDataForPreview(data: unknown, showFormattedValue: boolean): string {
	const type_ = getDataType(data);

	if (type_ === 'function') {
		const [functionName] = debug.info(data as Callback, 'n');
		return truncateForDisplay(`ƒ ${functionName}()`);
	} else if (type_ === 'string') {
		return string.format('"%s"', tostring(data));
	} else if (type_ === 'react_element') {
		return string.format('<%s />', truncateForDisplay(getDisplayNameForReactElement(data) ?? 'Unknown'));
	} else if (type_ === 'array') {
		const arr = data as Array<defined>;
		if (showFormattedValue) {
			let formatted = '';
			for (let i = 0; i < arr.size(); i++) {
				if (i > 0) {
					formatted += ', ';
				}
				formatted = formatted + formatDataForPreview(arr[i], false);
				if (formatted.size() > MAX_PREVIEW_STRING_LENGTH) {
					break;
				}
			}
			return string.format('[%s]', truncateForDisplay(formatted));
		}
		return `Array(${arr.size()})`;
	} else if (type_ === 'table') {
		if (showFormattedValue) {
			const keys = getAllEnumerableKeys(data as object);
			keys.sort(alphaSortKeys);

			let formatted = '';
			for (let i = 0; i < keys.size(); i++) {
				const key = keys[i];
				if (i > 0) {
					formatted += ', ';
				}
				formatted =
					formatted +
					string.format(
						'%s: %s',
						tostring(key),
						formatDataForPreview((data as Record<string, unknown>)[key as string], false)
					);
				if (formatted.size() > MAX_PREVIEW_STRING_LENGTH) {
					break;
				}
			}
			return string.format('{%s}', truncateForDisplay(formatted));
		}
		return '{…}';
	} else if (
		type_ === 'boolean' ||
		type_ === 'number' ||
		type_ === 'infinity' ||
		type_ === 'nan' ||
		type_ === 'nil'
	) {
		return tostring(data);
	}

	const [ok, result] = pcall(() => truncateForDisplay(`${tostring(data)}`));
	return ok ? (result as string) : 'unserializable';
}
