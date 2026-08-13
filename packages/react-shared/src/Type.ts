/**
 * Markers for annotating Roblox objects with their expected prop types.
 *
 * Use `Type` as a key with the marker as the value:
 *
 * ```ts
 * const foo = {
 *     [Type]: Type.HostEvent,
 * };
 * ```
 *
 * @module Type
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { named } from './Symbol';

// `newproxy` is not declared in `@rbxts/compiler-types`, so we shim it here.
declare function newproxy(addMetatable: boolean): defined;

interface TypeMetatable {
	__index?: Record<string, defined>;
	__tostring?: (self: defined) => string;
}

const Type = newproxy(true);

const TypeInternal: Record<string, defined> = {};

function addType(name: string): void {
	TypeInternal[name] = named(`Roact${name}`);
}

addType('HostChangeEvent');
addType('HostEvent');

// Luau tables accept any value as a key, but roblox-ts only allows
// string/number/symbol indexers. `Type` is a userdata value, so the key is
// cast here; the cast is type-only and the userdata is still the real key.
const typeKey = Type as unknown as string;

/**
 * Stores a type marker on `value` under the `Type` key.
 *
 * @param value - The object to annotate.
 * @param marker - The marker value.
 * @internal
 */
export function setType(value: defined, marker: defined): void {
	(value as unknown as Record<string, defined>)[typeKey] = marker;
}

/**
 * Returns the type marker stored on `value`, or `undefined` if it has none.
 *
 * @param value - The value to inspect.
 * @internal
 */
function of(value: defined): defined | undefined {
	if (type(value) !== 'table') {
		return undefined;
	}
	return (value as unknown as Record<string, defined>)[typeKey];
}

const mt = getmetatable(Type) as unknown as TypeMetatable;
mt.__index = TypeInternal;
mt.__tostring = () => 'RoactType';

export { Type, TypeInternal, of };
export default Type;
