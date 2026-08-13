/**
 * Opaque marker values ("symbols") for annotating Roblox-specific objects.
 *
 * A Symbol is a `userdata` value that stringifies to `Symbol(<name>)`. It is
 * used as a private, unforgeable key so that host-event and tag markers cannot
 * collide with user props.
 *
 * @module Symbol
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

// `newproxy` is not declared in `@rbxts/compiler-types`, so we shim it here.
declare function newproxy(addMetatable: boolean): defined;

interface SymbolMetatable {
	__tostring?: (self: defined) => string;
}

/**
 * Creates a Symbol with the given name.
 *
 * When printed or coerced to a string, the symbol renders as `Symbol(<name>)`.
 *
 * @param name - The symbol name.
 * @internal
 */
function named(name: string): defined {
	assert(type(name) === 'string', 'Symbols must be created using a string name!');

	const symbolValue = newproxy(true);
	const wrappedName = string.format('Symbol(%s)', name);

	const mt = getmetatable(symbolValue) as unknown as SymbolMetatable;
	mt.__tostring = () => wrappedName;

	return symbolValue;
}

export { named };
export default { named };
