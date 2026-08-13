/**
 * A minimal stack implementation used by the reconciler's context cursors.
 *
 * Cursors hold a single `current` value; pushing snapshots the previous value
 * onto parallel value/fiber stacks, and popping restores it. The fiber stack
 * exists only in `__DEV__` and is used to catch mismatched push/pop calls.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberStack.new.lua`.
 *
 * @module ReactFiberStack
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { console } from '@nrbx/react-shared';
import type { Fiber } from './types';

/** A cursor wrapping a single mutable value. */
export type StackCursor<T> = { current: T };

const valueStack: Array<unknown> = [];
const fiberStack: Array<Fiber | undefined> = [];

// Sentinel used when the snapshot value is nil (arrays can't store nil).
const NULL: object = {};

let index = 0;

/**
 * Creates a new cursor initialized to `defaultValue`.
 *
 * @param defaultValue - The initial cursor value.
 * @returns The new cursor.
 * @internal
 */
export function createCursor<T>(defaultValue: T): StackCursor<T> {
	return {
		current: defaultValue,
	};
}

/**
 * Returns whether the stack is empty.
 *
 * @returns `true` when nothing has been pushed.
 * @internal
 */
export function isEmpty(): boolean {
	return index === 0;
}

/**
 * Pops the most recently pushed value off the stack, restoring it onto
 * `cursor.current`.
 *
 * @param cursor - The cursor to restore.
 * @param fiber - The fiber that pushed the value (DEV bookkeeping only).
 * @internal
 */
export function pop<T>(cursor: StackCursor<T>, fiber: Fiber): void {
	if (index < 1) {
		if (__DEV__) {
			console.error('Unexpected pop.');
		}
		return;
	}

	if (__DEV__) {
		if (fiber !== fiberStack[index]) {
			console.error('Unexpected Fiber popped.');
		}
	}

	const value = valueStack[index];
	if (value === NULL) {
		cursor.current = undefined as T;
	} else {
		cursor.current = value as T;
	}

	valueStack[index] = undefined;

	if (__DEV__) {
		fiberStack[index] = undefined;
	}

	index -= 1;
}

/**
 * Snapsots `cursor.current` onto the stack and sets the cursor to `value`.
 *
 * @param cursor - The cursor to update.
 * @param value - The new cursor value.
 * @param fiber - The fiber the value belongs to (DEV bookkeeping only).
 * @internal
 */
export function push<T>(cursor: StackCursor<T>, value: T, fiber: Fiber): void {
	index += 1;

	const stackValue = cursor.current;
	if (stackValue === undefined) {
		valueStack[index] = NULL;
	} else {
		valueStack[index] = stackValue;
	}

	if (__DEV__) {
		fiberStack[index] = fiber;
	}

	cursor.current = value;
}

/**
 * Asserts (in DEV only) that the stack is empty.
 *
 * @internal
 */
export function checkThatStackIsEmpty(): void {
	if (__DEV__) {
		if (index !== 0) {
			console.error('Expected an empty stack. Something was not reset properly.');
		}
	}
}

/**
 * Resets the stack to empty after a fatal error (DEV only).
 *
 * @internal
 */
export function resetStackAfterFatalErrorInDev(): void {
	if (__DEV__) {
		index = 0;
		table.clear(valueStack);
		table.clear(fiberStack);
	}
}

export default {
	createCursor,
	isEmpty,
	pop,
	push,
	checkThatStackIsEmpty,
	resetStackAfterFatalErrorInDev,
};
