/**
 * Console wrapper that swaps in stack-aware warnings in dev builds.
 *
 * Roblox has no global `console` object, so the base implementation maps onto
 * the `print` and `warn` globals. Dev builds layer stack-aware `warn`/`error`
 * on top of it.
 *
 * @module console
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { errorWithStack, warnWithStack } from './consoleWithStackDev';

/**
 * The subset of the console API that React uses internally. Kept as a mutable
 * table so {@link ConsolePatchingDev} can swap out the functions during
 * side-effect-free replay.
 */
export interface ReactConsole {
	log: (...args: Array<unknown>) => void;
	info: (...args: Array<unknown>) => void;
	warn: (...args: Array<unknown>) => void;
	error: (...args: Array<unknown>) => void;
	group: (...args: Array<unknown>) => void;
	groupCollapsed: (...args: Array<unknown>) => void;
	groupEnd: () => void;
}

// Roblox only exposes `print` (white) and `warn` (yellow) as console
// primitives; `error` maps onto `warn` because Luau has no red console output.
const baseConsole: ReactConsole = {
	log: (...args) => print(...args),
	info: (...args) => print(...args),
	warn: (...args) => warn(...args),
	error: (...args) => warn(...args),
	group: (...args) => print(...args),
	groupCollapsed: (...args) => print(...args),
	groupEnd: () => {},
};

// In dev builds, `warn` and `error` are swapped for stack-aware versions while
// every other method falls through to the base console via __index.
const devConsole = setmetatable(
	{
		warn: warnWithStack,
		error: errorWithStack,
	} as Partial<ReactConsole>,
	{ __index: baseConsole } as never
) as ReactConsole;

const consoleTable: ReactConsole = __DEV__ ? devConsole : baseConsole;

export { consoleTable };
export default consoleTable;
