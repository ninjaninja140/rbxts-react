/**
 * `react-roblox` — React bindings for the Roblox engine.
 *
 * This is the top-level entry point for the Roblox renderer, equivalent to
 * `react-dom` on the web.  It provides:
 *
 * - {@link createRoot} — mount a React tree onto a Roblox `Instance`
 * - {@link createPortal} — render children into a different container
 * - {@link flushSync} — force a synchronous flush of pending updates
 * - {@link unstable_batchedUpdates} — batch multiple state updates together
 * - {@link Event}, {@link Change}, {@link Tag} — Roblox-specific prop symbols
 *
 * ## Quick Start
 *
 * ```tsx
 * import React from "@nrbx/react";
 * import { createRoot } from "@nrbx/react-roblox";
 *
 * const root = createRoot(container);
 * root.render(<App />);
 * ```
 *
 * @see https://github.com/facebook/react/blob/main/packages/react-dom/src/client/ReactDOM.js
 *
 * @module react-roblox
 * @packageDocumentation
 */

import type { Container } from './ReactRobloxHostTypes';
import { createRoot, createBlockingRoot, createLegacyRoot, isValidContainer } from './ReactRobloxRoot';
import { Reconciler as ReactReconciler } from './ReactRobloxReconciler';
import type { Fiber } from '@nrbx/react-reconciler';
import { invariant, ReactVersion, ReactFeatureFlags, Event, Change, Tag, type ReactNodeList } from '@nrbx/react-shared';
import {
	getInstanceFromNode,
	getNodeFromInstance,
	getFiberCurrentPropsFromNode,
	getClosestInstanceFromNode,
} from './ReactRobloxComponentTree';

// Reconciler-provided functions (extracted at module-load time)

// `createPortal` and the profiling entries live on the reconciler's `default`
// export; the remaining functions are named exports of the configured module.
const createPortalImpl = ReactReconciler.default.createPortal;
const robloxReactProfiling = ReactReconciler.default.robloxReactProfiling;
const schedulingProfiler = ReactReconciler.default.schedulingProfiler;

const {
	batchedUpdates,
	flushSync: reconcilerFlushSync,
	flushPassiveEffects,
	injectIntoDevTools,
	IsThisRendererActing,
} = ReactReconciler;

const { enableNewReconciler } = ReactFeatureFlags;

// Portal

/**
 * Creates a portal that renders children into a different Roblox instance.
 *
 * Useful for overlays, tooltips, or modals that need to break out of their
 * parent's layout.
 *
 * ```tsx
 * import { createPortal } from "@nrbx/react-roblox";
 *
 * function Modal({ children }: { children: React.ReactNode }) {
 *     return createPortal(
 *         <Frame>{children}</Frame>,
 *         someOtherGui,
 *     );
 * }
 * ```
 *
 * @param children - The React element(s) to portal.
 * @param container - The Roblox instance to render into.
 * @param key - Optional React key for the portal.
 * @returns A React portal element.
 */
function createPortal(children: ReactNodeList, container: Container, key?: string): unknown {
	invariant(isValidContainer(container), 'Target container is not a Roblox Instance.');
	return createPortalImpl(children, container, undefined, key);
}

// flushSync

/**
 * Forces React to flush any pending updates synchronously.
 *
 * **Warning:** {@link flushSync} can significantly hurt performance. Use it
 * sparingly.
 *
 * ```ts
 * import { flushSync } from "@nrbx/react-roblox";
 *
 * flushSync(() => {
 *     setState(newValue);
 * });
 * // The DOM (Roblox instances) are now fully updated
 * ```
 *
 * @param callback - A function whose state updates should be flushed immediately.
 */
function flushSync(callback: () => void): void {
	reconcilerFlushSync(callback, undefined);
}

// act (only available with mocked scheduler — testing)

/**
 * Testing utility that waits for pending effects to finish.
 *
 * In production builds `act` throws an error — it's only available when the
 * scheduler is mocked (via `__ROACT_17_MOCK_SCHEDULER__`).
 *
 * @param fn - The function containing render/update calls.
 */
const act: (fn: () => void) => void = () => {
	error(
		'ReactRoblox.act is only available in testing environments, not ' +
			'production. Enable the `__ROACT_17_MOCK_SCHEDULER__` global in your ' +
			'test configuration in order to use `act`.'
	);
};

// DevTools injection (eager at module load)

const _foundDevTools = injectIntoDevTools({
	findFiberByHostInstance: getClosestInstanceFromNode as unknown as (instance: Object) => Fiber | undefined,
	bundleType: 0, // 1 = __DEV__, 0 = production
	version: ReactVersion,
	rendererPackageName: 'ReactRoblox',
});

// Public API

/**
 * The version string of the React runtime (e.g. `"19.0.0"`).
 */
export const version = ReactVersion;

export { createRoot, createBlockingRoot, createLegacyRoot } from './ReactRobloxRoot';

export { createPortal };

export { flushSync };
export { batchedUpdates as unstable_batchedUpdates };

/** Symbol used to attach a Roblox event listener as a prop. */
export { Event };
/** Symbol used to attach a Roblox property-change listener as a prop. */
export { Change };
/** Symbol used to tag a Roblox instance with one or more CollectionService tags. */
export { Tag };

export { act };

/** `true` when the new reconciler is active. */
export const unstable_isNewReconciler = enableNewReconciler;

export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	Events: {
		getInstanceFromNode,
		getNodeFromInstance,
		getFiberCurrentPropsFromNode,
		flushPassiveEffects,
		IsThisRendererActing,
	},
};

export { robloxReactProfiling, schedulingProfiler };

/**
 * The full `ReactRoblox` namespace — equivalent to `ReactDOM` on the web.
 *
 * ```ts
 * import ReactRoblox from "@nrbx/react-roblox";
 *
 * const root = ReactRoblox.createRoot(container);
 * ```
 */
const ReactRoblox = {
	createRoot,
	createBlockingRoot,
	createLegacyRoot,
	createPortal,
	flushSync,
	unstable_batchedUpdates: batchedUpdates,
	__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
	version: ReactVersion,
	Event,
	Change,
	Tag,
	unstable_isNewReconciler: enableNewReconciler,
	act,
	robloxReactProfiling,
	schedulingProfiler,
};

export default ReactRoblox;
