/**
 * `BaseBuilder<T>` — the core builder class for constructing Roblox UI trees.
 *
 * Works like Discord.js's component builders: method-chained setters
 * populate an internal property map, `.addChild()` nests children, and
 * `.toTable()` dumps a serializable tree.
 *
 * ```ts
 * const panel = Builders.frame()
 *   .setSize(new UDim2(0, 200, 0, 100))
 *   .setBackground("white")
 *   .addChild(c =>
 *     c.setType("TextLabel")
 *      .setText("Hello!")
 *   );
 * ```
 *
 * @module base
 * @packageDocumentation
 */

import type { SerializedProperties, BuilderNode } from './types';
import { serializeProperty } from './serialization';
import { resolveColorValue } from './colors';

// Child builder callback type

/**
 * A function that configures a child builder and returns it.
 *
 * The callback receives a fresh builder (defaulting to `"Frame"`) which
 * you can retype with `.setType()` and configure with shorthand setters.
 *
 * ```ts
 * parent.addChild(c => c.setType("TextLabel").setText("Hi"));
 * ```
 */
export type ChildBuilderCallback = (
	child: BaseBuilder<keyof CreatableInstances>
) => BaseBuilder<keyof CreatableInstances>;

// Class name resolution

/** Lowercase → PascalCase cache, populated lazily from ReflectionService. */
let classCache: Record<string, string> | undefined;

function getClassCache(): Record<string, string> {
	if (classCache) return classCache;
	const result: Record<string, string> = {};
	const classes = (game.GetService('ReflectionService') as ReflectionService).GetClasses();
	for (const className of classes) {
		result[(className as string).lower()] = className as string;
	}
	classCache = result;
	return result;
}

/**
 * Normalizes a class name — accepts lowercase shorthand (`"frame"`) and
 * returns the PascalCase Roblox name (`"Frame"`). Unknown names are passed
 * through unchanged, which is what allows custom component keys.
 */
export function resolveClassName(raw: string): string {
	const lower = raw.lower();
	const cache = getClassCache();
	if (cache[lower] === undefined) {
		// It might already be PascalCase; verify against the known list.
		for (const [, value] of pairs(cache)) {
			if (value === raw) return raw;
		}
	}
	return (cache[lower] as string | undefined) ?? raw;
}

// BaseBuilder

/**
 * Generic builder for any Roblox GUI class.
 *
 * `T` is the class name key from `CreatableInstances` — e.g. `"Frame"`,
 * `"TextLabel"`, `"ImageButton"`. The type system uses this to narrow
 * which properties the typed `.set()` method accepts.
 *
 * **Method chaining:**
 * Every setter returns `this`, so calls chain indefinitely.
 *
 * **Two ways to set properties:**
 * - `.set(key, value)` — fully typed; `key` is narrowed to writable
 *   properties of class `T` and `value` is constrained to the matching type.
 * - Shorthand setters (`setBackground`, `setText`, `setSize`, ...) — cover
 *   the common GUI properties with ergonomic names. Available on every
 *   builder regardless of `T`.
 *
 * **Serialization:**
 * `.toTable()` produces a JSON-safe `BuilderNode` tree that can be sent
 * across the network and rebuilt with `Builders.fromTable()`.
 */
export class BaseBuilder<T extends keyof CreatableInstances = keyof CreatableInstances> {
	/** The Roblox class name, normalized to PascalCase. */
	public className: string;

	/** Internal property map. Keys are Roblox property names. */
	private props: Map<string, unknown> = new Map();

	/** Child builders in insertion order. */
	private children: BaseBuilder[] = [];

	/** Optional React key for list reconciliation. */
	private keyValue: string | undefined;

	/** Pre-built React elements injected as children at render time. */
	private wrappedElements: defined[] = [];

	constructor(className: string) {
		this.className = resolveClassName(className);
	}

	// .set(key, value) — typed property setter

	/**
	 * Sets a single property on the builder.
	 *
	 * `key` is narrowed to the writable properties of the Roblox class `T`,
	 * and `value` is constrained to the matching type.
	 *
	 * ```ts
	 * Builders.frame()
	 *   .set("Size", new UDim2(0, 200, 0, 100))
	 *   .set("BackgroundColor3", new Color3(1, 0, 0));
	 * ```
	 *
	 * @returns `this` for chaining.
	 */
	public set<K extends keyof CreatableInstances[T] & string>(key: K, value: CreatableInstances[T][K]): this {
		this.props.set(key, value as unknown);
		return this;
	}

	/**
	 * Sets a property by raw string key, bypassing type narrowing. Used
	 * internally by `fromTable()` and the React bridge.
	 *
	 * @internal
	 */
	public setProperty(key: string, value: unknown): this {
		this.props.set(key, value);
		return this;
	}

	// Shorthand setters — common GUI properties

	/**
	 * Sets the builder's Roblox class name.
	 *
	 * Call this first on a fresh child builder to retype it, as in the
	 * `addChild` callback pattern:
	 *
	 * ```ts
	 * parent.addChild(c => c.setType("TextLabel").setText("Hi"));
	 * ```
	 */
	public setType(name: string): this {
		this.className = resolveClassName(name);
		return this;
	}

	/** Sets `BackgroundColor3`. Accepts a `Color3` or a color string. */
	public setBackground(value: Color3 | string): this {
		this.props.set('BackgroundColor3', resolveColorValue(value));
		return this;
	}

	/** Sets `BackgroundTransparency` (0 = opaque, 1 = invisible). */
	public setBackgroundTransparency(value: number): this {
		this.props.set('BackgroundTransparency', value);
		return this;
	}

	/** Sets `Size`. */
	public setSize(value: UDim2): this {
		this.props.set('Size', value);
		return this;
	}

	/** Sets `Position`. */
	public setPosition(value: UDim2): this {
		this.props.set('Position', value);
		return this;
	}

	/** Sets `AnchorPoint`. */
	public setAnchorPoint(value: Vector2): this {
		this.props.set('AnchorPoint', value);
		return this;
	}

	/** Sets `Visible`. */
	public setVisible(value: boolean): this {
		this.props.set('Visible', value);
		return this;
	}

	/** Sets `ZIndex`. */
	public setZIndex(value: number): this {
		this.props.set('ZIndex', value);
		return this;
	}

	/** Sets `LayoutOrder`. */
	public setLayoutOrder(value: number): this {
		this.props.set('LayoutOrder', value);
		return this;
	}

	/** Sets `Rotation`. */
	public setRotation(value: number): this {
		this.props.set('Rotation', value);
		return this;
	}

	/** Sets `Transparency` (applies to the whole instance). */
	public setTransparency(value: number): this {
		this.props.set('Transparency', value);
		return this;
	}

	/** Sets `ClipsDescendants`. */
	public setClipsDescendants(value: boolean): this {
		this.props.set('ClipsDescendants', value);
		return this;
	}

	/** Sets `AutomaticSize`. */
	public setAutomaticSize(value: Enum.AutomaticSize): this {
		this.props.set('AutomaticSize', value);
		return this;
	}

	/** Sets `Text`. */
	public setText(value: string): this {
		this.props.set('Text', value);
		return this;
	}

	/** Sets `TextColor3`. Accepts a `Color3` or a color string. */
	public setTextColor(value: Color3 | string): this {
		this.props.set('TextColor3', resolveColorValue(value));
		return this;
	}

	/** Sets `TextSize`. */
	public setTextSize(value: number): this {
		this.props.set('TextSize', value);
		return this;
	}

	/** Sets `TextTransparency`. */
	public setTextTransparency(value: number): this {
		this.props.set('TextTransparency', value);
		return this;
	}

	/** Sets `Font`. */
	public setFont(value: Enum.Font): this {
		this.props.set('Font', value);
		return this;
	}

	/** Sets `TextWrapped`. */
	public setTextWrapped(value: boolean): this {
		this.props.set('TextWrapped', value);
		return this;
	}

	/** Sets `TextXAlignment`. */
	public setTextXAlignment(value: Enum.TextXAlignment): this {
		this.props.set('TextXAlignment', value);
		return this;
	}

	/** Sets `TextYAlignment`. */
	public setTextYAlignment(value: Enum.TextYAlignment): this {
		this.props.set('TextYAlignment', value);
		return this;
	}

	/** Sets `TextTruncate`. */
	public setTextTruncate(value: Enum.TextTruncate): this {
		this.props.set('TextTruncate', value);
		return this;
	}

	/** Sets `RichText`. */
	public setRichText(value: boolean): this {
		this.props.set('RichText', value);
		return this;
	}

	/** Sets `TextScaled`. */
	public setTextScaled(value: boolean): this {
		this.props.set('TextScaled', value);
		return this;
	}

	/** Sets `BorderSizePixel`. */
	public setBorderSizePixel(value: number): this {
		this.props.set('BorderSizePixel', value);
		return this;
	}

	/** Sets `BorderColor3`. Accepts a `Color3` or a color string. */
	public setBorderColor(value: Color3 | string): this {
		this.props.set('BorderColor3', resolveColorValue(value));
		return this;
	}

	/** Sets `Image` (asset id string). */
	public setImage(value: string): this {
		this.props.set('Image', value);
		return this;
	}

	/** Sets `ImageColor3`. Accepts a `Color3` or a color string. */
	public setImageColor(value: Color3 | string): this {
		this.props.set('ImageColor3', resolveColorValue(value));
		return this;
	}

	/** Sets `ImageTransparency`. */
	public setImageTransparency(value: number): this {
		this.props.set('ImageTransparency', value);
		return this;
	}

	/** Sets `ScaleType`. */
	public setScaleType(value: Enum.ScaleType): this {
		this.props.set('ScaleType', value);
		return this;
	}

	/** Sets `SliceCenter`. */
	public setSliceCenter(value: Rect): this {
		this.props.set('SliceCenter', value);
		return this;
	}

	/** Sets `SliceScale`. */
	public setSliceScale(value: number): this {
		this.props.set('SliceScale', value);
		return this;
	}

	/** Sets `Active`. */
	public setActive(value: boolean): this {
		this.props.set('Active', value);
		return this;
	}

	/** Sets `Selectable`. */
	public setSelectable(value: boolean): this {
		this.props.set('Selectable', value);
		return this;
	}

	/** Sets `AutoButtonColor`. */
	public setAutoButtonColor(value: boolean): this {
		this.props.set('AutoButtonColor', value);
		return this;
	}

	/** Sets `Modal`. */
	public setModal(value: boolean): this {
		this.props.set('Modal', value);
		return this;
	}

	// .addChild() / .addChildComponent()

	/**
	 * Appends a child builder.
	 *
	 * Accepts either a pre-built `BaseBuilder` instance or a callback that
	 * receives a fresh builder (defaulting to `"Frame"`).
	 *
	 * ```ts
	 * // Pre-built child
	 * parent.addChild(Builders.textLabel().setText("Hi"));
	 *
	 * // Callback style — more ergonomic
	 * parent.addChild(c => c.setType("TextLabel").setText("Hi"));
	 * ```
	 *
	 * @returns `this` for chaining.
	 */
	public addChild(child: BaseBuilder | ChildBuilderCallback): this {
		if (typeIs(child, 'function')) {
			const fresh = new BaseBuilder('Frame');
			const result = (child as ChildBuilderCallback)(fresh);
			this.children.push(result);
		} else {
			this.children.push(child as BaseBuilder);
		}
		return this;
	}

	/**
	 * Alias for `addChild()`, named to match Discord.js's
	 * `addComponents()` terminology.
	 */
	public addChildComponent(child: BaseBuilder | ChildBuilderCallback): this {
		return this.addChild(child);
	}

	/**
	 * Appends multiple children at once.
	 *
	 * ```ts
	 * parent.addChildren(
	 *   Builders.textLabel().setText("A"),
	 *   Builders.textLabel().setText("B"),
	 * );
	 * ```
	 */
	public addChildren(...children: BaseBuilder[]): this {
		for (const child of children) {
			this.children.push(child);
		}
		return this;
	}

	/** Returns the ordered list of child builders. */
	public getChildren(): BaseBuilder[] {
		return this.children;
	}

	/**
	 * Attaches an already-constructed React element so it is appended as a
	 * child when the builder is converted with `constructElement()`.
	 *
	 * Used internally by `Builders.wrapElement()`.
	 *
	 * @internal
	 */
	public addWrapped(element: defined): this {
		this.wrappedElements.push(element);
		return this;
	}

	/**
	 * Returns the React elements attached via `addWrapped()`.
	 *
	 * @internal
	 */
	public getWrapped(): defined[] {
		return this.wrappedElements;
	}

	// .setKey() — React key

	/**
	 * Sets the React key for this builder node. Translates directly to
	 * `key` in the generated `React.createElement` call.
	 */
	public setKey(key: string): this {
		this.keyValue = key;
		return this;
	}

	/** Returns the React key, or undefined. */
	public getKey(): string | undefined {
		return this.keyValue;
	}

	// .get() / .has() — property reads

	/** Reads a previously set property. Returns `undefined` if not set. */
	public get(key: string): unknown {
		return this.props.get(key);
	}

	/** Returns true if a property has been explicitly set. */
	public has(key: string): boolean {
		return this.props.has(key);
	}

	/**
	 * Returns a read-only view of all stored properties as a Map.
	 * Used internally by serialization and the React bridge.
	 *
	 * @internal
	 */
	public getProperties(): ReadonlyMap<string, unknown> {
		return this.props;
	}

	// .clone() — deep copy

	/** Creates a deep clone of this builder, including all children. */
	public clone(): BaseBuilder<T> {
		const copy = new BaseBuilder<T>(this.className);
		copy.keyValue = this.keyValue;
		for (const [key, value] of this.props) {
			copy.props.set(key, value);
		}
		for (const child of this.children) {
			copy.children.push(child.clone());
		}
		for (const wrapped of this.wrappedElements) {
			copy.wrappedElements.push(wrapped);
		}
		return copy;
	}

	// .merge() — bulk property merge

	/**
	 * Merges properties from a plain object into this builder.
	 *
	 * ```ts
	 * builder.merge({ Size: new UDim2(0, 100, 0, 100), Visible: false });
	 * ```
	 */
	public merge(source: Record<string, unknown>): this {
		for (const [key, value] of pairs(source)) {
			this.props.set(key as string, value);
		}
		return this;
	}

	// .toTable() — serialization

	/**
	 * Serializes the entire builder tree into a `BuilderNode` — a plain
	 * Lua table that can be JSON-encoded and sent over the network.
	 *
	 * Every property value is converted to a JSON-safe representation
	 * (Color3 → `{ type: "Color3", r, g, b }`, etc.) via
	 * `serializeProperty()`.
	 *
	 * ```ts
	 * const node = builder.toTable();
	 * const json = HttpService:JSONEncode(node);
	 * // ... send to client ...
	 * const restored = HttpService:JSONDecode(json);
	 * const builder2 = Builders.fromTable(restored);
	 * ```
	 */
	public toTable(): BuilderNode {
		const properties: SerializedProperties = {};
		for (const [key, value] of this.props) {
			properties[key] = serializeProperty(value);
		}

		const children: BuilderNode[] = [];
		for (const child of this.children) {
			children.push(child.toTable());
		}

		const node: BuilderNode = {
			type: this.className,
			properties,
			children,
		};
		if (this.keyValue !== undefined) {
			node.key = this.keyValue;
		}
		return node;
	}
}
