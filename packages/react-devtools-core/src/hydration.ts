/**
 * Dehydration / rehydration of component data for transport over the bridge.
 *
 * The bridge serializes inspected element data to JSON. Complex values
 * (functions, instances, deeply nested objects) cannot be serialized, so they
 * are replaced with lightweight "dehydrated" metadata records. The paths of
 * every replaced value are recorded in a `cleaned` list so the frontend can
 * re-request them on demand.
 *
 * Ported from `react-devtools-shared/src/hydration.js` (React 17). `hydrate`
 * and `fillInPath` are intentionally unimplemented on Roblox: the standalone
 * DevTools frontend does not currently use them.
 *
 * @module hydration
 * @packageDocumentation
 */

import { formatDataForPreview, getAllEnumerableKeys, getDataType, getDisplayNameForReactElement } from './utils';

/** Depth at which nested data is dehydrated instead of serialized. */
const LEVEL_THRESHOLD = 2;

/** Metadata describing a value that was replaced during dehydration. */
export interface Dehydrated {
	inspectable: boolean;
	name: string | undefined;
	preview_long: string | undefined;
	preview_short: string | undefined;
	readonly?: boolean;
	size?: number;
	type: string;
}

/** Metadata describing a value that can never be serialized. */
export interface Unserializable {
	name: string | undefined;
	preview_long: string | undefined;
	preview_short: string | undefined;
	readonly?: boolean;
	size?: number;
	type: string;
	unserializable: boolean;
}

/** The payload returned by {@link cleanForBridge}. */
export interface DehydratedData {
	cleaned: Array<Array<string | number>>;
	data: unknown;
	unserializable: Array<Array<string | number>>;
}

function unimplemented(functionName: string): void {
	print(`[React DevTools] ${functionName} was called, but is not implemented on Roblox.`);
}

/**
 * Returns a new path with `key` appended. Paths handed to the `cleaned` /
 * `unserializable` lists must be immutable snapshots, so we always copy.
 */
function appendPath(path: Array<string | number>, key: string | number): Array<string | number> {
	const result: (string | number)[] = [];
	for (const value of path) {
		result.push(value);
	}
	result.push(key);
	return result;
}

/**
 * Builds the dehydrated metadata record for a complex value.
 */
export function createDehydrated(
	type_: string,
	inspectable: boolean,
	data: object,
	cleaned: Array<Array<string | number>>,
	path: Array<string | number>
): Dehydrated {
	cleaned.push(path);

	const dehydrated: Dehydrated = {
		inspectable: inspectable,
		type: type_,
		preview_long: formatDataForPreview(data, true),
		preview_short: formatDataForPreview(data, false),
		name: '',
	};

	if (type_ === 'array' || type_ === 'typed_array') {
		dehydrated.size = (data as Array<defined>).size();
	} else if (type_ === 'object') {
		dehydrated.size = getAllEnumerableKeys(data).size();
	}

	if (type_ === 'iterator' || type_ === 'typed_array') {
		dehydrated.readonly = true;
	}

	return dehydrated;
}

/**
 * Recursively strips complex data out of `data`, replacing each stripped value
 * with dehydrated metadata and recording its path in `cleaned`.
 *
 * Values nested deeper than {@link LEVEL_THRESHOLD} are always dehydrated
 * unless `isPathAllowed` explicitly allows the path.
 */
export function dehydrate(
	data: unknown,
	cleaned: Array<Array<string | number>>,
	unserializable: Array<Array<string | number>>,
	path: Array<string | number>,
	isPathAllowed: (path: Array<string | number>) => boolean,
	level_?: number
): unknown {
	const level = level_ ?? 0;
	const type_ = getDataType(data);

	if (type_ === 'function') {
		cleaned.push(path);
		const [functionName] = debug.info(data as Callback, 'n');
		return {
			inspectable: false,
			preview_short: formatDataForPreview(data, false),
			preview_long: formatDataForPreview(data, true),
			name: functionName,
			type: type_,
		} as Dehydrated;
	} else if (type_ === 'string') {
		const str = data as string;
		return str.size() <= 500 ? str : `${string.sub(str, 1, 500)}...`;
	} else if (type_ === 'react_element') {
		cleaned.push(path);
		return {
			inspectable: false,
			preview_short: formatDataForPreview(data, false),
			preview_long: formatDataForPreview(data, true),
			name: getDisplayNameForReactElement(data) ?? 'Unknown',
			type: type_,
		} as Dehydrated;
	} else if (type_ === 'array') {
		const isPathAllowedCheck = isPathAllowed(path);
		if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
			return createDehydrated(type_, true, data as object, cleaned, path);
		}

		const arr = data as Array<defined>;
		const result: defined[] = [];
		for (let i = 0; i < arr.size(); i++) {
			result.push(
				dehydrate(
					arr[i],
					cleaned,
					unserializable,
					appendPath(path, i),
					isPathAllowed,
					isPathAllowedCheck ? 1 : level + 1
				) as defined
			);
		}
		return result;
	} else if (type_ === 'table') {
		const isPathAllowedCheck = isPathAllowed(path);
		if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
			return createDehydrated(type_, true, data as object, cleaned, path);
		}

		const object: Record<string, unknown> = {};
		const keys = getAllEnumerableKeys(data as object);
		for (const key of keys) {
			const name = tostring(key);
			object[name] = dehydrate(
				(data as Record<string, unknown>)[name],
				cleaned,
				unserializable,
				appendPath(path, name),
				isPathAllowed,
				isPathAllowedCheck ? 1 : level + 1
			);
		}
		return object;
	} else if (type_ === 'infinity' || type_ === 'nan' || type_ === 'nil') {
		cleaned.push(path);
		return { type: type_ };
	}

	return data;
}

/** Unimplemented on Roblox — retained for API compatibility. */
export function fillInPath(
	_object: object,
	_data: DehydratedData,
	_path: Array<string | number>,
	_value: unknown
): void {
	unimplemented('fillInPath');
}

/** Unimplemented on Roblox — returns the object unchanged. */
export function hydrate(
	object: unknown,
	_cleaned: Array<Array<string | number>>,
	_unserializable: Array<Array<string | number>>
): unknown {
	unimplemented('hydrate');
	return object;
}
