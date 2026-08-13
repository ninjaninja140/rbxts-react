/**
 * Backend utility helpers shared by the renderer and agent.
 *
 * Ported from `react-devtools-shared/src/backend/utils.js` (React 17).
 *
 * @module backend/utils
 * @packageDocumentation
 */

import { dehydrate } from '../hydration';
import type { DehydratedData } from '../hydration';
import { isArray, splice } from '../utils';

const HttpService = game.GetService('HttpService');

/**
 * Strips complex data out of `data` for bridge transport. Returns `undefined`
 * when the input is nil, mirroring the upstream implementation.
 */
export function cleanForBridge(
	data: unknown,
	isPathAllowed: (path: Array<string | number>) => boolean,
	path?: Array<string | number>
): DehydratedData | undefined {
	if (data === undefined) {
		return undefined;
	}

	const pathToUse = path ?? ([] as (string | number)[]);
	const cleanedPaths: Array<string | number>[] = [];
	const unserializablePaths: Array<string | number>[] = [];
	const cleanedData = dehydrate(data, cleanedPaths, unserializablePaths, pathToUse, isPathAllowed);

	return {
		data: cleanedData,
		cleaned: cleanedPaths,
		unserializable: unserializablePaths,
	};
}

/**
 * Copies a value to the system clipboard.
 *
 * Unimplemented on Roblox: there is no user-facing clipboard API available to
 * the DevTools backend. Retained for API compatibility.
 */
export function copyToClipboard(_value: unknown): void {}

/**
 * Returns a shallow clone of `obj` with the value at `path` removed.
 *
 * `path` is a 0-based array of keys. Deletion is recursive: intermediate
 * values are cloned as the path is traversed, so the original is untouched.
 */
export function copyWithDelete(
	obj: Record<string, unknown> | Array<defined>,
	path: Array<string | number>,
	index = 0
): Record<string, unknown> | Array<defined> {
	const key = path[index];
	const updated = table.clone(obj);

	if (index === path.size() - 1) {
		if (isArray(updated)) {
			splice(updated, key as number, 1);
		} else {
			(updated as Record<string, unknown>)[key] = undefined;
		}
	} else {
		const child = (obj as Record<string, unknown>)[key];
		(updated as Record<string, unknown>)[key] = copyWithDelete(
			child as Record<string, unknown> | Array<defined>,
			path,
			index + 1
		);
	}

	return updated;
}

/**
 * Returns a shallow clone of `obj` with the key at `oldPath` moved to the key
 * at `newPath`. Both paths are expected to be identical except for the final
 * key, e.g. `["path", "to", "foo"]` and `["path", "to", "bar"]`.
 */
export function copyWithRename(
	obj: Record<string, unknown> | Array<defined>,
	oldPath: Array<string | number>,
	newPath: Array<string | number>,
	index = 0
): Record<string, unknown> | Array<defined> {
	const oldKey = oldPath[index];
	const updated = table.clone(obj);

	if (index === oldPath.size() - 1) {
		const newKey = newPath[index];
		(updated as Record<string, unknown>)[newKey] = (updated as Record<string, unknown>)[oldKey];

		if (isArray(updated)) {
			splice(updated, oldKey as number, 1);
		} else {
			(updated as Record<string, unknown>)[oldKey] = undefined;
		}
	} else {
		const child = (obj as Record<string, unknown>)[oldKey];
		(updated as Record<string, unknown>)[oldKey] = copyWithRename(
			child as Record<string, unknown> | Array<defined>,
			oldPath,
			newPath,
			index + 1
		);
	}

	return updated;
}

/**
 * Returns a shallow clone of `obj` with `value` written at `path`, cloning
 * every intermediate object along the way so the original is untouched.
 */
export function copyWithSet(
	obj: Record<string, unknown> | Array<defined>,
	path: Array<string | number>,
	value: unknown,
	index = 0
): Record<string, unknown> | Array<defined> {
	// Once the path is exhausted, the new value replaces the subtree.
	if (index > path.size() - 1) {
		return value as Record<string, unknown> | Array<defined>;
	}

	const key = path[index];
	const updated = table.clone(obj);

	const child = (obj as Record<string, unknown>)[key];
	(updated as Record<string, unknown>)[key] = copyWithSet(
		child as Record<string, unknown> | Array<defined>,
		path,
		value,
		index + 1
	);

	return updated;
}

/**
 * Serializes `data` to a JSON string, dropping any cyclic references.
 *
 * Roblox's `JSONEncode` has no replacer argument, so cyclic references are
 * stripped by a manual pre-pass before encoding.
 */
function serializeValue(value: unknown, cache: Set<object>): unknown {
	if (type(value) !== 'table' || value === undefined) {
		return value;
	}

	const tableValue = value as object;
	if (cache.has(tableValue)) {
		return undefined;
	}
	cache.add(tableValue);

	if (isArray(value)) {
		const arr = value;
		const out: defined[] = [];
		for (let i = 0; i < arr.size(); i++) {
			const serialized = serializeValue(arr[i], cache);
			if (serialized !== undefined) {
				out.push(serialized as defined);
			}
		}
		return out;
	}

	const source = value as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const [key] of pairs(tableValue)) {
		const name = tostring(key);
		const serialized = serializeValue(source[name], cache);
		if (serialized !== undefined) {
			out[name] = serialized;
		}
	}
	return out;
}

/**
 * Serializes `data` to a JSON string for display purposes.
 */
export function serializeToString(data: unknown): string {
	const cache = new Set<object>();
	const [ok, result] = pcall(() => HttpService.JSONEncode(serializeValue(data, cache)));
	return ok ? (result as string) : tostring(result);
}
