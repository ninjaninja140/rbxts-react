/**
 * `@nrbx/react-roblox` — React bindings for the Roblox engine.
 *
 * Equivalent of `react-dom` for the web. Provides:
 *
 * - `createRoot(container)` — create a React root mounted on a Roblox Instance
 * - `createPortal(children, container)` — render children into a different container
 * - `flushSync(callback)` — force synchronous render
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
 * @module react-roblox
 * @packageDocumentation
 */

// Re-export the full ReactRoblox API (createRoot, createPortal, flushSync, etc.)
export {
	createRoot,
	createBlockingRoot,
	createLegacyRoot,
	createPortal,
	flushSync,
	unstable_batchedUpdates,
	version,
	Event,
	Change,
	Tag,
	act,
	unstable_isNewReconciler,
	__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
	robloxReactProfiling,
	schedulingProfiler,
	default as ReactRoblox,
} from './client/ReactRoblox';

// Host types (available as named exports for type-level usage)

export type {
	Container,
	HostInstance,
	TextInstance,
	SuspenseInstance,
	Type,
	Props,
	HydratableInstance,
	PublicInstance,
	HostContext,
	RootType,
	RootOptions,
} from './client/ReactRobloxHostTypes';
