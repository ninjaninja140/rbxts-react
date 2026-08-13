/**
 * Compile-time feature flags for the reconciler.
 *
 * Roblox reads most of these from studio FFlag services; this port hardcodes
 * the same defaults the runtime used when no flag was configured.
 *
 * @module ReactFeatureFlags
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__, __EXPERIMENTAL__, __PROFILE__ } from '@nrbx/react-globals';

/**
 * Feature flag table consumed throughout the reconciler.
 * @internal
 */
const ReactFeatureFlags = {
	// Adds verbose console logging for state updates, suspense, and the work loop.
	enableDebugTracing: false,

	// Adds user timing marks for an experimental scheduling profiler.
	enableSchedulingProfiler: __PROFILE__ && __EXPERIMENTAL__,

	// When DEV mode is enabled, throw an error when a fiber attempts to yield.
	catchYieldingInDEV: __DEV__,

	// Double-invoke render-phase lifecycles and setState reducers in Strict Mode.
	debugRenderPhaseSideEffectsForStrictMode: __DEV__,

	// Replay the begin phase of a failed component inside invokeGuardedCallback.
	replayFailedUnitOfWorkWithInvokeGuardedCallback: __DEV__,

	// Warn about deprecated, async-unsafe lifecycles.
	warnAboutDeprecatedLifecycles: true,

	// Gather advanced timing metrics for Profiler subtrees.
	enableProfilerTimer: __PROFILE__,

	// Record durations for commit and passive effects phases.
	enableProfilerCommitHooks: __PROFILE__,

	// Trace which interactions trigger each commit.
	enableSchedulerTracing: __PROFILE__,

	// SSR experiments.
	enableSuspenseServerRenderer: __EXPERIMENTAL__,

	// Flight experiments.
	enableBlocksAPI: __EXPERIMENTAL__,
	enableLazyElements: __EXPERIMENTAL__,

	// Only used in www builds.
	enableSchedulerDebugging: false,

	// Experimental Host Component support.
	enableFundamentalAPI: false,

	// Experimental Scope support.
	enableScopeAPI: false,

	// Experimental Create Event Handle API.
	enableCreateEventHandleAPI: false,

	// Warn about a missing scheduler mock.
	warnAboutUnmockedScheduler: false,

	// Suspense callback support.
	enableSuspenseCallback: false,

	// Warn about defaultProps on function components.
	warnAboutDefaultPropsOnFunctionComponents: false,

	// Warn when spreading a `key` into an element.
	warnAboutSpreadingKeyToJSX: true,

	enableComponentStackLocations: true,

	enableNewReconciler: true,

	// Errors thrown while unmounting bypass boundaries that are also unmounting.
	skipUnmountedBoundaries: true,

	// Filter React-internal frames out of stack traces.
	filterInternalStackFrames: __DEV__,

	// Future APIs to be deprecated.
	warnAboutStringRefs: false,
	disableLegacyContext: false,
	disableModulePatternComponents: false,
	warnUnstableRenderSubtreeIntoContainer: false,

	// Defer render-phase updates to a subsequent render.
	deferRenderPhaseUpdateToNextBatch: false,

	// Replacement for runWithPriority in React internals.
	decoupleUpdatePriorityFromScheduler: true,

	enableEagerRootListeners: false,

	enableDoubleInvokingEffects: false,
};

export default ReactFeatureFlags;
