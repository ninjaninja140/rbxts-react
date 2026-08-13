/**
 * Rendering modes for a fiber subtree.
 *
 * Upstream: `packages/react-reconciler/src/ReactTypeOfMode.js`
 *
 * @module ReactTypeOfMode
 * @internal
 * @packageDocumentation
 */

export type TypeOfMode = number;

export const NoMode = 0b00000;
export const StrictMode = 0b00001;
// TODO: Remove BlockingMode and ConcurrentMode by reading from the root tag instead.
export const BlockingMode = 0b00010;
export const ConcurrentMode = 0b00100;
export const ProfileMode = 0b01000;
export const DebugTracingMode = 0b10000;

export default {
	NoMode,
	StrictMode,
	BlockingMode,
	ConcurrentMode,
	ProfileMode,
	DebugTracingMode,
};
