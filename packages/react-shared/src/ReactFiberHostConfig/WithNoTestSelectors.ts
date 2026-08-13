/**
 * Host-config shims for renderers that do not support test selectors.
 *
 * Every function throws when called, since a renderer without test selector
 * support should never invoke them.
 *
 * @module ReactFiberHostConfig/WithNoTestSelectors
 * @internal
 * @packageDocumentation
 */

import invariant from '../invariant';

function shim(..._args: Array<defined>): defined {
	invariant(
		false,
		'The current renderer does not support test selectors. ' +
			'This error is likely caused by a bug in React. ' +
			'Please file an issue.'
	);
}

// Test selectors (when unsupported)
export const supportsTestSelectors = false;
export const findFiberRoot = shim;
export const getBoundingRect = shim;
export const getTextContent = shim;
export const isHiddenSubtree = shim;
export const matchAccessibilityRole = shim;
export const setFocusIfFocusable = shim;
export const setupIntersectionObserver = shim;
