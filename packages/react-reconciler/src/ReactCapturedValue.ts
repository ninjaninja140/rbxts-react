/**
 * Captures a thrown value together with the fiber that was being worked on
 * when it was thrown, plus a dev/prod component stack.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactCapturedValue.lua`.
 *
 * @module ReactCapturedValue
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import type { Fiber } from './types';
import { getStackByFiberInDevAndProd } from './ReactFiberComponentStack';

export type CapturedValue<T> = {
	value: T;
	source: Fiber | undefined;
	stack: string | undefined;
};

/**
 * Captures a value (typically an error) thrown during rendering, recording
 * the source fiber and a component stack.
 *
 * @param value - The thrown value.
 * @param source - The fiber being worked on when the value was thrown.
 * @returns A captured-value record.
 * @internal
 */
export function createCapturedValue<T>(value: T, source: Fiber | undefined): CapturedValue<T> {
	// If the value is an error, call this immediately after it is thrown so the
	// stack is accurate.
	return {
		value,
		source,
		stack: getStackByFiberInDevAndProd(source),
	};
}

export default {
	createCapturedValue,
};
