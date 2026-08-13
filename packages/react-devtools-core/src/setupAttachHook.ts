/**
 * Early renderer attachment hook.
 *
 * To support launching DevTools after the client has already started, the
 * renderer needs to be injectable before any other scripts run. The
 * reconciler looks for a global `__REACT_DEVTOOLS_ATTACH__` and uses it to
 * attach an already-injected renderer early.
 *
 * The renderer module is required lazily because requiring it eagerly would
 * initialise React prematurely. By the time this function is actually called,
 * React will already have been initialised.
 *
 * Ported from `react-devtools-core/src/setupAttachHook.js` (React 17).
 *
 * @module setupAttachHook
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { getRendererLazy } from './backend/index';
import type { DevToolsAttach } from './hook';

// The global table the reconciler reads from. `_G` is declared as an empty
// interface, so cast it to a string-indexed record to write onto it.
const globalTable = _G as Record<string, unknown>;

// Cached lazily to avoid requiring the renderer (and therefore React) before
// the first renderer actually injects itself.
let attach: DevToolsAttach | undefined;

globalTable.__REACT_DEVTOOLS_ATTACH__ = (...args: Parameters<DevToolsAttach>) => {
	if (attach === undefined) {
		attach = getRendererLazy().attach;
	}

	return attach(...args);
};
