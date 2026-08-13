/**
 * Builds the component stack for a given fiber, used in dev warnings and
 * error messages.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberComponentStack.lua`.
 *
 * @module ReactFiberComponentStack
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { ReactComponentStackFrame } from '@nrbx/react-shared';

import type { Fiber } from './types';
import {
	HostComponent,
	LazyComponent,
	SuspenseComponent,
	SuspenseListComponent,
	FunctionComponent,
	IndeterminateComponent,
	ForwardRef,
	SimpleMemoComponent,
	ClassComponent,
} from './ReactWorkTags';

const { describeBuiltInComponentFrame, describeFunctionComponentFrame, describeClassComponentFrame } =
	ReactComponentStackFrame;

type Callback = (...args: defined[]) => defined;

function describeFiber(fiber: Fiber): string {
	let owner: Callback | undefined;
	if (__DEV__) {
		const debugOwner = fiber._debugOwner;
		if (debugOwner) {
			owner = debugOwner.type as Callback;
		}
	}
	let source: unknown;
	if (__DEV__) {
		source = fiber._debugSource;
	}

	if (fiber.tag === HostComponent) {
		return describeBuiltInComponentFrame(fiber.type as string, source as never, owner as never);
	} else if (fiber.tag === LazyComponent) {
		return describeBuiltInComponentFrame('Lazy', source as never, owner as never);
	} else if (fiber.tag === SuspenseComponent) {
		return describeBuiltInComponentFrame('Suspense', source as never, owner as never);
	} else if (fiber.tag === SuspenseListComponent) {
		return describeBuiltInComponentFrame('SuspenseList', source as never, owner as never);
	} else if (
		fiber.tag === FunctionComponent ||
		fiber.tag === IndeterminateComponent ||
		fiber.tag === SimpleMemoComponent
	) {
		return describeFunctionComponentFrame(fiber.type as Callback, source as never, owner as never);
	} else if (fiber.tag === ForwardRef) {
		return describeFunctionComponentFrame(
			(fiber.type as { render?: Callback }).render,
			source as never,
			owner as never
		);
	} else if (fiber.tag === ClassComponent) {
		return describeClassComponentFrame(fiber.type as defined, source as never, owner as never);
	} else {
		return '';
	}
}

/**
 * Returns the component stack for `workInProgress`, or an error description
 * when the stack could not be generated.
 *
 * @param workInProgress - The fiber to walk up from.
 * @returns A human-readable component stack string.
 * @internal
 */
export function getStackByFiberInDevAndProd(workInProgress: Fiber | undefined): string {
	const [ok, result] = pcall(() => {
		let info = '';
		let node = workInProgress;
		do {
			info += describeFiber(node as Fiber);
			node = (node as Fiber).return_;
		} while (node !== undefined);
		return info;
	});

	if (!ok) {
		const message = '\nError generating stack: ';
		if (
			typeOf(result) === 'table' &&
			(result as { message?: string; stack?: string }).message &&
			(result as { stack?: string }).stack
		) {
			const r = result as { message: string; stack: string };
			return `${message + r.message}\n${tostring(r.stack)}`;
		}
		return message + tostring(result);
	}

	return result as string;
}

export default {
	getStackByFiberInDevAndProd,
};
