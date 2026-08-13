/**
 * React bridge for `@nrbx/react-builders`.
 *
 * Converts a `BaseBuilder` tree into React elements via
 * `React.createElement`. Supports both native Roblox class names and
 * custom component functions.
 *
 * ```ts
 * const builder = new Builder("Frame")
 *   .set("Size", new UDim2(0, 200, 0, 100))
 *   .addChild(c => c.set("ClassName", "TextLabel").set("Text", "Hello"));
 *
 * const element = Builders.constructElement(builder);
 * // Equivalent to:
 * // React.createElement("Frame", { Size: new UDim2(0, 200, 0, 100) },
 * //   React.createElement("TextLabel", { Text: "Hello" })
 * // )
 * ```
 *
 * @module react
 * @packageDocumentation
 */

import { createElement } from '@nrbx/react';
import type { BaseBuilder } from './base';
import type { BuilderNode } from './types';
import { fromTable } from './serialization';

// Component registry (for custom components)

/**
 * A React component, whether a function or class.
 */
type AnyComponent = (props: Record<string, unknown>) => unknown;

/**
 * Map of custom component keys to React component functions.
 *
 * Register custom components with `Builders.registerComponent()` so the
 * builder can reference them by string key:
 *
 * ```ts
 * Builders.registerComponent("MyCard", MyCardComponent);
 * new Builder("MyCard").set("title", "Hello"); // uses MyCardComponent
 * ```
 */
const componentRegistry = new Map<string, AnyComponent>();

/**
 * Registers a custom React component so it can be referenced by name in
 * builder chains.
 *
 * ```ts
 * import { Builders } from "@nrbx/react-builders";
 * import MyCard from "./components/MyCard";
 *
 * Builders.registerComponent("MyCard", MyCard);
 *
 * const card = new Builders.Builder("MyCard")
 *   .set("title", "Hello World")
 *   .set("subtitle", "This is a card");
 * ```
 *
 * @param name - The key used in `.Builder(name)`.
 * @param component - A React functional component.
 */
export function registerComponent(name: string, component: AnyComponent): void {
	componentRegistry.set(name, component);
}

/**
 * Removes a previously registered component.
 */
export function unregisterComponent(name: string): void {
	componentRegistry.delete(name);
}

/**
 * Returns the full list of registered component keys.
 */
export function getRegisteredComponents(): string[] {
	const keys: string[] = [];
	for (const [k] of componentRegistry) {
		keys.push(k);
	}
	return keys;
}

// constructElement

/**
 * Converts a `BaseBuilder` tree into a React element.
 *
 * Walks the builder tree depth-first, calling `React.createElement` for
 * each node. Roblox class names (e.g. `"Frame"`, `"TextLabel"`) are
 * passed as string tags. Custom component keys (registered via
 * `registerComponent`) are replaced with the actual component function.
 *
 * ```ts
 * const element = Builders.constructElement(builder);
 * root.render(element);
 * ```
 *
 * @param builder - The root builder node.
 * @returns A React element ready for rendering.
 */
export function constructElement(builder: BaseBuilder): unknown {
	// Recurse into builder children
	const children: defined[] = [];
	for (const child of builder.getChildren()) {
		children.push(constructElement(child) as defined);
	}

	// Append any JSX elements embedded via wrapElement
	for (const wrapped of builder.getWrapped()) {
		children.push(wrapped);
	}

	// Transfer all stored properties into the props object
	const props: Record<string, unknown> = {};
	for (const [key, value] of builder.getProperties()) {
		props[key as string] = value;
	}

	// Handle React key
	const key = builder.getKey();
	if (key !== undefined) {
		props.key = key;
	}

	// Resolve the element type:
	// 1. Registered custom component
	// 2. Roblox class name (passed as string — reconciler instantiates it)
	const elementType = builder.className;
	const customComponent = componentRegistry.get(elementType);
	const resolvedType = customComponent !== undefined ? customComponent : elementType;

	if (children.size() === 0) {
		return createElement(resolvedType as never, props as never) as defined;
	}
	return createElement(resolvedType as never, props as never, ...children) as defined;
}

// createElementFromTable — shortcut for server→client reconstruction

/**
 * Deserializes a `BuilderNode` and immediately constructs a React element.
 *
 * Convenience helper that combines `fromTable()` + `constructElement()`
 * for the common "receive on client, render immediately" pattern:
 *
 * ```ts
 * // Client
 * const node = HttpService.JSONDecode(receivedJson);
 * const element = Builders.createElementFromTable(node);
 * root.render(element);
 * ```
 */
export function createElementFromTable(node: BuilderNode): unknown {
	return constructElement(fromTable(node));
}

// wrapElement — embed an existing React element in a builder tree

/**
 * Wraps an existing React element so it can be used as a child of a builder.
 *
 * This is the bridge between hand-written JSX components and builder trees:
 *
 * ```ts
 * const existing = <MyFancyButton label="Click" />;
 * const panel = new Builder("Frame")
 *   .addChild(c => Builders.wrapElement(existing, c));
 * ```
 *
 * The wrapped element is appended to the provided builder's children at
 * render time, after any builder children added via `.addChild()`.
 *
 * @param element - A React element (from JSX or createElement).
 * @param parent - The builder to attach the element to.
 * @returns The parent builder for continued chaining.
 */
export function wrapElement(element: unknown, parent: BaseBuilder): BaseBuilder {
	parent.addWrapped(element as defined);
	return parent;
}
