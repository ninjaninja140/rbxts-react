/**
 * The `None` sentinel — Roblox's "render nothing" value.
 *
 * Passing `None` as a child tells the reconciler to skip it entirely, which
 * mirrors Roact's `Roact.None`. It is exposed publicly as `React.None`.
 *
 * @module None
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

// `newproxy` is not declared in `@rbxts/compiler-types`, so we shim it here.
declare function newproxy(addMetatable: boolean): defined;

interface NoneMetatable {
	__tostring?: (self: defined) => string;
}

/**
 * A userdata sentinel. The reconciler and `React.Children` both treat userdata
 * children as "nothing", so passing this value renders no instance.
 */
const None = newproxy(true);

const mt = getmetatable(None) as unknown as NoneMetatable;
mt.__tostring = () => 'None';

export default None;
