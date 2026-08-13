/**
 * Debug tracing helpers for the reconciler.
 *
 * Ported from `react-lua/modules/react-reconciler/src/DebugTracing.lua`.
 *
 * When `enableDebugTracing` is on, these helpers group related console output
 * (renders, layout effects, state updates) so the work loop's activity is
 * easier to follow. Everything is a no-op in production builds and whenever
 * the flag is disabled.
 *
 * @module DebugTracing
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { console, ReactFeatureFlags } from '@nrbx/react-shared';
import type { Lane, Lanes, Wakeable } from './types';

const { enableDebugTracing } = ReactFeatureFlags;

/**
 * The console surface this module patches while a trace group is open.
 * @internal
 */
interface TraceConsole {
	log: (...args: Array<unknown>) => void;
	group: (...args: Array<unknown>) => void;
	groupEnd: () => void;
}

/**
 * `Wakeable` declares `andThen` with a `self` parameter; this self-less alias
 * is what the reconciler actually calls.
 */
type WakeableWithThen = Wakeable & {
	andThen: (onFulfilled: () => void, onRejected: () => void) => void;
};

const nativeConsole = console as TraceConsole;
let nativeConsoleLog: ((...args: Array<unknown>) => void) | undefined;

const pendingGroupArgs: Array<defined> = [];
// Luau arrays are 1-based; printedGroupIndex counts how many groups have been
// pushed out to the console so far.
let printedGroupIndex = 0;

/**
 * Converts a non-negative integer to a 32-bit binary string, e.g. `5` →
 * `"00000000000000000000000000000101"`. Luau has no built-in radix
 * conversion, so the binary digits are built up by repeated division.
 */
function decimalToBinaryString(decimal: number): string {
	let result = '';
	let value = decimal;
	do {
		const [int, frac] = math.modf(value / 2);
		value = int;
		result = tostring(math.ceil(frac)) + result;
	} while (value !== 0);

	const leadingZeroes = 31 - result.size();
	return string.rep('0', leadingZeroes) + result;
}

function formatLanes(laneOrLanes: Lane | Lanes): string {
	return `0b${decimalToBinaryString(laneOrLanes)}`;
}

function group(...args: Array<defined>): void {
	for (const groupArg of args) {
		pendingGroupArgs.push(groupArg);
	}
	if (nativeConsoleLog === undefined) {
		nativeConsoleLog = nativeConsole.log;
		nativeConsole.log = log;
	}
}

function groupEnd(): void {
	pendingGroupArgs.shift();
	while (printedGroupIndex > pendingGroupArgs.size()) {
		nativeConsole.groupEnd();
		printedGroupIndex -= 1;
	}
	if (pendingGroupArgs.size() === 0) {
		nativeConsole.log = nativeConsoleLog as TraceConsole['log'];
		nativeConsoleLog = undefined;
	}
}

function log(...args: Array<unknown>): void {
	if (printedGroupIndex < pendingGroupArgs.size()) {
		for (let i = printedGroupIndex + 1; i <= pendingGroupArgs.size(); i++) {
			nativeConsole.group(pendingGroupArgs[i - 1]);
		}
		printedGroupIndex = pendingGroupArgs.size();
	}
	if (nativeConsoleLog !== undefined) {
		nativeConsoleLog(...args);
	} else {
		nativeConsole.log(...args);
	}
}

export function logCommitStarted(lanes: Lanes): void {
	if (__DEV__ && enableDebugTracing) {
		group(`* commit (${formatLanes(lanes)})`);
	}
}

export function logCommitStopped(): void {
	if (__DEV__ && enableDebugTracing) {
		groupEnd();
	}
}

export function logComponentSuspended(componentName: string, wakeable: Wakeable): void {
	if (__DEV__ && enableDebugTracing) {
		log(`* ${componentName} suspended`);
		const wakeableWithThen = wakeable as WakeableWithThen;
		wakeableWithThen.andThen(
			() => {
				log(`* ${componentName} resolved`);
			},
			() => {
				log(`* ${componentName} rejected`);
			}
		);
	}
}

export function logLayoutEffectsStarted(lanes: Lanes): void {
	if (__DEV__ && enableDebugTracing) {
		group(`* layout effects (${formatLanes(lanes)})`);
	}
}

export function logLayoutEffectsStopped(): void {
	if (__DEV__ && enableDebugTracing) {
		groupEnd();
	}
}

export function logPassiveEffectsStarted(lanes: Lanes): void {
	if (__DEV__ && enableDebugTracing) {
		group(`* passive effects (${formatLanes(lanes)})`);
	}
}

export function logPassiveEffectsStopped(): void {
	if (__DEV__ && enableDebugTracing) {
		groupEnd();
	}
}

export function logRenderStarted(lanes: Lanes): void {
	if (__DEV__ && enableDebugTracing) {
		group(`* render (${formatLanes(lanes)})`);
	}
}

export function logRenderStopped(): void {
	if (__DEV__ && enableDebugTracing) {
		groupEnd();
	}
}

export function logForceUpdateScheduled(componentName: string, lane: Lane): void {
	if (__DEV__ && enableDebugTracing) {
		log(`* ${componentName} forced update (${formatLanes(lane)})`);
	}
}

export function logStateUpdateScheduled(componentName: string, lane: Lane, payloadOrAction: unknown): void {
	if (__DEV__ && enableDebugTracing) {
		log(`* ${componentName} updated state (${formatLanes(lane)})`);
		void payloadOrAction;
	}
}

export default {
	logCommitStarted,
	logCommitStopped,
	logComponentSuspended,
	logLayoutEffectsStarted,
	logLayoutEffectsStopped,
	logPassiveEffectsStarted,
	logPassiveEffectsStopped,
	logRenderStarted,
	logRenderStopped,
	logForceUpdateScheduled,
	logStateUpdateScheduled,
};
