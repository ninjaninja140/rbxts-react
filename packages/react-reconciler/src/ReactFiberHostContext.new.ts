/**
 * Maintains a stack of host contexts (and the fibers that supplied them) as
 * the reconciler walks the tree. Each fiber only pushes a context when its
 * host context differs from its parent's, so pops can skip fibers that never
 * changed anything.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberHostContext.new.lua`.
 *
 * @module ReactFiberHostContext
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import HostConfig from './ReactFiberHostConfig';
import type { Container, HostContext } from './ReactFiberHostConfig';
import { createCursor, pop, push } from './ReactFiberStack.new';
import type { StackCursor } from './ReactFiberStack.new';
import type { Fiber } from './types';

// Host-config functions are read lazily (at call time) because the renderer
// splices its implementation in via `initialize()` long after this module has
// been `require`d. See ReactFiberHostConfig for details.
function getChildHostContext(parentContext: HostContext, type_: string, rootContainer: Container): HostContext {
	return HostConfig.getChildHostContext(parentContext, type_, rootContainer);
}
function getRootHostContext(rootContainer: Container): HostContext {
	return HostConfig.getRootHostContext(rootContainer);
}

type NoContextT = object;
const NO_CONTEXT: NoContextT = {};

const contextStackCursor: StackCursor<HostContext | NoContextT> = createCursor(NO_CONTEXT);
const contextFiberStackCursor: StackCursor<Fiber | NoContextT> = createCursor(NO_CONTEXT);
const rootInstanceStackCursor: StackCursor<Container | NoContextT> = createCursor(NO_CONTEXT);

/**
 * Unwraps a stack-cursor value that is known (by construction) to hold a real
 * value rather than the `NO_CONTEXT` sentinel.
 *
 * @param c - The value to unwrap.
 * @returns `c`, cast to its concrete type.
 * @internal
 */
function requiredContext<Value>(c: Value | NoContextT): Value {
	return c as any;
}

/**
 * Returns the root container currently on the stack.
 *
 * @returns The current root container.
 * @internal
 */
export function getRootHostContainer(): Container {
	return rootInstanceStackCursor.current as any;
}

/**
 * Pushes a new root container (portal) onto the stack, then re-derives the
 * host context from that container.
 *
 * @param fiber - The fiber entering the portal.
 * @param nextRootInstance - The portal's container.
 * @internal
 */
export function pushHostContainer(fiber: Fiber, nextRootInstance: Container): void {
	// Push current root instance onto the stack.
	// This allows us to reset root when portals are popped.
	push(rootInstanceStackCursor, nextRootInstance, fiber);
	// Track the context and the Fiber that provided it.
	// This enables us to pop only Fibers that provide unique contexts.
	push(contextFiberStackCursor, fiber, fiber);

	// Finally, push the host context. We can't just call getRootHostContext()
	// and push the result because that would leave a different number of
	// entries on the stack if getRootHostContext() throws. Push an empty value
	// first so we can safely unwind on errors.
	push(contextStackCursor, NO_CONTEXT, fiber);
	const nextRootContext = getRootHostContext(nextRootInstance);
	// Now that we know this function doesn't throw, replace it.
	pop(contextStackCursor, fiber);
	push(contextStackCursor, nextRootContext, fiber);
}

/**
 * Pops a root container (portal) and the context it supplied.
 *
 * @param fiber - The fiber exiting the portal.
 * @internal
 */
export function popHostContainer(fiber: Fiber): void {
	pop(contextStackCursor, fiber);
	pop(contextFiberStackCursor, fiber);
	pop(rootInstanceStackCursor, fiber);
}

/**
 * Returns the host context currently on the stack.
 *
 * @returns The current host context.
 * @internal
 */
export function getHostContext(): HostContext {
	return contextStackCursor.current as any;
}

/**
 * Pushes the host context for `fiber` if it differs from its parent's.
 *
 * @param fiber - The fiber entering the subtree.
 * @internal
 */
export function pushHostContext(fiber: Fiber): void {
	const rootInstance: Container = requiredContext(rootInstanceStackCursor.current);
	const context: HostContext = requiredContext(contextStackCursor.current);
	const nextContext = getChildHostContext(context, fiber.type, rootInstance);

	// Don't push this Fiber's context unless it's unique.
	if (context === nextContext) {
		return;
	}

	// Track the context and the Fiber that provided it.
	// This enables us to pop only Fibers that provide unique contexts.
	push(contextFiberStackCursor, fiber, fiber);
	push(contextStackCursor, nextContext, fiber);
}

/**
 * Pops the host context for `fiber`, if it supplied one.
 *
 * @param fiber - The fiber exiting the subtree.
 * @internal
 */
export function popHostContext(fiber: Fiber): void {
	// Do not pop unless this Fiber provided the current context.
	// pushHostContext() only pushes Fibers that provide unique contexts.
	if (contextFiberStackCursor.current !== fiber) {
		return;
	}

	pop(contextStackCursor, fiber);
	pop(contextFiberStackCursor, fiber);
}

export default {
	getHostContext,
	getRootHostContainer,
	popHostContainer,
	popHostContext,
	pushHostContainer,
	pushHostContext,
};
