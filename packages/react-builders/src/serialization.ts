/**
 * Property serialization and deserialization for `@nrbx/react-builders`.
 *
 * Converts Roblox value types (Color3, UDim2, Vector2, Enum, Rect) to
 * JSON-safe plain tables so builder trees can be transmitted across the
 * network via `HttpService:JSONEncode/Decode`.
 *
 * ```ts
 * // Serialize
 * const node = builder.toTable();
 * const json = HttpService.JSONEncode(node);
 *
 * // Deserialize
 * const raw = HttpService.JSONDecode(json);
 * const builder = Builders.fromTable(raw);
 * ```
 *
 * @module serialization
 * @packageDocumentation
 */

import type { SerializedValue, BuilderNode } from './types';
import { BaseBuilder } from './base';

// Serialize: Roblox value → JSON-safe representation

/**
 * Converts a Roblox value to its JSON-safe serialized form.
 *
 * | Roblox type | Serialized shape |
 * |---|---|
 * | `Color3` | `{ type: "Color3", r, g, b }` |
 * | `UDim2` | `{ type: "UDim2", xScale, xOffset, yScale, yOffset }` |
 * | `UDim` | `{ type: "UDim", scale, offset }` |
 * | `Vector2` | `{ type: "Vector2", x, y }` |
 * | `Rect` | `{ type: "Rect", min, max }` |
 * | `EnumItem` | `{ type: "Enum", enumName, value }` |
 * | `string`, `number`, `boolean` | passthrough |
 *
 * @returns The serialized value, or `undefined` for unrecognized/unsupported types.
 */
export function serializeProperty(value: unknown): SerializedValue {
	if (typeIs(value, 'string')) return value as string;
	if (typeIs(value, 'number')) return value as number;
	if (typeIs(value, 'boolean')) return value as boolean;

	if (typeIs(value, 'Color3')) {
		const c = value as Color3;
		return { type: 'Color3', r: c.R, g: c.G, b: c.B };
	}

	if (typeIs(value, 'UDim2')) {
		const u = value as UDim2;
		return {
			type: 'UDim2',
			xScale: u.X.Scale,
			xOffset: u.X.Offset,
			yScale: u.Y.Scale,
			yOffset: u.Y.Offset,
		};
	}

	if (typeIs(value, 'UDim')) {
		const u = value as UDim;
		return { type: 'UDim', scale: u.Scale, offset: u.Offset };
	}

	if (typeIs(value, 'Vector2')) {
		const v = value as Vector2;
		return { type: 'Vector2', x: v.X, y: v.Y };
	}

	if (typeIs(value, 'Rect')) {
		const r = value as Rect;
		return {
			type: 'Rect',
			min: { type: 'Vector2', x: r.Min.X, y: r.Min.Y },
			max: { type: 'Vector2', x: r.Max.X, y: r.Max.Y },
		};
	}

	if (typeIs(value, 'EnumItem')) {
		const e = value as EnumItem;
		return { type: 'Enum', enumName: tostring(e.EnumType), value: e.Value };
	}

	return undefined;
}

// Deserialize: JSON-safe representation → Roblox value

/**
 * Reconstructs a Roblox value from its JSON-safe serialized form.
 *
 * Inverse of `serializeProperty()`.
 */
export function deserializeProperty(value: SerializedValue): unknown {
	if (typeIs(value, 'string')) return value as string;
	if (typeIs(value, 'number')) return value as number;
	if (typeIs(value, 'boolean')) return value as boolean;
	if (value === undefined) return undefined;

	if (typeIs(value, 'table')) {
		const tbl = value as unknown as Record<string, unknown>;
		const t = tbl.type as string | undefined;

		if (t === 'Color3') {
			return new Color3(tbl.r as number, tbl.g as number, tbl.b as number);
		}

		if (t === 'UDim2') {
			return new UDim2(tbl.xScale as number, tbl.xOffset as number, tbl.yScale as number, tbl.yOffset as number);
		}

		if (t === 'UDim') {
			return new UDim(tbl.scale as number, tbl.offset as number);
		}

		if (t === 'Vector2') {
			return new Vector2(tbl.x as number, tbl.y as number);
		}

		if (t === 'Rect') {
			const min = tbl.min as Record<string, number>;
			const max = tbl.max as Record<string, number>;
			return new Rect(
				new Vector2(min.x as number, min.y as number),
				new Vector2(max.x as number, max.y as number)
			);
		}

		if (t === 'Enum') {
			const enumObj = (Enum as unknown as Record<string, unknown>)[tbl.enumName as string] as
				| Record<string, EnumItem>
				| undefined;
			if (enumObj) {
				for (const [, item] of pairs(enumObj)) {
					if (item.Value === (tbl.value as number)) return item;
				}
			}
			return undefined;
		}
	}

	return undefined;
}

// fromTable: reconstruct a builder tree

/**
 * Reconstructs a `BaseBuilder` tree from a serialized `BuilderNode`.
 *
 * This is the inverse of `.toTable()` — call it on a client after
 * receiving a JSON-encoded builder tree from a server.
 *
 * ```ts
 * // Server
 * const json = HttpService.JSONEncode(builder.toTable());
 *
 * // Client
 * const node = HttpService.JSONDecode(json);
 * const builder = Builders.fromTable(node);
 * const element = Builders.constructElement(builder);
 * ```
 *
 * @param node - The serialized builder node.
 * @returns A fully reconstructed `BaseBuilder` tree.
 */
export function fromTable(node: BuilderNode): BaseBuilder {
	const builder = new BaseBuilder(node.type);

	if (node.key !== undefined) {
		builder.setKey(node.key);
	}

	for (const [key, value] of pairs(node.properties as Record<string, unknown>)) {
		builder.setProperty(key as string, deserializeProperty(value as SerializedValue));
	}

	for (const child of (node.children as BuilderNode[] | undefined) ?? []) {
		builder.getChildren().push(fromTable(child));
	}

	return builder;
}
