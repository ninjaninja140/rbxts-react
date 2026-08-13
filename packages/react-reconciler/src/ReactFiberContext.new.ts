/**
 * Legacy context propagation for class components.
 *
 * Tracks the merged legacy-context object on a stack cursor as the renderer
 * walks the fiber tree. Class components with `childContextTypes` push their
 * merged context onto the stack; consumers read it back via
 * `getMaskedContext`.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberContext.new.lua`.
 *
 * @module ReactFiberContext
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__, __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__ } from '@nrbx/react-globals';
import { checkPropTypes, console, getComponentName, ReactFeatureFlags, assign, freeze } from '@nrbx/react-shared';
import { isFiberMounted } from './ReactFiberTreeReflection';
import { createCursor, push, pop } from './ReactFiberStack.new';
import type { StackCursor } from './ReactFiberStack.new';
import { ClassComponent, HostRoot } from './ReactWorkTags';
import type { Fiber } from './types';

const disableLegacyContext = ReactFeatureFlags.disableLegacyContext;

// A table used as the "empty" legacy context object.
type Object = Record<string, any>;

type ClassComponentType = {
	contextTypes?: Record<string, unknown>;
	childContextTypes?: Record<string, unknown>;
};

type ClassInstance = {
	__reactInternalMemoizedUnmaskedChildContext?: Object;
	__reactInternalMemoizedMaskedChildContext?: Object;
	__reactInternalMemoizedMergedChildContext?: Object;
	getChildContext?: () => Object;
};

let warnedAboutMissingGetChildContext: Record<string, boolean> | undefined;
if (__DEV__) {
	warnedAboutMissingGetChildContext = {};
}

let emptyContextObject: Object = {};
if (__DEV__) {
	emptyContextObject = freeze(emptyContextObject) as Object;
}

// A cursor to the current merged context object on the stack.
const contextStackCursor: StackCursor<Object> = createCursor(emptyContextObject);
// A cursor to a boolean indicating whether the context has changed.
const didPerformWorkStackCursor: StackCursor<boolean> = createCursor(false);
// Keep track of the previous context object that was on the stack.
// We use this to get access to the parent context after we have already
// pushed the next context provider, and now need to merge their contexts.
let previousContext: Object = emptyContextObject;

/**
 * Returns the unmasked context for the current work-in-progress fiber.
 *
 * If the fiber is itself a context provider, its own child context has
 * already been pushed, so we read the previous (parent) context instead.
 *
 * @internal
 */
function getUnmaskedContext(_workInProgress: Fiber, Component: unknown, didPushOwnContextIfProvider: boolean): Object {
	if (didPushOwnContextIfProvider && isContextProvider(Component)) {
		return previousContext;
	}
	return contextStackCursor.current;
}

/**
 * Caches the masked/unmasked child contexts on a class instance so they can
 * be reused until the unmasked context changes.
 *
 * @internal
 */
function cacheContext(workInProgress: Fiber, unmaskedContext: Object, maskedContext: Object): void {
	const instance = workInProgress.stateNode as ClassInstance;
	instance.__reactInternalMemoizedUnmaskedChildContext = unmaskedContext;
	instance.__reactInternalMemoizedMaskedChildContext = maskedContext;
}

/**
 * Masks a context object down to only the keys declared in the component's
 * `contextTypes`.
 *
 * @internal
 */
function getMaskedContext(workInProgress: Fiber, unmaskedContext: Object): Object {
	const type_ = workInProgress.type as ClassComponentType;

	// For function components we can't support `contextTypes`; instead just
	// return the unmasked context.
	if (typeOf(type_) === 'function') {
		return unmaskedContext;
	}

	const contextTypes = type_.contextTypes;
	if (!contextTypes) {
		return emptyContextObject;
	}

	// Avoid recreating masked context unless unmasked context has changed.
	// Failing to do this will result in unnecessary calls to
	// componentWillReceiveProps, which may trigger infinite loops if it calls
	// setState.
	const instance = workInProgress.stateNode as ClassInstance;
	if (instance && instance.__reactInternalMemoizedUnmaskedChildContext === unmaskedContext) {
		return instance.__reactInternalMemoizedMaskedChildContext as Object;
	}

	const context: Object = {};
	for (const [key] of pairs(contextTypes)) {
		context[key as string] = unmaskedContext[key as string];
	}

	if (__DEV__ || __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__) {
		const name = getComponentName(type_) ?? 'Unknown';
		checkPropTypes(contextTypes as Record<string, defined>, undefined, context, 'context', name);
	}

	// Cache unmasked context so we can avoid recreating masked context unless
	// necessary. Context is created before the class component is instantiated
	// so check for instance.
	if (instance) {
		cacheContext(workInProgress, unmaskedContext, context);
	}

	return context;
}

/**
 * Whether the current context changed during this render.
 *
 * @internal
 */
function hasContextChanged(): boolean {
	if (disableLegacyContext) {
		return false;
	}
	return didPerformWorkStackCursor.current;
}

/**
 * Whether the given component type declares `childContextTypes`.
 *
 * @internal
 */
function isContextProvider(type_: unknown): boolean {
	const t = type_ as ClassComponentType;
	// Context types are only valid for class components.
	if (typeOf(t) === 'function') {
		return false;
	}
	const childContextTypes = t.childContextTypes;
	return childContextTypes !== undefined;
}

/**
 * Pops the legacy context cursors for the given fiber.
 *
 * @internal
 */
function popContext(fiber: Fiber): void {
	pop(didPerformWorkStackCursor, fiber);
	pop(contextStackCursor, fiber);
}

/**
 * Pops the top-level legacy context object (used during interruption).
 *
 * @internal
 */
function popTopLevelContextObject(fiber: Fiber): void {
	pop(didPerformWorkStackCursor, fiber);
	pop(contextStackCursor, fiber);
}

/**
 * Pushes a fresh top-level legacy context object.
 *
 * @internal
 */
function pushTopLevelContextObject(fiber: Fiber, context: Object, didChange: boolean): void {
	if (contextStackCursor.current !== emptyContextObject) {
		error(
			'Unexpected context found on stack. ' +
				'This error is likely caused by a bug in React. Please file an issue.'
		);
	}

	push(contextStackCursor, context, fiber);
	push(didPerformWorkStackCursor, didChange, fiber);
}

/**
 * Computes a class component's child context by merging its
 * `getChildContext()` result over the parent context.
 *
 * @internal
 */
function processChildContext(fiber: Fiber, type_: unknown, parentContext: Object): Object {
	const t = type_ as ClassComponentType;
	const instance = fiber.stateNode as ClassInstance;
	const childContextTypes = t.childContextTypes;

	// TODO (bvaughn) Replace this behavior with an invariant() in the future.
	// It has only been added in Fiber to match the (unintentional) behavior in
	// Stack.
	if (instance.getChildContext === undefined || typeOf(instance.getChildContext) !== 'function') {
		if (__DEV__) {
			const componentName = getComponentName(type_) ?? 'Unknown';

			if (warnedAboutMissingGetChildContext !== undefined && !warnedAboutMissingGetChildContext[componentName]) {
				warnedAboutMissingGetChildContext[componentName] = true;
				console.error(
					'%s.childContextTypes is specified but there is no getChildContext() method ' +
						'on the instance. You can either define getChildContext() on %s or remove ' +
						'childContextTypes from it.',
					componentName,
					componentName
				);
			}
		}
		return parentContext;
	}

	const childContext = (instance.getChildContext as () => Object)();
	for (const [contextKey] of pairs(childContext)) {
		if ((childContextTypes as Record<string, unknown>)[contextKey as string] === undefined) {
			const name = getComponentName(type_) ?? 'Unknown';
			error(
				string.format(
					'%s.getChildContext(): key "%s" is not defined in childContextTypes.',
					name,
					contextKey as string
				)
			);
		}
	}
	if (__DEV__ || __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__) {
		const name = getComponentName(type_) ?? 'Unknown';
		checkPropTypes(childContextTypes as Record<string, defined>, undefined, childContext, 'child context', name);
	}

	return assign({}, parentContext, childContext);
}

/**
 * Pushes a class component's own context onto the stack (before it has been
 * merged with its parent's).
 *
 * @internal
 */
function pushContextProvider(workInProgress: Fiber): boolean {
	const instance = workInProgress.stateNode as ClassInstance;
	// We push the context as early as possible to ensure stack integrity.
	// If the instance does not exist yet, we will push undefined at first,
	// and replace it on the stack later when invalidating the context.
	const memoizedMergedChildContext = instance?.__reactInternalMemoizedMergedChildContext || emptyContextObject;

	// Remember the parent context so we can merge with it later.
	// Inherit the parent's did-perform-work value to avoid inadvertently
	// blocking updates.
	previousContext = contextStackCursor.current;
	push(contextStackCursor, memoizedMergedChildContext, workInProgress);
	push(didPerformWorkStackCursor, didPerformWorkStackCursor.current, workInProgress);

	return true;
}

/**
 * Replaces the placeholder context pushed by `pushContextProvider` with the
 * class component's real merged context once its instance exists.
 *
 * @internal
 */
function invalidateContextProvider(workInProgress: Fiber, type_: unknown, didChange: boolean): void {
	const t = type_ as ClassComponentType;
	const instance = workInProgress.stateNode as ClassInstance;

	if (!instance) {
		error(
			'Expected to have an instance by this point. ' +
				'This error is likely caused by a bug in React. Please file an issue.'
		);
	}

	if (didChange) {
		// Merge parent and own context.
		// Skip this if we're not updating due to sCU.
		// This avoids unnecessarily recomputing memoized values.
		const mergedContext = processChildContext(workInProgress, t, previousContext);
		instance.__reactInternalMemoizedMergedChildContext = mergedContext;

		// Replace the old (or empty) context with the new one.
		// It is important to unwind the context in the reverse order.
		pop(didPerformWorkStackCursor, workInProgress);
		pop(contextStackCursor, workInProgress);
		// Now push the new context and mark that it has changed.
		push(contextStackCursor, mergedContext, workInProgress);
		push(didPerformWorkStackCursor, didChange, workInProgress);
	} else {
		pop(didPerformWorkStackCursor, workInProgress);
		push(didPerformWorkStackCursor, didChange, workInProgress);
	}
}

/**
 * Walks up the tree from a class component to find the current unmasked
 * legacy context.
 *
 * @internal
 */
function findCurrentUnmaskedContext(fiber: Fiber): Object {
	// Currently this is only used with renderSubtreeIntoContainer; not sure if
	// it makes sense elsewhere.
	if (fiber.tag !== ClassComponent || !isFiberMounted(fiber)) {
		error(
			'Expected subtree parent to be a mounted class component. ' +
				'This error is likely caused by a bug in React. Please file an issue.'
		);
	}

	let node: Fiber | undefined = fiber;
	do {
		if (node.tag === HostRoot) {
			return (node.stateNode as { context: Object }).context;
		} else if (node.tag === ClassComponent) {
			const Component = node.type as ClassComponentType;
			if (Component.childContextTypes !== undefined) {
				return (node.stateNode as ClassInstance).__reactInternalMemoizedMergedChildContext as Object;
			}
		}

		node = node.return_;
	} while (node !== undefined);

	error(
		'Found unexpected detached subtree parent. ' +
			'This error is likely caused by a bug in React. Please file an issue.'
	);
}

export {
	emptyContextObject,
	getUnmaskedContext,
	cacheContext,
	getMaskedContext,
	hasContextChanged,
	popContext,
	popTopLevelContextObject,
	pushTopLevelContextObject,
	processChildContext,
	isContextProvider,
	pushContextProvider,
	invalidateContextProvider,
	findCurrentUnmaskedContext,
};

export default {
	emptyContextObject,
	getUnmaskedContext,
	cacheContext,
	getMaskedContext,
	hasContextChanged,
	popContext,
	popTopLevelContextObject,
	pushTopLevelContextObject,
	processChildContext,
	isContextProvider,
	pushContextProvider,
	invalidateContextProvider,
	findCurrentUnmaskedContext,
};
