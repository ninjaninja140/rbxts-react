/**
 * The production guarded-callback implementation.
 *
 * @module invokeGuardedCallbackImpl
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __YOLO__ } from '@nrbx/react-globals';
import { describeError } from './ErrorHandling';

interface Reporter {
	onError: (err: unknown) => void;
}

function invokeGuardedCallbackProd(
	reporter: Reporter,
	_name: string | undefined,
	func: (...args: Array<unknown>) => unknown,
	context: unknown,
	...args: Array<unknown>
): void {
	if (!__YOLO__) {
		// In Lua, methods that use `self` explicitly accept it as the first
		// argument, so a nil context must not be forwarded.
		const [ok, result] =
			context === undefined
				? xpcall(func, describeError, ...args)
				: xpcall(func, describeError, context, ...args);

		if (!ok) {
			reporter.onError(result);
		}
	} else {
		// `__YOLO__` disables pcall entirely for maximum performance.
		if (context === undefined) {
			func(...args);
		} else {
			func(context, ...args);
		}
	}
}

export default invokeGuardedCallbackProd as (...args: Array<any>) => void;
