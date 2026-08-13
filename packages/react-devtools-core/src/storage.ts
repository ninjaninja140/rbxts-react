/**
 * In-memory `localStorage` / `sessionStorage` shims.
 *
 * Roblox has no browser storage, so the DevTools backend keeps these values
 * in plain tables held on the `@nrbx/react-globals` flags. Data is lost when
 * the game session ends.
 *
 * Ported from `react-devtools-shared/src/storage.js` (React 17).
 *
 * @module storage
 * @packageDocumentation
 */

import { __LOCALSTORAGE__, __SESSIONSTORAGE__ } from '@nrbx/react-globals';

const localStorage = __LOCALSTORAGE__;
const sessionStorage = __SESSIONSTORAGE__;

/** Read a value from the in-memory localStorage. */
export function localStorageGetItem(key: string): unknown {
	return localStorage[key];
}

/** Remove a value from the in-memory localStorage. */
export function localStorageRemoveItem(key: string): void {
	localStorage[key] = undefined;
}

/** Write a value to the in-memory localStorage. */
export function localStorageSetItem(key: string, value: unknown): void {
	localStorage[key] = value;
}

/** Read a value from the in-memory sessionStorage. */
export function sessionStorageGetItem(key: string): unknown {
	return sessionStorage[key];
}

/** Remove a value from the in-memory sessionStorage. */
export function sessionStorageRemoveItem(key: string): void {
	sessionStorage[key] = undefined;
}

/** Write a value to the in-memory sessionStorage. */
export function sessionStorageSetItem(key: string, value: unknown): void {
	sessionStorage[key] = value;
}
