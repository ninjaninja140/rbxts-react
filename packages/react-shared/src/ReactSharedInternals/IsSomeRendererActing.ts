/**
 * Tracks whether a renderer is currently inside an `act()` scope.
 *
 * @module IsSomeRendererActing
 * @internal
 * @packageDocumentation
 */

const IsSomeRendererActing = {
	current: false,
};

export default IsSomeRendererActing;
