/**
 * Performs shallow equality by iterating through keys on both objects and
 * returning `false` as soon as any key has values which are not strictly
 * equal. Returns `true` when the values of all keys are strictly equal.
 *
 * @module shallowEqual
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import is from './objectIs';

/**
 * Compares two values for shallow equality.
 *
 * @param objA - First object.
 * @param objB - Second object.
 * @returns `true` when the objects are shallowly equal.
 * @internal
 */
export default function shallowEqual(objA: defined, objB: defined): boolean {
	if (is(objA, objB)) {
		return true;
	}

	if (typeOf(objA) !== 'table' || objA === undefined || typeOf(objB) !== 'table' || objB === undefined) {
		return false;
	}

	const tableA = objA as Record<string, defined>;
	const tableB = objB as Record<string, defined>;

	for (const [key, value] of pairs(tableA)) {
		if (!is(tableB[key], value)) {
			return false;
		}
	}

	for (const [key, value] of pairs(tableB)) {
		if (!is(tableA[key], value)) {
			return false;
		}
	}

	return true;
}
