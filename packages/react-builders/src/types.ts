/**
 * Type system for `@nrbx/react-builders`.
 *
 * Defines the serialization format and the `BuilderNode` tree that
 * underpins the builder — everything else in the package builds on these.
 *
 * @module types
 * @packageDocumentation
 */

// Serialized value format (for .toTable() / .fromTable())

/** Serialized Color3. */
export interface SerializedColor3 {
	type: 'Color3';
	r: number;
	g: number;
	b: number;
}

/** Serialized UDim. */
export interface SerializedUDim {
	type: 'UDim';
	scale: number;
	offset: number;
}

/** Serialized UDim2. */
export interface SerializedUDim2 {
	type: 'UDim2';
	xScale: number;
	xOffset: number;
	yScale: number;
	yOffset: number;
}

/** Serialized Vector2. */
export interface SerializedVector2 {
	type: 'Vector2';
	x: number;
	y: number;
}

/** Serialized Rect (min/max as Vector2 pairs). */
export interface SerializedRect {
	type: 'Rect';
	min: SerializedVector2;
	max: SerializedVector2;
}

/** Serialized EnumItem. */
export interface SerializedEnum {
	type: 'Enum';
	enumName: string;
	value: number;
}

/**
 * Union of all JSON-safe value representations produced by `.toTable()`.
 *
 * Scalars (`string`, `number`, `boolean`) pass through unchanged; Roblox
 * value types are boxed into `{ type, ... }` shapes so they survive a
 * `HttpService:JSONEncode` round trip.
 */
export type SerializedValue =
	| string
	| number
	| boolean
	| SerializedColor3
	| SerializedUDim
	| SerializedUDim2
	| SerializedVector2
	| SerializedRect
	| SerializedEnum
	| undefined;

/** JSON-safe property bag: property name → serialized value. */
export type SerializedProperties = Record<string, SerializedValue>;

// Builder tree node

/**
 * A plain-object representation of a single builder node.
 *
 * Both the output of `.toTable()` and the input to `Builders.fromTable()`.
 * The shape is deliberately minimal — `type`, `properties`, `children` —
 * so it maps cleanly onto `React.createElement(type, props, ...children)`.
 */
export interface BuilderNode {
	/** Roblox class name (e.g. `"Frame"`) or a registered custom component key. */
	type: string;
	/** Key-value map of JSON-safe serialized properties. */
	properties: SerializedProperties;
	/** Ordered list of child builder nodes. */
	children: BuilderNode[];
	/** Optional React key for list reconciliation. */
	key?: string;
}
