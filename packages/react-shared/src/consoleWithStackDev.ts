/**
 * Stack-aware `console.warn`/`console.error` used in dev builds.
 *
 * @module consoleWithStackDev
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import ReactSharedInternals from './ReactSharedInternals';

function printWarning(_level: 'warn' | 'error', format: string, args: Array<unknown>): void {
	if (!__DEV__) {
		return;
	}

	const ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;
	const stack =
		ReactDebugCurrentFrame.getStackAddendum !== undefined ? ReactDebugCurrentFrame.getStackAddendum() : '';

	let formatWithStack = format;
	let fullArgs: Array<defined> = args as Array<defined>;
	if (stack !== '') {
		formatWithStack += '%s';
		fullArgs = [...args] as Array<defined>;
		fullArgs.push(stack);
	}

	const argsWithFormat = fullArgs.map(tostring);
	argsWithFormat.unshift(`Warning: ${formatWithStack}`);

	// Luau has no red console output, so both levels go through the global
	// `warn` (yellow output). The module's own exported `warn` is shadowed, so
	// the global is reached through `_G`.
	const globalWarn = (_G as unknown as { warn: (...params: Array<unknown>) => void }).warn;
	globalWarn(...argsWithFormat);
}

/**
 * Logs a warning with the current component stack addendum.
 *
 * @internal
 */
export function warnWithStack(format: string, ...args: Array<unknown>): void {
	if (__DEV__) {
		printWarning('warn', format, args);
	}
}

/**
 * Logs an error with the current component stack addendum.
 *
 * @internal
 */
export function errorWithStack(format: string, ...args: Array<unknown>): void {
	if (__DEV__) {
		printWarning('error', format, args);
	}
}
