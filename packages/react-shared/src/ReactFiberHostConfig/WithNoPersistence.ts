/**
 * Host-config shims for renderers that do not support persistence.
 *
 * Every function throws when called, since a non-persisting renderer should
 * never invoke them.
 *
 * @module ReactFiberHostConfig/WithNoPersistence
 * @internal
 * @packageDocumentation
 */

import invariant from '../invariant';

function shim(..._args: Array<defined>): defined {
	invariant(
		false,
		'The current renderer does not support persistence. ' +
			'This error is likely caused by a bug in React. ' +
			'Please file an issue.'
	);
}

// Persistence (when unsupported)
export const supportsPersistence = false;
export const cloneInstance = shim;
export const cloneFundamentalInstance = shim;
export const createContainerChildSet = shim;
export const appendChildToContainerChildSet = shim;
export const finalizeContainerChildren = shim;
export const replaceContainerChildren = shim;
export const cloneHiddenInstance = shim;
export const cloneHiddenTextInstance = shim;
