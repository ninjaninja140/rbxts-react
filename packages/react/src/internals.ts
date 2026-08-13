/**
 * React internals bridge — exposes the internal React runtime APIs needed
 * by companion packages (react-debug-tools, react-devtools-core).
 *
 * These values come directly from the native TypeScript runtime packages
 * (`@nrbx/react-shared` and `@nrbx/react-reconciler`), not from a Lua bridge.
 * They are **not** part of the public API and may change between React
 * versions.
 *
 * @module internals
 * @internal
 * @packageDocumentation
 */

import { initialize } from '@nrbx/react-reconciler';
import { ReactSharedInternals, ReactSymbols } from '@nrbx/react-shared';
import type { Dispatcher } from '@nrbx/react-shared';
import * as Shared from '@nrbx/react-shared';

// Reconciler

/**
 * The initialised reconciler module namespace.
 *
 * The reconciler is renderer-agnostic: calling `initialize({})` splices in an
 * empty host config and returns the reconciler module. The renderer
 * (`@nrbx/react-roblox`) later calls `initialize` again with the real host
 * config, which splices into the same shared host-config table.
 *
 * Work tags and mode constants live on the reconciler's `default` export.
 *
 * @internal
 */
export const Reconciler = initialize({});

/**
 * A reference object holding the current hook dispatcher.
 *
 * During normal rendering, this points to the "real" dispatcher. The
 * debug-tools package replaces it with a logging dispatcher to inspect
 * hook calls, then restores the original.
 */
export interface CurrentDispatcherRef {
	/** The current dispatcher table (all hook functions). */
	current: Dispatcher | undefined;
}

// Re-exported verbatim so companion packages can reach the shared internals
// and symbol tables through the same names they used with the old Lua bridge.
export { Shared, ReactSharedInternals };

// Work Tags — identify the type of a fiber node

export const WorkTags = Reconciler.default.ReactWorkTags as Record<string, number>;

/** Function component work tag. */
export const FunctionComponent = WorkTags.FunctionComponent as number;
/** Memo component work tag (wrapped in React.memo). */
export const SimpleMemoComponent = WorkTags.SimpleMemoComponent as number;
/** Context.Provider work tag. */
export const ContextProvider = WorkTags.ContextProvider as number;
/** forwardRef component work tag. */
export const ForwardRef = WorkTags.ForwardRef as number;
/** Block component work tag (experimental). */
export const Block = WorkTags.Block as number;

// Type of Mode — rendering mode constant

/** The "no mode" (legacy/concurrent-disabled) rendering mode constant. */
export const NoMode = (Reconciler.default.ReactTypeOfMode as Record<string, number>).NoMode as number;

// React Symbols — internal $$typeof markers

export { ReactSymbols };

/** The `$$typeof` value for opaque identifier objects. */
export const REACT_OPAQUE_ID_TYPE = ReactSymbols.REACT_OPAQUE_ID_TYPE;
