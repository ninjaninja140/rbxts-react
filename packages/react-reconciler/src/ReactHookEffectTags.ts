/**
 * Effect tag bits for hook effects.
 *
 * Upstream: `packages/react-reconciler/src/ReactHookEffectTags.js`
 *
 * @module ReactHookEffectTags
 * @internal
 * @packageDocumentation
 */

export type HookFlags = number;

export const NoFlags = 0b000;
// Represents whether the effect should fire.
export const HasEffect = 0b001;
// Represents the phase in which the effect (not the clean-up) fires.
export const Layout = 0b010;
export const Passive = 0b100;

export default {
	NoFlags,
	HasEffect,
	Layout,
	Passive,
};
