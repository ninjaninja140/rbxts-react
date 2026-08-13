/**
 * A small value inspector used to format DEV-only diagnostic messages.
 *
 * This is intentionally simpler than `util.inspect` from the Lua polyfill; it
 * only needs to be good enough to identify a value in an error message.
 *
 * @module inspect
 * @internal
 * @packageDocumentation
 */

const MAX_DEPTH = 3;

/**
 * Renders `value` as a human-readable string.
 *
 * - `nil` renders as `"nil"`
 * - strings are quoted
 * - tables render as `{ key = value, ... }` (up to `MAX_DEPTH` levels deep)
 *
 * @internal
 */
function inspect(value: unknown, depth = 0): string {
	if (value === undefined) {
		return 'nil';
	}

	const valueType = type(value);
	if (valueType === 'string') {
		return string.format('%q', value as string);
	}
	if (valueType === 'number' || valueType === 'boolean') {
		return tostring(value);
	}
	if (valueType === 'function') {
		return 'function';
	}
	if (valueType === 'table') {
		if (depth >= MAX_DEPTH) {
			return '{ ... }';
		}
		const parts: string[] = [];
		for (const [key, item] of pairs(value as Record<string, defined>)) {
			parts.push(`${tostring(key)} = ${inspect(item, depth + 1)}`);
		}
		return `{ ${parts.join(', ')} }`;
	}
	// userdata, thread, vector, buffer — fall back to tostring.
	return tostring(value);
}

export default inspect;
