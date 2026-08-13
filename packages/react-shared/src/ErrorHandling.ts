/**
 * Error-stack-preserving utilities.
 *
 * React catches, retries, and rethrows errors frequently; without help this
 * loses meaningful stack information. These helpers use `xpcall` and the
 * `debug` library to retain as much of the original stack as possible.
 *
 * @module ErrorHandling
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';

/** Divider inserted between error parts so they can be split apart later. */
export const __ERROR_DIVIDER = '\n------ Error caught by React ------\n';

/**
 * Roblox has no native `Error` constructor, so React models errors as plain
 * tables carrying a message and an optional stack string.
 */
export interface ReactError {
	message: string;
	stack: string | undefined;
}

// Package names that are likely to appear in a React stack frame.
const REACT_PACKAGE_NAMES = [
	'React',
	'ReactDevtoolsShared',
	'ReactNoopRenderer',
	'ReactReconciler',
	'ReactRefresh',
	'ReactRoblox',
	'RoactCompat',
	'Scheduler',
	'Shared',
];

let reactPackagePrefixes: Array<string> | undefined;

function getReactPackagePrefixes(): Array<string> {
	if (reactPackagePrefixes !== undefined) {
		return reactPackagePrefixes;
	}

	const prefixes: Array<string> = [];
	const packages = script.Parent?.Parent;
	for (const packageName of REACT_PACKAGE_NAMES) {
		const pkg = packages?.FindFirstChild(packageName);
		if (pkg !== undefined) {
			const packagePath = pkg.GetFullName().gsub('^game%.', '')[0];
			prefixes.push(packagePath);
		}
	}

	reactPackagePrefixes = prefixes;
	return prefixes;
}

function isInternalFrame(source: string): boolean {
	const prefixes = getReactPackagePrefixes();
	for (const prefix of prefixes) {
		if (string.sub(source, 1, prefix.size()) === prefix) {
			return true;
		}
	}
	return false;
}

/**
 * Builds a stack string starting at the given call-stack level, skipping
 * internal React frames. Mirrors the format of `debug.traceback()`.
 *
 * @internal
 */
function buildStackString(level: number): string {
	let stack = '';

	let handledFirstSource = false;
	let shouldFilter = false;

	for (let i = level + 1; i < math.huge; i++) {
		const [source, line, fnName] = debug.info(i, 'sln');
		if (source === undefined) {
			break;
		}

		if (source === '[C]') {
			continue;
		}

		if (!handledFirstSource) {
			shouldFilter = !isInternalFrame(source);
			handledFirstSource = true;
		}

		if (shouldFilter && isInternalFrame(source)) {
			continue;
		}

		stack += `${source}:${line} function ${fnName ?? '?'}\n`;
	}

	return string.gsub(stack, '\n$', '')[0];
}

/**
 * Converts a caught value into a {@link ReactError} with a usable stack.
 *
 * @param e - The caught value.
 * @returns An error object.
 * @internal
 */
export function describeError(e: unknown): ReactError {
	if (typeOf(e) === 'string') {
		const str = e as string;
		const [_, endOfStackFrame] = string.find(str, ':[%d]+: ');
		const message = endOfStackFrame !== undefined ? string.sub(str, endOfStackFrame + 1) : str;

		const err: ReactError = {
			message,
			stack: __DEV__ ? buildStackString(2) : debug.traceback(undefined, 2),
		};
		return err;
	}
	return e as ReactError;
}

/**
 * Turns an arbitrary caught value into a detailed string message so nothing is
 * lost when rethrown as a string (the only format the top-level
 * `ScriptContext.ErrorDetailed` signal supports).
 *
 * @internal
 */
export function errorToString(error_: unknown): string {
	if (typeOf(error_) === 'table') {
		const err = error_ as { message?: defined; stack?: string };
		if (err.message !== undefined && err.stack !== undefined) {
			return __ERROR_DIVIDER + tostring(err.message) + __ERROR_DIVIDER + tostring(err.stack);
		}
	}
	return tostring(error_);
}

/**
 * Reverses {@link errorToString}, recovering the original error and rethrow
 * marker.
 *
 * @internal
 */
export function parseReactError(errorString: string): LuaTuple<[ReactError, string]> {
	const split = string.split(errorString, __ERROR_DIVIDER);

	if (split.size() === 3) {
		const rethrow = split[0];
		const message = split[1];
		const stack = split[2];

		const newError: ReactError = { message, stack };

		return $tuple(newError, rethrow);
	} else {
		const newError: ReactError = { message: errorString, stack: undefined };

		return $tuple(newError, '');
	}
}
