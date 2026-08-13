/**
 * `React.Children` — helpers for traversing opaque children collections.
 *
 * Children can be a single element, an array, or a nested structure produced by
 * components rendering fragments. These helpers flatten that structure without
 * treating component instances as arrays themselves.
 *
 * @module ReactChildren
 * @packageDocumentation
 */

import { invariant, ReactSymbols } from '@nrbx/react-shared';
import { cloneAndReplaceKey, isValidElement } from './ReactElement';

const { getIteratorFn } = ReactSymbols;
const REACT_ELEMENT_TYPE = ReactSymbols.REACT_ELEMENT_TYPE;
const REACT_PORTAL_TYPE = ReactSymbols.REACT_PORTAL_TYPE;

const SEPARATOR = '.';
const SUBSEPARATOR = ':';

/** A table whose first `next()` key is nil or numeric is an array. */
function isArray(object: Record<string, unknown>): boolean {
	const [firstKey] = next(object, undefined);
	return firstKey === undefined || type(firstKey) !== 'string';
}

/**
 * Escape a key so it can be safely used inside a path string.
 *
 * @param key - The key to escape.
 */
function escape(key: string): string {
	let escapedString = string.gsub(key, '=', '=0')[0];
	escapedString = string.gsub(escapedString, ':', '=2')[0];
	return `$${escapedString}`;
}

/**
 * Keys from user-provided elements keep their original value (no regex-based
 * escaping exists in Luau).
 */
function escapeUserProvidedKey(text: string): string {
	return text;
}

/**
 * Generate a key string that identifies an element within a set.
 *
 * @param element - An element that could contain a manual key.
 * @param index - Index used if a manual key is not provided.
 */
function getElementKey(element: Record<string, unknown>, index: number): string {
	if (type(element) === 'table' && element !== undefined && element.key !== undefined) {
		// Explicit key.
		return escape(tostring(element.key));
	}
	// Implicit key determined by the index in the set.
	return tostring(index);
}

type MapFunc = (child: unknown, index?: number) => unknown;

/**
 * Recursively flattens children into `array`, invoking `callback` for each leaf
 * child.
 */
function mapIntoArray(
	children: unknown,
	array: Array<defined>,
	escapedPrefix: string,
	nameSoFar: string,
	callback: MapFunc | undefined
): number {
	let childrenType = type(children);

	// userdata corresponds to React.None, which is perceived as nil. All
	// userdata is treated as nil when passed as a child.
	if (childrenType === 'nil' || childrenType === 'boolean' || childrenType === 'userdata') {
		children = undefined;
		childrenType = 'nil';
	}

	let invokeCallback = false;

	if (children === undefined) {
		invokeCallback = true;
	} else {
		if (childrenType === 'string' || childrenType === 'number') {
			invokeCallback = true;
		} else if (childrenType === 'table') {
			const childrenTypeof = (children as Record<string, unknown>).$$typeof;
			if (childrenTypeof === REACT_ELEMENT_TYPE || childrenTypeof === REACT_PORTAL_TYPE) {
				invokeCallback = true;
			}
		}
	}

	if (invokeCallback) {
		const child = children;
		let mappedChild: unknown = child;
		if (callback !== undefined) {
			mappedChild = callback(child);
		}

		// If it's the only child, treat the name as if it was wrapped in an array
		// so that it's consistent if the number of children grows.
		const childKey = nameSoFar === '' ? SEPARATOR + getElementKey(child as Record<string, unknown>, 1) : nameSoFar;

		if (mappedChild !== undefined && isArray(mappedChild as Record<string, unknown>)) {
			const escapedChildKey = `${escapeUserProvidedKey(childKey)}/`;
			mapIntoArray(mappedChild, array, escapedChildKey, '', (c: unknown) => c);
		} else if (mappedChild !== undefined) {
			if (isValidElement(mappedChild)) {
				const mappedElement = mappedChild as Record<string, unknown>;
				const mappedChildKey = mappedElement.key as string | number | undefined;
				const originalChild = child as Record<string, unknown> | undefined;
				mappedChild = cloneAndReplaceKey(
					mappedElement as never,
					// Keep both the (mapped) and old keys if they differ, just as
					// traverseAllChildren used to do for objects as children.
					escapedPrefix +
						(mappedChildKey !== undefined &&
						(originalChild === undefined || originalChild.key !== mappedChildKey)
							? `${escapeUserProvidedKey(tostring(mappedChildKey))}/`
							: '') +
						childKey
				);
			}
			array.push(mappedChild as defined);
		}
		return 1;
	}

	let child: unknown;
	let nextName: string;
	let subtreeCount = 0;
	const nextNamePrefix = nameSoFar === '' ? SEPARATOR : nameSoFar + SUBSEPARATOR;

	if (childrenType === 'table' && isArray(children as Record<string, unknown>)) {
		const childrenArray = children as Array<defined>;
		const count = childrenArray.size();
		for (let i = 1; i <= count; i++) {
			child = (children as unknown as Record<number, unknown>)[i];
			nextName = nextNamePrefix + getElementKey(child as Record<string, unknown>, i);
			subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
		}
	} else {
		const iteratorFn = getIteratorFn(children as Record<string, unknown>);
		if (iteratorFn !== undefined) {
			const iterator = iteratorFn(children);
			let step = iterator.next();
			let ii = 1;
			while (!step.done) {
				child = step.value;
				nextName = nextNamePrefix + getElementKey(child as Record<string, unknown>, ii);
				ii += 1;
				subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
				step = iterator.next();
			}
		}
	}

	return subtreeCount;
}

/**
 * Maps children that are typically specified as `props.children`.
 *
 * @param children - Children tree container.
 * @param func - The map function.
 */
function mapChildren<T>(children: unknown, func: MapFunc): Array<T> | undefined {
	if (children === undefined) {
		return undefined;
	}
	const result: Array<defined> = [];
	let count = 1;
	mapIntoArray(children, result, '', '', (child: unknown) => {
		const mapFuncResult = func(child, count);
		count += 1;
		return mapFuncResult;
	});
	return result as Array<T>;
}

/**
 * Count the number of children.
 */
function countChildren(children: unknown): number {
	let n = 0;
	mapChildren(children, () => {
		n += 1;
	});
	return n;
}

/**
 * Iterates through children without building an array.
 */
function forEachChildren(children: unknown, forEachFunc: MapFunc): void {
	mapChildren(children, (child, index) => {
		forEachFunc(child, index);
	});
}

/**
 * Flattens a children collection into a re-keyed array.
 */
function toArray(children: unknown): Array<defined> {
	return (mapChildren(children, (child: unknown) => child) as Array<defined>) ?? [];
}

/**
 * Returns the first child in a collection of children and verifies that there
 * is only one child in the collection.
 *
 * @param children - Child collection structure.
 */
function onlyChild(children: unknown): unknown {
	invariant(isValidElement(children), 'React.Children.only expected to receive a single React element child.');
	return children;
}

const Children = {
	map: mapChildren,
	forEach: forEachChildren,
	count: countChildren,
	only: onlyChild,
	toArray: toArray,
};

export default Children;
export { mapChildren, forEachChildren, countChildren, onlyChild, toArray };
