/**
 * `@nrbx/react-devtools-core` — Low-level React DevTools backend API.
 *
 * Provides `backend.connectToDevtools()` which opens a WebSocket connection to
 * a standalone DevTools server and wires up the bridge, agent, and global hook.
 * You typically do not need to use this package directly; importing
 * `@nrbx/react-devtools` is sufficient for most use cases.
 *
 * ## Advanced Usage
 *
 * ```ts
 * import { backend } from "@nrbx/react-devtools-core";
 *
 * backend.connectToDevtools({
 *     host: "localhost",
 *     port: 8097,
 *     profileOnStart: true,
 * });
 * ```
 *
 * @module index
 * @packageDocumentation
 */

import { connectToDevtools } from './backend/connect';
import { initBackend } from './backend/index';

/**
 * Namespaced entry point for advanced integrations, matching the upstream
 * `react-devtools-core` layout. Use `backend.connectToDevtools()` to open a
 * connection to a standalone DevTools server, or `backend.initBackend()` to
 * initialise the in-game backend against a custom bridge.
 */
export const backend = {
	connectToDevtools,
	initBackend,
};

export { connectToDevtools, default } from './backend/connect';
export type { ConnectOptions } from './backend/connect';
