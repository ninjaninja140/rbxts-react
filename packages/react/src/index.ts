/**
 * The main entry point for `@nrbx/react` (React 19 for Roblox).
 *
 * This module wraps the underlying React 17 Lua runtime and extends it
 * with React 19 features:
 *
 * - **Text as children** — `string` / `number` children auto-wrapped in `TextLabel`.
 * - **Tailwind `className`** — Map Tailwind classes to Roblox GUI props.
 * - **HTML elements** — `div`, `span`, `h1`, `button`, etc.
 * - **Hooks `useId`, `useTransition`, `useOptimistic`, `use`, `useActionState`** — polyfilled.
 * - **`cache`, `startTransition`, `tw`, `cn`** — new utilities.
 *
 * ```tsx
 * import React, { useState } from "@nrbx/react";
 *
 * const Counter = () => {
 *   const [count, setCount] = useState(0);
 *   return (
 *     <div className="flex flex-col items-center p-4">
 *       <h1>{count}</h1>
 *       <button className="bg-blue-500 rounded" Event={{ Activated: () => setCount(c => c + 1) }}>
 *         <span>Increment</span>
 *       </button>
 *     </div>
 *   );
 * };
 * ```
 *
 * @module index
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import core, {
	Component,
	PureComponent,
	cloneElement as coreCloneElement,
	createContext as coreCreateContext,
	createElement as coreCreateElement,
	createRef as coreCreateRef,
	forwardRef as coreForwardRef,
	lazy as coreLazy,
	memo as coreMemo,
} from './core';
import { Reconciler } from './internals';
import { isTextCapableParent, createTextElement } from './text/create-element';
import { isHTMLElement, mapHTMLToRoblox, resolveHTMLElementDefaults } from './html-elements/resolve';
import { resolveTag } from './tags';
import { resolveClassNameWithConfig } from './styles/parser';
import { getStyleConfig } from './styles/config';
import { translateEventProps } from './events';

// Helpers

/**
 * Given a JSX tag name, resolves it to a Roblox `ClassName`.
 *
 * Resolution order:
 * 1. HTML element map (e.g. `"div"` → `"Frame"`)
 * 2. `resolveTag()` via `ReflectionService` (e.g. `"textlabel"` → `"TextLabel"`)
 * 3. Fallback: uppercase first letter (e.g. `"frame"` → `"Frame"`)
 *
 * @param tag - The raw JSX tag name.
 * @returns The resolved Roblox ClassName.
 * @internal
 */
function resolveElementTag(tag: string): string {
	const htmlClass = mapHTMLToRoblox(tag);
	if (htmlClass !== undefined) return htmlClass;

	const resolved = resolveTag(tag);
	if (resolved !== undefined) return resolved;

	// Fallback: uppercase first letter (handles "frame", "textlabel", etc.)
	return tag.sub(1, 1).upper() + tag.sub(2);
}

/**
 * Returns `true` if the given tag is an HTML element, as opposed to a
 * native Roblox class.
 *
 * @param tag - The raw JSX tag name.
 * @internal
 */
function isHtmlTag(tag: string): boolean {
	return isHTMLElement(tag);
}

/**
 * Applies style children (UICorner, UIPadding, UIFlexItem) from
 * resolved class names onto an element's children list.
 *
 * Virtual children are stored as `props.__styleChildren` by the parser.
 * They are inserted after regular children.
 *
 * @param children - Mutable array of children to append into.
 * @param config - The element's props table.
 * @internal
 */
function applyStyleChildren(children: unknown[], config: Record<string, unknown>): void {
	const styleChildren = config.__styleChildren as Record<string, unknown>[] | undefined;
	if (!styleChildren) return;

	for (const child of styleChildren) {
		const className = child.__className as string;
		if (className) {
			const props: Record<string, unknown> = {};
			for (const [key, value] of pairs(child)) {
				if (key !== '__className') {
					props[key] = value;
				}
			}
			children[children.size()] = coreCreateElement(className, props);
		}
	}
}

// Hover state management — rewritable props for hover: variants

let hoverIdCounter = 0;

/**
 * Sets up `MouseEnter` / `MouseLeave` event handlers that swap in hover
 * props when the user hovers over the instance.
 *
 * This is called automatically by `createElement` when a className contains
 * `hover:` prefixed utilities.
 *
 * @param config - The element's props table (mutated in place).
 * @param hoverProps - The props to apply on hover.
 * @param hoverStyleChildren - Virtual children (UIPadding, etc.) to inject on hover.
 * @internal
 */
function setupHoverHandlers(
	config: Record<string, unknown>,
	hoverProps?: Record<string, unknown>,
	hoverStyleChildren?: Record<string, unknown>[]
): void {
	if (!hoverProps && !hoverStyleChildren) return;

	const hoverId = `__hover_${hoverIdCounter}`;
	hoverIdCounter += 1;
	config.__hoverId = hoverId;

	// Store original values so we can restore them on mouse leave
	const savedProps: Record<string, unknown> = {};

	(config as unknown as Record<string, unknown>).__hoverProps = hoverProps;
	(config as unknown as Record<string, unknown>).__hoverStyleChildren = hoverStyleChildren;

	// Hook into existing Event table or create one
	const existingEvent = config.Event as Record<string, unknown> | undefined;
	const eventTable: Record<string, unknown> = {};
	if (existingEvent && type(existingEvent) === 'table') {
		for (const [k, v] of pairs(existingEvent)) {
			eventTable[k] = v;
		}
	}

	const originalMouseEnter = eventTable.MouseEnter as ((rbx: unknown) => void) | undefined;
	const originalMouseLeave = eventTable.MouseLeave as ((rbx: unknown) => void) | undefined;

	// MouseEnter: apply hover props to the raw Roblox instance
	eventTable.MouseEnter = (rbx: unknown) => {
		if (originalMouseEnter) originalMouseEnter(rbx);

		const instance = rbx as unknown as Record<string, unknown>;

		// Save current values
		if (hoverProps) {
			for (const [key, value] of pairs(hoverProps)) {
				savedProps[key] = instance[key];
				instance[key] = value;
			}
		}

		// Inject hover style children
		if (hoverStyleChildren) {
			for (const child of hoverStyleChildren) {
				const className = child.__className as string;
				if (className) {
					const childProps: Record<string, unknown> = {};
					for (const [k, v] of pairs(child)) {
						if (k !== '__className') childProps[k] = v;
					}
					const inst = coreCreateElement(className, childProps) as unknown as { Parent?: unknown };
					// In a real implementation, we'd parent this to the instance
					// Since we're in a sync handler, we can't easily create/destroy children
					// Store reference for a more complete solution
					inst.Parent = instance as unknown as { Parent?: unknown };
				}
			}
		}
	};

	// MouseLeave: restore original values
	eventTable.MouseLeave = (rbx: unknown) => {
		if (originalMouseLeave) originalMouseLeave(rbx);

		const instance = rbx as unknown as Record<string, unknown>;
		if (hoverProps) {
			for (const [key, value] of pairs(savedProps)) {
				instance[key] = value;
			}
		}
	};

	config.Event = eventTable;
}

// createElement — the core JSX factory

/**
 * JSX factory. Typically not called directly — the compiler transforms
 * JSX into calls to this function.
 *
 * This wrapper intercepts element creation to:
 * 1. Resolve HTML tag names to Roblox class names.
 * 2. Auto-wrap `string` / `number` children in `TextLabel` when the
 *    parent is not text-capable.
 * 3. Resolve Tailwind `className` into Roblox GUI props.
 * 4. Inject "virtual children" (UICorner, UIPadding) for style classes.
 * 5. Apply default styles for HTML elements (heading sizes, etc.).
 *
 * @param elementType - The JSX tag name or component function.
 * @param config - JSX props (attributes and event handlers).
 * @param children - Child elements, strings, numbers, etc.
 * @returns A React element.
 *
 * @public
 */
export function createElement<P = Record<string, unknown>>(
	elementType: string,
	config?: P,
	...children: unknown[]
): unknown;

export function createElement<P = Record<string, unknown>>(
	elementType: (props: P) => unknown,
	config?: P,
	...children: unknown[]
): unknown;

export function createElement(
	elementType: string | ((...args: never[]) => unknown),
	config?: Record<string, unknown>,
	...children: unknown[]
): unknown {
	// React tracks component identity through its own element machinery, so
	// invoking the function here would bypass fibers, hooks, and suspense.
	if (type(elementType) === 'function') {
		return coreCreateElement(elementType, config, ...children);
	}

	const tag = elementType as string;
	const isHtml = isHtmlTag(tag);
	const resolvedTag = resolveElementTag(tag);

	// Clone config to avoid mutation
	const mergedConfig: Record<string, unknown> = {};
	if (config !== undefined) {
		for (const [k, v] of pairs(config)) {
			mergedConfig[k] = v;
		}
	}

	if (type(mergedConfig) === 'table') {
		translateEventProps(mergedConfig);
	}

	if (isHtml) {
		const defaults = resolveHTMLElementDefaults(tag.lower());
		if (defaults) {
			for (const [key, value] of pairs(defaults)) {
				// Don't override explicitly set props
				if ((mergedConfig as Record<string, unknown>)[key] === undefined) {
					(mergedConfig as Record<string, unknown>)[key] = value;
				}
			}
		}
	}

	if (mergedConfig.className !== undefined) {
		const rawClass = mergedConfig.className as string;
		const styleCfg = getStyleConfig();
		const styleProps = resolveClassNameWithConfig(rawClass, styleCfg);

		// Merge style props (don't override explicit props)
		for (const [key, value] of pairs(styleProps)) {
			if (
				key !== '__styleChildren' &&
				key !== '__className' &&
				key !== '__hoverProps' &&
				key !== '__hoverStyleChildren'
			) {
				if ((mergedConfig as Record<string, unknown>)[key] === undefined) {
					(mergedConfig as Record<string, unknown>)[key] = value;
				}
			}
		}

		// Collect virtual children
		if (styleProps.__styleChildren !== undefined) {
			(mergedConfig as unknown as Record<string, unknown>).__styleChildren = (
				styleProps as unknown as Record<string, unknown>
			).__styleChildren;
		}

		const hp = styleProps.__hoverProps as Record<string, unknown> | undefined;
		const hsc = styleProps.__hoverStyleChildren as Record<string, unknown>[] | undefined;
		if (hp || hsc) {
			setupHoverHandlers(mergedConfig, hp, hsc);
		}
	}

	const processedChildren: unknown[] = [];
	for (const child of children) {
		const childType = type(child);
		if ((childType === 'string' || childType === 'number') && !isTextCapableParent(resolvedTag)) {
			processedChildren[processedChildren.size()] = coreCreateElement(
				'TextLabel',
				createTextElement(child as string | number, resolvedTag)
			);
		} else {
			processedChildren[processedChildren.size()] = child;
		}
	}

	applyStyleChildren(processedChildren, mergedConfig);

	return coreCreateElement(resolvedTag, mergedConfig, ...processedChildren);
}

// createFragment — <>...</>

/**
 * Creates a React Fragment (`<>...</>` in JSX).
 *
 * @param children - Fragment children.
 * @returns A React fragment element.
 */
export function createFragment(...children: unknown[]): unknown {
	return coreCreateElement(core.Fragment, undefined, ...children);
}

// Component / PureComponent

/**
 * Legacy class-based component base classes with full React lifecycle support.
 *
 * ```tsx
 * class MyComponent extends React.Component<Props, State> {
 *   init(props: Props) { super.init(props); }
 *   render() { return <frame />; }
 *   componentDidMount() { print("mounted"); }
 *   componentDidUpdate(prevProps: Props, prevState: State) {}
 *   componentWillUnmount() { print("unmounted"); }
 *   shouldComponentUpdate(nextProps: Props, nextState: State): boolean { return true; }
 *   componentDidCatch(error: unknown, info: { componentStack: string }) {}
 *   static getDerivedStateFromError(error: unknown): Partial<State> | undefined { return undefined; }
 * }
 * ```
 *
 * `PureComponent` is identical to `Component` but implements
 * `shouldComponentUpdate` with a shallow prop/state comparison.
 *
 * These are the native TypeScript classes from `./core` (see
 * `ReactBaseClasses`), not type-only declarations. The full lifecycle
 * surface — `init`, `setState`, `forceUpdate`, `componentDidMount`,
 * `shouldComponentUpdate`, `getSnapshotBeforeUpdate`, `componentDidUpdate`,
 * `componentWillUnmount`, `componentDidCatch`, and the `UNSAFE_*` methods —
 * is documented there.
 *
 * @typeParam Props - Props type (default: `{}`).
 * @typeParam State - State type (default: `{}`).
 */
export { Component, PureComponent };

// memo — higher-order component for skipping re-renders

/**
 * Memoizes a component so React skips rendering if its props haven't changed.
 *
 * ```tsx
 * const MemoizedButton = React.memo(function Button(props: ButtonProps) {
 *   return <textbutton {...props} />;
 * });
 *
 * // With a custom comparison function:
 * const MemoizedButton = React.memo(Button, (prev, next) => prev.label === next.label);
 * ```
 *
 * @param component - The component function to memoize.
 * @param compare - Optional comparison function `(oldProps, newProps) => boolean`.
 *   Return `true` if the props are equal (skip re-render), `false` to re-render.
 * @returns A memoized version of the component.
 */
export function memo<P extends Record<string, unknown>>(
	component: (props: P) => unknown,
	compare?: (oldProps: P, newProps: P) => boolean
): (props: P) => unknown {
	return coreMemo(component as never, compare as never) as unknown as (props: P) => unknown;
}

// cloneElement

/**
 * Clones a React element, optionally merging in new props and children.
 *
 * ```tsx
 * const cloned = React.cloneElement(<frame />, { Size: UDim2.fromScale(1, 0.5) });
 * ```
 *
 * @param element - The element to clone.
 * @param props - Props to merge into the cloned element.
 * @param children - Additional children to append.
 * @returns A new React element.
 */
export function cloneElement(element: unknown, props?: Record<string, unknown>, ...children: unknown[]): unknown {
	return coreCloneElement(element as never, props, ...children);
}

// isValidElement

/**
 * Returns `true` if `object` is a React element.
 *
 * ```ts
 * React.isValidElement(<frame />) // → true
 * React.isValidElement({})        // → false
 * ```
 *
 * @param object - The value to check.
 * @returns `true` if `object` is a React element.
 */
export function isValidElement(object: unknown): boolean {
	if (typeIs(object, 'table')) {
		return (object as Record<string, unknown>).$$typeof !== undefined;
	}
	return false;
}

// createRef

/**
 * Creates a ref object that can be attached to React elements via the `ref` prop.
 *
 * ```tsx
 * const myRef = React.createRef<TextBox>();
 * // <textbox ref={myRef} />
 * // myRef.current // → the TextBox instance
 * ```
 *
 * @returns A ref object `{ current: undefined }`.
 */
export function createRef<T>(): { current: T | undefined } {
	return coreCreateRef<T>();
}

// createContext

/**
 * Creates a React Context for passing data through the component tree.
 *
 * ```tsx
 * const ThemeContext = React.createContext<Theme>(defaultTheme);
 * ```
 */
export function createContext<T>(defaultValue: T): { Provider: unknown; Consumer: unknown; defaultValue: T } {
	return coreCreateContext(defaultValue) as unknown as { Provider: unknown; Consumer: unknown; defaultValue: T };
}

// forwardRef

/**
 * Forwards a ref through a component.
 *
 * ```tsx
 * const Input = React.forwardRef<TextBox, Props>((props, ref) => (
 *   <textbox ref={ref} {...props} />
 * ));
 * ```
 */
export function forwardRef<T, P = Record<string, unknown>>(
	render: (props: P, ref: { current?: T }) => unknown
): (props: P) => unknown {
	return coreForwardRef(render as never) as unknown as (props: P) => unknown;
}

// Fragment symbol

/**
 * Used as a JSX fragment element. Prefer `<>...</>` syntax.
 */
export const Fragment = core.Fragment;

// Suspense

/**
 * Suspense lets you display a fallback until its children finish loading.
 *
 * ```tsx
 * <Suspense fallback={<frame><textlabel Text="Loading..." /></frame>}>
 *   <LazyComponent />
 * </Suspense>
 * ```
 */
export const Suspense = core.Suspense;

// StrictMode

/**
 * StrictMode enables additional development-mode checks and warnings.
 */
export const StrictMode = core.StrictMode;

// Children utilities

/**
 * Utilities for working with React children (`.map`, `.forEach`, `.count`, `.only`, `.toArray`).
 */
export const Children: {
	map<T, U>(children: unknown, fn: (child: T, index: number) => U): U[];
	forEach<T>(children: unknown, fn: (child: T, index: number) => void): void;
	count(children: unknown): number;
	only<T>(children: unknown): T;
	toArray(children: unknown): unknown[];
} = core.Children as unknown as {
	map<T, U>(children: unknown, fn: (child: T, index: number) => U): U[];
	forEach<T>(children: unknown, fn: (child: T, index: number) => void): void;
	count(children: unknown): number;
	only<T>(children: unknown): T;
	toArray(children: unknown): unknown[];
};

// lazy

/**
 * Lazy-loads a React component. The module must export a `default` component.
 *
 * ```tsx
 * const LazyPage = React.lazy(() => import("./Page"));
 * ```
 */
export function lazy<T extends Record<string, unknown>>(
	factory: () => Promise<T>
): (props: Record<string, unknown>) => unknown {
	return coreLazy(factory as never) as unknown as (props: Record<string, unknown>) => unknown;
}

// act — test utility

/**
 * Wraps synchronous or async code that triggers React updates, ensuring
 * effects are flushed before returning. Primarily used in tests.
 */
export const act: (callback: () => Promise<void> | void) => Promise<void> | void = Reconciler.act as unknown as (
	callback: () => Promise<void> | void
) => Promise<void> | void;

// Re-exports from submodules

// Hooks
export {
	// Core (React 17)
	useRef,
	useState,
	useReducer,
	useEffect,
	useLayoutEffect,
	useMemo,
	useCallback,
	useContext,
	useMemoCompare,
	useImperativeHandle,
	// React 19 polyfills
	useId,
	useTransition,
	useDeferredValue,
	useSyncExternalStore,
	useInsertionEffect,
	useEffectEvent,
	useOptimistic,
	use,
	useActionState,
	// Compiler hook
	useMemoCache,
	// Motion / animation
	useMotion,
	useHoverMotion,
	// Utilities
	cache,
	startTransition,
	useLifecycle,
	useDebugValue,
} from './hooks';
export type { SpringConfig, Motion } from './hooks';

// Text-as-children
export type { TextChildOptions, TextChildConfig, TextChildOverrides } from './text';
export { configureTextChildren, getTextOptions, getTextConfig } from './text';

// Styles (Tailwind)
export type {
	StyleConfig,
	ResolvedStyleConfig,
	HexColor,
	CSSRules,
	CustomResolver,
	ExperimentalFlags,
	StyleSystemConfig,
} from './styles';
export {
	tw,
	cn,
	resolveClassName,
	resolveColor,
	hexToColor3,
	configureStyles,
	createStyleSystem,
	getStyleConfig,
	defineConfig,
	getCustomCSSRules,
	getCustomResolver,
	getExperimentalFlags,
	resetCustomConfig,
} from './styles';

// HTML elements
export type { HeadingConfig, HeadingOverrides, SpecialElementConfig, HTMLElementMap } from './html-elements';
export {
	DEFAULT_HTML_ELEMENT_MAP,
	configureHeadings,
	getHeadingConfig,
	getSpecialElementConfig,
	setSpecialElementConfig,
	DEFAULT_HEADINGS,
	DEFAULT_SPECIAL_ELEMENTS,
	mapHTMLToRoblox,
	isHTMLElement,
	setHTMLElementMap,
	resolveHTMLElementDefaults,
} from './html-elements';

// Error boundary
export type { ReactErrorInfo, ErrorBoundaryProps } from './error-boundary';
export { ErrorBoundary, formatReactError, parseErrorSource } from './error-boundary';

// Forms
export type { UseFormConfig, UseFormReturn, RegisterOptions } from './forms';
export { useForm } from './forms';

// Internal bridge — for companion packages (react-debug-tools, react-devtools-core)

export {
	Shared,
	Reconciler,
	ReactSharedInternals,
	WorkTags,
	FunctionComponent,
	SimpleMemoComponent,
	ContextProvider,
	ForwardRef,
	Block,
	NoMode,
	ReactSymbols,
	REACT_OPAQUE_ID_TYPE,
} from './internals';
export type { CurrentDispatcherRef } from './internals';

// Default export (for import React from "@nrbx/react")

// Import hooks into local scope for the default export object
import {
	useRef,
	useState,
	useReducer,
	useEffect,
	useLayoutEffect,
	useMemo,
	useCallback,
	useContext,
	useMemoCompare,
	useImperativeHandle,
	useId,
	useTransition,
	useDeferredValue,
	useSyncExternalStore,
	useInsertionEffect,
	useEffectEvent,
	useOptimistic,
	use,
	useActionState,
	useMemoCache,
	useMotion,
	useHoverMotion,
	cache,
	startTransition,
	useLifecycle,
	useDebugValue,
} from './hooks';

const React = {
	// Element creation
	createElement,
	createFragment,
	// Context
	createContext,
	// Refs & components
	forwardRef,
	memo,
	cloneElement,
	isValidElement,
	createRef,
	Component,
	PureComponent,
	// Primitives
	Fragment,
	Suspense,
	StrictMode,
	// Utilities
	Children,
	lazy,
	act,
	// Hooks (for React.useState() compatibility with @rbxts/react)
	useRef,
	useState,
	useReducer,
	useEffect,
	useLayoutEffect,
	useMemo,
	useCallback,
	useContext,
	useMemoCompare,
	useImperativeHandle,
	useId,
	useTransition,
	useDeferredValue,
	useSyncExternalStore,
	useInsertionEffect,
	useEffectEvent,
	useOptimistic,
	use,
	useActionState,
	useMemoCache,
	useMotion,
	useHoverMotion,
	cache,
	startTransition,
	useLifecycle,
	useDebugValue,
};

export default React;
