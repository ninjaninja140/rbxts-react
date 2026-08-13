/**
 * Tracks Suspense boundary state along the fiber tree using a stack cursor.
 *
 * The Suspense context is split into two parts: the lower bits are inherited
 * deeply down the subtree, while the upper bits only affect the immediate
 * Suspense boundary and are reset at each new boundary or SuspenseList.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberSuspenseContext.new.lua`.
 *
 * @module ReactFiberSuspenseContext
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { createCursor, pop, push } from './ReactFiberStack.new';
import type { StackCursor } from './ReactFiberStack.new';
import type { Fiber } from './types';

export type SuspenseContext = number;
export type SubtreeSuspenseContext = SuspenseContext;
export type ShallowSuspenseContext = SuspenseContext;

const DefaultSuspenseContext: SuspenseContext = 0b00;

// The Suspense Context is split into two parts. The lower bits is
// inherited deeply down the subtree. The upper bits only affect
// this immediate suspense boundary and gets reset each new
// boundary or suspense list.
const SubtreeSuspenseContextMask: SuspenseContext = 0b01;

// Subtree Flags:

// InvisibleParentSuspenseContext indicates that one of our parent Suspense
// boundaries is not currently showing visible main content.
// Either because it is already showing a fallback or is not mounted at all.
// We can use this to determine if it is desirable to trigger a fallback at
// the parent. If not, then we might need to trigger undesirable boundaries
// and/or suspend the commit to avoid hiding the parent content.
export const InvisibleParentSuspenseContext: SubtreeSuspenseContext = 0b01;

// Shallow Flags:

// ForceSuspenseFallback can be used by SuspenseList to force newly added
// items into their fallback state during one of the render passes.
export const ForceSuspenseFallback: ShallowSuspenseContext = 0b10;

/** The stack cursor holding the current Suspense context. */
export const suspenseStackCursor: StackCursor<SuspenseContext> = createCursor(DefaultSuspenseContext);

/**
 * Returns whether `flag` is set on `parentContext`.
 *
 * @param parentContext - The Suspense context to test.
 * @param flag - The flag (or flags) to test for.
 * @returns `true` when all `flag` bits are set.
 * @internal
 */
export function hasSuspenseContext(parentContext: SuspenseContext, flag: SuspenseContext): boolean {
	return bit32.band(parentContext, flag) !== 0;
}

/**
 * Resets the shallow bits of a parent context, keeping only inherited subtree
 * bits.
 *
 * @param parentContext - The context to reset.
 * @returns The context with shallow bits cleared.
 * @internal
 */
export function setDefaultShallowSuspenseContext(parentContext: SuspenseContext): SuspenseContext {
	return bit32.band(parentContext, SubtreeSuspenseContextMask);
}

/**
 * Combines a parent context's subtree bits with a new shallow context.
 *
 * @param parentContext - The parent Suspense context.
 * @param shallowContext - The new shallow bits to apply.
 * @returns The combined Suspense context.
 * @internal
 */
export function setShallowSuspenseContext(
	parentContext: SuspenseContext,
	shallowContext: ShallowSuspenseContext
): SuspenseContext {
	return bit32.bor(bit32.band(parentContext, SubtreeSuspenseContextMask), shallowContext);
}

/**
 * Adds subtree bits to a parent context.
 *
 * @param parentContext - The parent Suspense context.
 * @param subtreeContext - The subtree bits to add.
 * @returns The combined Suspense context.
 * @internal
 */
export function addSubtreeSuspenseContext(
	parentContext: SuspenseContext,
	subtreeContext: SubtreeSuspenseContext
): SuspenseContext {
	return bit32.bor(parentContext, subtreeContext);
}

/**
 * Pushes a new Suspense context onto the stack for `fiber`.
 *
 * @param fiber - The fiber the context belongs to.
 * @param newContext - The Suspense context to push.
 * @internal
 */
export function pushSuspenseContext(fiber: Fiber, newContext: SuspenseContext): void {
	push(suspenseStackCursor, newContext, fiber);
}

/**
 * Pops the Suspense context that `fiber` pushed.
 *
 * @param fiber - The fiber whose context should be popped.
 * @internal
 */
export function popSuspenseContext(fiber: Fiber): void {
	pop(suspenseStackCursor, fiber);
}

export default {
	InvisibleParentSuspenseContext,
	ForceSuspenseFallback,
	suspenseStackCursor,
	hasSuspenseContext,
	setDefaultShallowSuspenseContext,
	setShallowSuspenseContext,
	addSubtreeSuspenseContext,
	pushSuspenseContext,
	popSuspenseContext,
};
