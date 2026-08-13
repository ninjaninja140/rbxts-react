/**
 * `@nrbx/react-devtools` — React DevTools integration for Roblox.
 *
 * Importing this module automatically connects your React application to
 * the React DevTools extension. No additional configuration is required
 * — just add the import to your entry point.
 *
 * ## Quick Start
 *
 * ```ts
 * // In your main client script:
 * import "@nrbx/react-devtools";
 *
 * // React DevTools will now be available for this session
 * ```
 *
 * ## Requirements
 *
 * - `__REACT_DEVTOOLS_GLOBAL_HOOK__` must be enabled in `@nrbx/react-globals`
 *   (enabled by default)
 * - DevTools server must be running and reachable
 *
 * @module index
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { connectToDevtools } from '@nrbx/react-devtools-core';

// Connect immediately with default options, matching the behavior of the
// upstream `react-devtools` package. If you need more control (custom host,
// port, profiler settings), use `@nrbx/react-devtools-core` directly.
connectToDevtools();
