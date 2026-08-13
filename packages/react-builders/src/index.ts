/**
 * `@nrbx/react-builders` — Discord.js-style component builders for Roblox React.
 *
 * Build UI trees with method chaining, serialize them to JSON-safe tables
 * for network transmission, and convert them to React elements for rendering.
 *
 * ## Quick Start
 *
 * ```ts
 * import { Frame } from "@nrbx/react-builders";
 * import { Builders } from "@nrbx/react-builders";
 *
 * const panel = new Frame()
 *   .setBackground(Color3.fromRGB(255, 255, 255))
 *   .setSize(new UDim2(0, 200, 0, 100))
 *   .addChildComponent(c =>
 *     c.setType("TextLabel").setText("Hello World").setTextSize(24),
 *   );
 *
 * // Render directly
 * const element = Builders.constructElement(panel);
 * root.render(element);
 *
 * // Or serialize for network
 * const json = HttpService.JSONEncode(panel.toTable());
 * ```
 *
 * ## Server → Client Pattern
 *
 * ```ts
 * // Server
 * const tree = new Frame()
 *   .setSize(new UDim2(1, 0, 1, 0))
 *   .addChild(c => c.setType("TextLabel").setText("From server!"));
 *
 * remote.FireClient(player, tree.toTable());
 *
 * // Client
 * remote.OnClientEvent.Connect(node => {
 *   const element = Builders.createElementFromTable(node);
 *   root.render(element);
 * });
 * ```
 *
 * @module react-builders
 * @packageDocumentation
 */

import { BaseBuilder, resolveClassName } from './base';
import type { ChildBuilderCallback } from './base';
import type { BuilderNode } from './types';
import {
	constructElement,
	createElementFromTable,
	wrapElement,
	registerComponent,
	unregisterComponent,
	getRegisteredComponents,
} from './react';
import { fromTable } from './serialization';
import {
	Frame,
	TextLabel,
	TextButton,
	TextBox,
	ImageLabel,
	ImageButton,
	ScrollingFrame,
	CanvasGroup,
	ViewportFrame,
	UIListLayout,
	UIGridLayout,
	UIPageLayout,
	UITableLayout,
	UIPadding,
	UICorner,
	UIStroke,
	UIGradient,
	UIAspectRatioConstraint,
	UISizeConstraint,
	UITextSizeConstraint,
} from './elements';

// Re-exports

export { BaseBuilder, resolveClassName };
export { fromTable };
export {
	constructElement,
	createElementFromTable,
	wrapElement,
	registerComponent,
	unregisterComponent,
	getRegisteredComponents,
};
export {
	Frame,
	TextLabel,
	TextButton,
	TextBox,
	ImageLabel,
	ImageButton,
	ScrollingFrame,
	CanvasGroup,
	ViewportFrame,
	UIListLayout,
	UIGridLayout,
	UIPageLayout,
	UITableLayout,
	UIPadding,
	UICorner,
	UIStroke,
	UIGradient,
	UIAspectRatioConstraint,
	UISizeConstraint,
	UITextSizeConstraint,
};

export type { BuilderNode, ChildBuilderCallback };

// Builders namespace

/**
 * The `Builders` namespace — the primary API surface of `@nrbx/react-builders`.
 *
 * Import it once and use it everywhere:
 *
 * ```ts
 * import { Builders } from "@nrbx/react-builders";
 *
 * const frame = new Builders.Frame();
 * const label = new Builders.TextLabel().setText("Hi");
 * ```
 */
export const Builders = {
	/** Generic builder for any Roblox class name: `new Builders.Builder("Frame")`. */
	Builder: BaseBuilder,

	/**
	 * Reconstruct a builder tree from a serialized `BuilderNode`.
	 *
	 * ```ts
	 * const node = HttpService.JSONDecode(json);
	 * const builder = Builders.fromTable(node);
	 * ```
	 */
	fromTable,

	/**
	 * Convert a builder tree into a React element for rendering.
	 *
	 * ```ts
	 * const element = Builders.constructElement(builder);
	 * root.render(element);
	 * ```
	 */
	constructElement,

	/**
	 * Deserialize a `BuilderNode` and immediately create a React element.
	 * Combines `fromTable` + `constructElement` into one call.
	 */
	createElementFromTable,

	/**
	 * Embed an existing React element (from JSX or `createElement`) into
	 * a builder tree as a child.
	 *
	 * ```ts
	 * const btn = <MyButton label="OK" />;
	 * const panel = new Frame().addChild(c => Builders.wrapElement(btn, c));
	 * ```
	 */
	wrapElement,

	/**
	 * Register a custom React component so builders can reference it by name.
	 *
	 * ```ts
	 * Builders.registerComponent("MyCard", MyCardComponent);
	 * new Builders.Builder("MyCard").set("title", "Hello");
	 * ```
	 */
	registerComponent,

	/** Remove a previously registered component. */
	unregisterComponent,

	/** List all registered component keys. */
	getRegisteredComponents,

	/** `Frame` builder class. */
	Frame,

	/** `TextLabel` builder class. */
	TextLabel,

	/** `TextButton` builder class. */
	TextButton,

	/** `TextBox` builder class. */
	TextBox,

	/** `ImageLabel` builder class. */
	ImageLabel,

	/** `ImageButton` builder class. */
	ImageButton,

	/** `ScrollingFrame` builder class. */
	ScrollingFrame,

	/** `CanvasGroup` builder class. */
	CanvasGroup,

	/** `ViewportFrame` builder class. */
	ViewportFrame,

	/** `UIListLayout` builder class. */
	UIListLayout,

	/** `UIGridLayout` builder class. */
	UIGridLayout,

	/** `UIPageLayout` builder class. */
	UIPageLayout,

	/** `UITableLayout` builder class. */
	UITableLayout,

	/** `UIPadding` builder class. */
	UIPadding,

	/** `UICorner` builder class. */
	UICorner,

	/** `UIStroke` builder class. */
	UIStroke,

	/** `UIGradient` builder class. */
	UIGradient,

	/** `UIAspectRatioConstraint` builder class. */
	UIAspectRatioConstraint,

	/** `UISizeConstraint` builder class. */
	UISizeConstraint,

	/** `UITextSizeConstraint` builder class. */
	UITextSizeConstraint,
} as const;

/** The type of the `Builders` export object. */
export type BuildersNamespace = typeof Builders;
