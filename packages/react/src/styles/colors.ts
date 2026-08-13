/**
 * Color utilities — hex conversion, RGB/RGBA parsing, and color lookup.
 *
 * @module styles/colors
 * @packageDocumentation
 */

import type { HexColor } from './types';

/**
 * Converts a hex color string (e.g. `"#3b82f6"`) to a Roblox `Color3`.
 *
 * ```ts
 * const blue = hexToColor3("#3b82f6"); // Color3(0.231, 0.510, 0.965)
 * ```
 *
 * @param hex - A hex color string with or without the `#` prefix.
 * @returns The equivalent `Color3` value.
 */
export function hexToColor3(hex: string): Color3 {
	const stripped = (hex as unknown as string).gsub('#', '')[0] as string;
	const r = tonumber(stripped.sub(1, 2), 16)! / 255;
	const g = tonumber(stripped.sub(3, 4), 16)! / 255;
	const b = tonumber(stripped.sub(5, 6), 16)! / 255;
	return new Color3(r, g, b);
}

/**
 * Parses an arbitrary CSS color value into Roblox properties.
 *
 * Supported formats:
 * - `#ff0000` or `#f00` → `Color3`
 * - `rgb(255, 0, 0)` → `Color3`
 * - `rgba(255, 0, 0, 0.5)` → `Color3` + `Transparency = 1 - alpha`
 * - `hsl(0, 100%, 50%)` → `Color3` (simple HSL→RGB conversion)
 * - `hsla(0, 100%, 50%, 0.5)` → `Color3` + `Transparency`
 *
 * @param value - The arbitrary color string (e.g. `"#ff0000"`, `"rgb(255,0,0)"`).
 * @returns `{ color: Color3, transparency?: number }` or `undefined` if not a color.
 *
 * @public
 */
export function parseArbitraryColor(value: string): { color: Color3; transparency?: number } | undefined {
	if (value.match('^#[%x]+$')[0] !== undefined) {
		return { color: hexToColor3(value) };
	}

	{
		const m = value.match('^rgb%((%d+),%s*(%d+),%s*(%d+)%)$');
		if (m[0] !== undefined) {
			const r = tonumber(m[0] as string)! / 255;
			const g = tonumber(m[1] as string)! / 255;
			const b = tonumber(m[2] as string)! / 255;
			return { color: new Color3(r, g, b) };
		}
	}

	{
		const m = value.match('^rgba%((%d+),%s*(%d+),%s*(%d+),%s*([%d.]+)%)$');
		if (m[0] !== undefined) {
			const r = tonumber(m[0] as string)! / 255;
			const g2 = tonumber(m[1] as string)! / 255;
			const b2 = tonumber(m[2] as string)! / 255;
			const a = tonumber(m[3] as string)!;
			return { color: new Color3(r, g2, b2), transparency: 1 - a };
		}
	}

	{
		const m = value.match('^hsl%((%d+),%s*(%d+)%%,%s*(%d+)%%)$');
		if (m[0] !== undefined) {
			const h = (tonumber(m[0] as string)! % 360) / 360;
			const s = tonumber(m[1] as string)! / 100;
			const l = tonumber(m[2] as string)! / 100;
			return { color: hslToColor3(h, s, l) };
		}
	}

	{
		const m = value.match('^hsla%((%d+),%s*(%d+)%%,%s*(%d+)%%,%s*([%d.]+)%)$');
		if (m[0] !== undefined) {
			const h = (tonumber(m[0] as string)! % 360) / 360;
			const s2 = tonumber(m[1] as string)! / 100;
			const l2 = tonumber(m[2] as string)! / 100;
			const a2 = tonumber(m[3] as string)!;
			return { color: hslToColor3(h, s2, l2), transparency: 1 - a2 };
		}
	}

	return undefined;
}

/**
 * Converts HSL values to a Roblox `Color3`.
 *
 * @param h - Hue (0–1).
 * @param s - Saturation (0–1).
 * @param l - Lightness (0–1).
 * @returns The equivalent `Color3`.
 * @internal
 */
function hslToColor3(h: number, s: number, l: number): Color3 {
	let r: number, g: number, b: number;

	if (s === 0) {
		r = g = b = l;
	} else {
		const hue2rgb = (p: number, q: number, t: number): number => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};

		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}

	return new Color3(r, g, b);
}

/**
 * Parses a CSS length value, stripping the `px` suffix.
 *
 * Supports:
 * - `"100px"` → `100`
 * - `"100"` → `100`
 * - `"0.5"` → `0.5` (kept as-is; caller decides interpretation)
 *
 * @param value - The length string.
 * @returns The numeric value, or `undefined` if not parseable.
 *
 * @public
 */
export function parseArbitraryLength(value: string): number | undefined {
	const stripped = (value as unknown as string).gsub('px$', '')[0] as string;
	const num = tonumber(stripped);
	return num !== undefined ? num : undefined;
}

/**
 * Resolves a Tailwind color class (e.g. `"blue-500"`) to a Roblox `Color3`.
 *
 * Supports:
 * - `"white"` and `"black"` (no shade needed)
 * - `"blue-500"` → Color3 for Tailwind Blue 500
 * - `"red-100"` → Color3 for Tailwind Red 100
 *
 * @param colorKey - The color portion of a Tailwind class (e.g. `"blue-500"`).
 * @param colorMap - The color palette to search.
 * @returns The `Color3` value, or `undefined` if not found.
 */
export function resolveColor(colorKey: string, colorMap: Record<string, Record<string, HexColor>>): Color3 | undefined {
	const parts = colorKey.split('-');
	const colorName = parts[0];
	const shade = parts[1];

	const colorTable = colorMap[colorName];
	if (!colorTable) return undefined;

	// "white" / "black" use the "DEFAULT" key
	if (colorTable.DEFAULT) {
		return hexToColor3(colorTable.DEFAULT);
	}

	if (shade !== undefined && colorTable[shade]) {
		return hexToColor3(colorTable[shade]);
	}

	return undefined;
}
