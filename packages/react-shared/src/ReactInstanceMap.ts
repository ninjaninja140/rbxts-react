/**
 * Maintains the mapping between public stateful instances and their internal
 * fiber representation.
 *
 * `ReactInstanceMap` lets public APIs (such as `React.Component`) accept a
 * user-facing instance and resolve it back to the internal fiber. The module
 * is intentionally stateless; the mapping lives on the instance itself under
 * the `_reactInternals` field.
 *
 * @module ReactInstanceMap
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import getComponentName from './getComponentName';

interface Fiber {
	tag?: unknown;
	subtreeFlags?: unknown;
	lanes?: unknown;
	childLanes?: unknown;
	alternate?: Fiber;
	return_?: Fiber;
}

function isValidFiber(fiber: unknown): fiber is Fiber {
	if (type(fiber) !== 'table') {
		return false;
	}
	const f = fiber as Fiber;
	return f.tag !== undefined && f.subtreeFlags !== undefined && f.lanes !== undefined && f.childLanes !== undefined;
}

function inspect(value: unknown): string {
	const httpService = game.GetService('HttpService');
	const [ok, result] = pcall(() => httpService.JSONEncode(value));
	if (ok) {
		return result as string;
	}
	return tostring(value);
}

/** Removes the instance-to-fiber mapping from `key`. */
function remove(key: Record<string, unknown>): void {
	key._reactInternals = undefined;
}

/** Resolves the fiber for a public instance, validating its shape. */
function get(key: Record<string, unknown>): Fiber {
	const value = key._reactInternals as Fiber;
	if (!isValidFiber(value)) {
		error(
			'invalid fiber in ' +
				(getComponentName(key) ?? 'UNNAMED Component') +
				' during get from ReactInstanceMap! ' +
				inspect(value)
		);
	} else if (value.alternate !== undefined && !isValidFiber(value.alternate)) {
		error(
			'invalid alternate fiber (' +
				(getComponentName(value.alternate as unknown as Record<string, unknown>) ?? 'UNNAMED alternate') +
				') in ' +
				(getComponentName(key) ?? 'UNNAMED Component') +
				' during get from ReactInstanceMap! ' +
				inspect(value.alternate)
		);
	}
	return value;
}

/** Returns whether `key` has an associated fiber. */
function has(key: Record<string, unknown>): boolean {
	return key._reactInternals !== undefined;
}

/** Sets the fiber for a public instance, validating the whole fiber chain. */
function set(key: Record<string, unknown>, value: Fiber): void {
	let parent: Fiber | undefined = value;
	let message: string;

	while (parent !== undefined) {
		if (!isValidFiber(parent)) {
			message =
				'invalid fiber in ' +
				(getComponentName(key) ?? 'UNNAMED Component') +
				' being set in ReactInstanceMap! ' +
				inspect(parent) +
				'\n';
			if (value !== parent) {
				message += ` (from original fiber ${getComponentName(key) ?? 'UNNAMED Component'})`;
			}
			error(message);
		} else if (parent.alternate !== undefined && !isValidFiber(parent.alternate)) {
			message =
				'invalid alternate fiber (' +
				(getComponentName(parent.alternate as unknown as Record<string, unknown>) ?? 'UNNAMED alternate') +
				') in ' +
				(getComponentName(key) ?? 'UNNAMED Component') +
				' being set in ReactInstanceMap! ' +
				inspect(parent.alternate) +
				'\n';
			if (value !== parent) {
				message += ` (from original fiber ${getComponentName(key) ?? 'UNNAMED Component'})`;
			}
			error(message);
		}
		parent = parent.return_;
	}

	key._reactInternals = value;
}

const ReactInstanceMap = { remove, get, has, set };

export { remove, get, has, set };
export default ReactInstanceMap;
