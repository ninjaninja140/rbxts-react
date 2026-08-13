/**
 * Host-config shims for renderers that do not support hydration.
 *
 * Every function throws when called, since a non-hydrating renderer should
 * never invoke them.
 *
 * @module ReactFiberHostConfig/WithNoHydration
 * @internal
 * @packageDocumentation
 */

import invariant from '../invariant';

function shim(..._args: Array<defined>): defined {
	invariant(
		false,
		'The current renderer does not support hydration. ' +
			'This error is likely caused by a bug in React. ' +
			'Please file an issue.'
	);
}

// Hydration (when unsupported)
export type SuspenseInstance = defined;

export const supportsHydration = false;
export const canHydrateInstance = shim;
export const canHydrateTextInstance = shim;
export const canHydrateSuspenseInstance = shim;
export const isSuspenseInstancePending = shim;
export const isSuspenseInstanceFallback = shim;
export const registerSuspenseInstanceRetry = shim;
export const getNextHydratableSibling = shim;
export const getFirstHydratableChild = shim;
export const hydrateInstance = shim;
export const hydrateTextInstance = shim;
export const hydrateSuspenseInstance = shim;
export const getNextHydratableInstanceAfterSuspenseInstance = shim;
export const commitHydratedContainer = shim;
export const commitHydratedSuspenseInstance = shim;
export const clearSuspenseBoundary = shim;
export const clearSuspenseBoundaryFromContainer = shim;
export const didNotMatchHydratedContainerTextInstance = shim;
export const didNotMatchHydratedTextInstance = shim;
export const didNotHydrateContainerInstance = shim;
export const didNotHydrateInstance = shim;
export const didNotFindHydratableContainerInstance = shim;
export const didNotFindHydratableContainerTextInstance = shim;
export const didNotFindHydratableContainerSuspenseInstance = shim;
export const didNotFindHydratableInstance = shim;
export const didNotFindHydratableTextInstance = shim;
export const didNotFindHydratableSuspenseInstance = shim;
