/**
 * Decides whether an uncaught render error should be surfaced to the user
 * through a platform error dialog. This environment simply returns `true`,
 * which routes errors to the usual console/telemetry path.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberErrorDialog.lua`.
 *
 * @module ReactFiberErrorDialog
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

/**
 * Returns `true` to allow the default error-reporting behaviour.
 *
 * @param boundary - The error boundary fiber (unused).
 * @param errorInfo - Captured error info (unused).
 * @returns `true`.
 * @internal
 */
export function showErrorDialog(_boundary: unknown, _errorInfo: unknown): boolean {
	return true;
}

export default {
	showErrorDialog,
};
