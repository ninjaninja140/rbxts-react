/**
 * Formats a minified-production React error message.
 *
 * Do not require this module directly. Use normal `invariant()` calls with
 * plain string messages instead — the error-code replacement that upstream
 * performs during its build step is not needed in the Roblox runtime.
 *
 * @module formatProdErrorMessage
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

const HttpService = game.GetService('HttpService');

/**
 * Builds a "Minified React error" message with a link to the error decoder.
 *
 * @param code - The numeric invariant code.
 * @param args - URL-encoded diagnostic arguments.
 * @returns The formatted error message.
 * @internal
 */
export default function formatProdErrorMessage(code: number, ...args: Array<unknown>): string {
	let url = `https://reactjs.org/docs/error-decoder.html?invariant=${tostring(code)}`;
	for (const arg of args) {
		url += `&args[]=${HttpService.UrlEncode(tostring(arg))}`;
	}
	return (
		`Minified React error #${code}; visit ${url} for the full message or ` +
		'use the non-minified dev environment for full errors and additional ' +
		'helpful warnings.'
	);
}
