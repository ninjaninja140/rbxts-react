/**
 * Tags describing the kind of root container the reconciler is attached to.
 *
 * Upstream: `packages/react-reconciler/src/ReactRootTags.js`
 *
 * @module ReactRootTags
 * @internal
 * @packageDocumentation
 */

export type RootTag = number;

export const LegacyRoot = 0;
export const BlockingRoot = 1;
export const ConcurrentRoot = 2;

export default {
	LegacyRoot,
	BlockingRoot,
	ConcurrentRoot,
};
