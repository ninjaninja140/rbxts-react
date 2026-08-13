/**
 * The abstract update queue used before a component has been mounted.
 *
 * When a component is created but not yet attached to the reconciler, its
 * `__updater` points at this object. Calling `setState`, `forceUpdate`, or
 * `replaceState` against it is a no-op; in development we log a warning so the
 * mistake (typically assigning state after construction instead of inside
 * `init`) is easy to spot.
 *
 * Once the reconciler mounts the component it swaps `__updater` for the real
 * fiber-backed update queue, so no state update is ever silently lost.
 *
 * @module ReactNoopUpdateQueue
 * @internal
 * @packageDocumentation
 */

import { __DEV__ } from '@nrbx/react-globals';
import { console } from '@nrbx/react-shared';

/**
 * Set of warnings already emitted, keyed by `componentName.callerName`. We
 * only want to warn once per (component, caller) pair.
 *
 * @internal
 */
const didWarnStateUpdateForUnmountedComponent: Record<string, boolean> = {};

/**
 * Emit a one-time development warning that a state update was scheduled
 * against an unmounted component.
 *
 * @param publicInstance - The component instance being updated.
 * @param callerName - The public API that was called, e.g. `"setState"`.
 * @internal
 */
function warnNoop(publicInstance: unknown, callerName: string): void {
	if (!__DEV__) {
		return;
	}

	const componentName =
		((publicInstance as Record<string, unknown>).__componentName as string | undefined) ?? 'ReactClass';
	const warningKey = `${componentName}.${callerName}`;
	if (didWarnStateUpdateForUnmountedComponent[warningKey] !== undefined) {
		return;
	}

	console.error(
		"Can't call %s on a component that is not yet mounted. " +
			'This is a no-op, but it might indicate a bug in your application. ' +
			'Instead, assign to `self.state` directly with the desired state in ' +
			"the %s component's `init` method.",
		callerName,
		componentName
	);
	didWarnStateUpdateForUnmountedComponent[warningKey] = true;
}

/**
 * The no-op update queue given to components that have not been mounted yet.
 *
 * Methods are declared as function-valued properties (not TypeScript methods)
 * so roblox-ts emits plain functions that receive the component instance as
 * the first explicit argument, matching the original Luau runtime.
 *
 * @internal
 */
const ReactNoopUpdateQueue = {
	/**
	 * Whether this component is mounted. Always `false` here because the real
	 * queue replaces this object the moment a component mounts.
	 */
	isMounted: (_publicInstance: unknown): boolean => {
		return false;
	},

	/**
	 * Schedule a forced update. No-op before mount.
	 */
	enqueueForceUpdate: (publicInstance: unknown, _callback?: unknown, _callerName?: string): void => {
		warnNoop(publicInstance, 'forceUpdate');
	},

	/**
	 * Replace all state. No-op before mount.
	 */
	enqueueReplaceState: (
		publicInstance: unknown,
		_completeState?: unknown,
		_callback?: unknown,
		_callerName?: string
	): void => {
		warnNoop(publicInstance, 'replaceState');
	},

	/**
	 * Merge partial state. No-op before mount.
	 */
	enqueueSetState: (
		publicInstance: unknown,
		_partialState?: unknown,
		_callback?: unknown,
		_callerName?: string
	): void => {
		warnNoop(publicInstance, 'setState');
	},
};

export default ReactNoopUpdateQueue;
