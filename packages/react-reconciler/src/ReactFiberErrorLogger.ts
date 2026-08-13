/**
 * Logs errors caught by error boundaries, composing a readable message from
 * the component name and component stack in development, or the raw error in
 * production. Never throws: if logging itself fails, the failure is deferred
 * to a later tick so reconciler state is not corrupted.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberErrorLogger.lua`.
 *
 * @module ReactFiberErrorLogger
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { console, errorToString, getComponentName } from '@nrbx/react-shared';
import type { CapturedValue } from './ReactCapturedValue';
import { showErrorDialog } from './ReactFiberErrorDialog';
import { ClassComponent } from './ReactWorkTags';
import type { Fiber } from './types';

/**
 * Produces a readable, one-line representation of `value`. Prefers
 * `HttpService:JSONEncode` and falls back to a shallow key/value dump.
 *
 * @param value - The value to stringify.
 * @returns A human-readable string.
 * @internal
 */
function inspect(value: unknown): string {
	if (type(value) !== 'table') {
		return tostring(value);
	}
	const [ok, encoded] = pcall(() => game.GetService('HttpService').JSONEncode(value));
	if (ok) {
		return encoded;
	}
	const parts: string[] = [];
	for (const [key, v] of pairs(value as object)) {
		parts.push(`${tostring(key)} = ${tostring(v)}`);
	}
	return `{${parts.join(', ')}}`;
}

/**
 * Logs a captured error against its boundary, or falls back to a deferred
 * `error()` if logging itself throws.
 *
 * @param boundary - The error boundary fiber that caught the error.
 * @param errorInfo - The captured error details.
 * @internal
 */
export function logCapturedError(boundary: Fiber, errorInfo: CapturedValue<unknown>): void {
	const [ok, e] = pcall(() => {
		const logError = showErrorDialog(boundary, errorInfo);

		// Allow injected showErrorDialog() to prevent default console.error
		// logging. This enables renderers to better manage their own error
		// surfaces.
		if (logError === false) {
			return;
		}

		const error_ = errorInfo.value;
		if (__DEV__) {
			const source = errorInfo.source;
			const stack = errorInfo.stack;
			const componentStack = stack ?? '';
			// Browsers support silencing uncaught errors by calling
			// `preventDefault()` in a window `error` handler. We record this
			// information as an expando on the error.
			if (error_ !== undefined && (error_ as { _suppressLogging?: boolean })._suppressLogging) {
				if (boundary.tag === ClassComponent) {
					// The error is recoverable and was silenced. Ignore it and
					// don't print the stack addendum.
					return;
				}
				// The error is fatal. Since the silencing might have been
				// accidental, surface the error first, then the addendum.
				console.error(error_);
			}

			const componentName = source !== undefined ? getComponentName(source.type) : undefined;

			const componentNameMessage = componentName
				? `The above error occurred in the <${tostring(componentName)}> component:`
				: 'The above error occurred in one of your React components:';

			const errorBoundaryName = getComponentName(boundary.type);
			const errorBoundaryMessage = errorBoundaryName
				? `React will try to recreate this component tree from scratch ` +
					`using the error boundary you provided, ${errorBoundaryName}.`
				: 'Consider adding an error boundary to your tree to customize error handling behavior.\n' +
					'Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.';

			const combinedMessage = `${componentNameMessage}\n${componentStack}\n\n${errorBoundaryMessage}`;

			// In development, we provide our own message with just the
			// component stack; the original error was already printed.
			console.error(combinedMessage);
		} else {
			// In production, print the error object directly so the platform
			// can display it natively.
			console.error(inspect(error_));
		}
	});

	if (!ok) {
		warn(`failed to error with error: ${inspect(e)}`);
		// This method must not throw, or React internal state will get messed
		// up. If console.error is overridden, or logCapturedError() shows a
		// dialog that throws, report this error outside the normal stack as a
		// last resort.
		task.spawn(() => {
			error(errorToString(e as any));
		});
	}
}

export default {
	logCapturedError,
};
