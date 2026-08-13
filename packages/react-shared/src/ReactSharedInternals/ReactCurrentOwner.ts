/**
 * Tracks the current owner fiber while rendering.
 *
 * @module ReactCurrentOwner
 * @internal
 * @packageDocumentation
 */

/**
 * The mutable owner slot.
 *
 * @internal
 */
const ReactCurrentOwner = {
	current: undefined as any,
};

export default ReactCurrentOwner;
