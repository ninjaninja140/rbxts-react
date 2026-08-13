/**
 * Guarded-callback machinery used by the fiber to simulate try/catch.
 *
 * @module ReactErrorUtils
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import invariant from './invariant';
import invokeGuardedCallbackImpl from './invokeGuardedCallbackImpl';

let hasError = false;
let caughtError: unknown;

let hasRethrowError = false;
let rethrowError: unknown;

const reporter = {
	onError: (err: unknown) => {
		hasError = true;
		caughtError = err;
	},
};

/**
 * Calls `func` while guarding against errors thrown within it.
 *
 * @param name - Name of the guard, used for logging/debugging.
 * @param func - The function to invoke.
 * @param context - The `self` to use when calling the function.
 * @param args - Arguments to forward to `func`.
 * @internal
 */
export function invokeGuardedCallback(
	name: string | undefined,
	func: (...args: Array<any>) => any,
	context: unknown,
	...args: Array<unknown>
): void {
	hasError = false;
	caughtError = undefined;
	invokeGuardedCallbackImpl(reporter, name, func, context, ...args);
}

/**
 * Same as {@link invokeGuardedCallback}, but stores the first error globally so
 * it can be rethrown later with {@link rethrowCaughtError}.
 *
 * @internal
 */
export function invokeGuardedCallbackAndCatchFirstError(
	name: string | undefined,
	func: (...args: Array<any>) => any,
	context: unknown,
	...args: Array<unknown>
): void {
	invokeGuardedCallback(name, func, context, ...args);

	if (hasError) {
		const err = clearCaughtError();

		if (!hasRethrowError) {
			hasRethrowError = true;
			rethrowError = err;
		}
	}
}

/**
 * Rethrows the first error captured by
 * {@link invokeGuardedCallbackAndCatchFirstError}.
 *
 * @internal
 */
export function rethrowCaughtError(): void {
	if (hasRethrowError) {
		const err = rethrowError;
		hasRethrowError = false;
		rethrowError = undefined;
		error(err);
	}
}

/**
 * Returns whether a guarded callback threw.
 *
 * @internal
 */
export function hasCaughtError(): boolean {
	return hasError;
}

/**
 * Clears the caught error and returns it.
 *
 * @internal
 */
export function clearCaughtError(): unknown {
	if (hasError) {
		const err = caughtError;
		hasError = false;
		caughtError = undefined;
		return err;
	}

	invariant(
		false,
		'clearCaughtError was called but no error was captured. This error ' +
			'is likely caused by a bug in React. Please file an issue.'
	);
	return undefined;
}
