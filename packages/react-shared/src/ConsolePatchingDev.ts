/**
 * Helpers to suppress console logging during side-effect-free replay.
 *
 * @module ConsolePatchingDev
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { consoleTable } from './console';

let disabledDepth = 0;
let prevLog: (...args: Array<unknown>) => void;
let prevInfo: (...args: Array<unknown>) => void;
let prevWarn: (...args: Array<unknown>) => void;
let prevError: (...args: Array<unknown>) => void;
let prevGroup: (...args: Array<unknown>) => void;
let prevGroupCollapsed: (...args: Array<unknown>) => void;
let prevGroupEnd: () => void;

/**
 * The no-op function used to replace each console method while logs are
 * disabled.
 *
 * @internal
 */
export const disabledLog = () => {};

/**
 * Suppresses all console output. Nested calls are tracked by depth.
 *
 * @internal
 */
export function disableLogs(): void {
	if (!__DEV__) {
		return;
	}

	if (disabledDepth === 0) {
		prevLog = consoleTable.log;
		prevInfo = consoleTable.info;
		prevWarn = consoleTable.warn;
		prevError = consoleTable.error;
		prevGroup = consoleTable.group;
		prevGroupCollapsed = consoleTable.groupCollapsed;
		prevGroupEnd = consoleTable.groupEnd;

		consoleTable.info = disabledLog;
		consoleTable.log = disabledLog;
		consoleTable.warn = disabledLog;
		consoleTable.error = disabledLog;
		consoleTable.group = disabledLog;
		consoleTable.groupCollapsed = disabledLog;
		consoleTable.groupEnd = disabledLog;
	}

	disabledDepth += 1;
}

/**
 * Restores console output suppressed by {@link disableLogs}.
 *
 * @internal
 */
export function reenableLogs(): void {
	if (!__DEV__) {
		return;
	}

	disabledDepth -= 1;

	if (disabledDepth === 0) {
		consoleTable.log = prevLog;
		consoleTable.info = prevInfo;
		consoleTable.warn = prevWarn;
		consoleTable.error = prevError;
		consoleTable.group = prevGroup;
		consoleTable.groupCollapsed = prevGroupCollapsed;
		consoleTable.groupEnd = prevGroupEnd;
	}

	if (disabledDepth < 0) {
		consoleTable.error('disabledDepth fell below zero. This is a bug in React. Please file an issue.');
	}
}
