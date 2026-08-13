/**
 * Console patching helpers.
 *
 * In the browser DevTools patches `console` to append component stacks and to
 * break on console errors. Roblox has no global `console` object, and the
 * renderer can't meaningfully rewrite `print`/`warn`, so these are kept as
 * no-ops while preserving the API surface expected by the rest of the backend.
 *
 * Ported from `react-devtools-shared/src/backend/console.js` (React 17).
 *
 * @module console
 * @packageDocumentation
 */

import type { ReactRenderer } from './types';

// Capture the Roblox globals before defining the object below, so the method
// names never shadow the underlying functions.
const _error = error;
const _warn = warn;
const _print = print;

/**
 * Console helpers exposed to the DevTools backend.
 *
 * The upstream implementation patches the global `console` object; on Roblox
 * the patch methods are intentionally no-ops.
 */
export const Console = {
	/** No-op — component stack appending is not supported on Roblox. */
	patch(_object: { appendComponentStack: boolean; breakOnConsoleErrors: boolean }): void {},

	/** No-op — nothing was patched. */
	unpatch(): void {},

	/** Forward to Roblox's `error`. */
	error(...args: Array<unknown>): void {
		_error(...args);
	},

	/** Forward to Roblox's `warn`. */
	warn(...args: Array<unknown>): void {
		_warn(...args);
	},

	/** Forward to Roblox's `print`. */
	log(...args: Array<unknown>): void {
		_print(...args);
	},

	/** No-op — renderer console registration is unsupported on Roblox. */
	registerRenderer(_renderer: ReactRenderer): void {},
};
