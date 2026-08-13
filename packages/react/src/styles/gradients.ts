/**
 * CSS Gradient → Roblox UIGradient utilities.
 *
 * Maps Tailwind gradient classes to Roblox `UIGradient` children.
 *
 * ## Supported classes
 *
 * | Class | Roblox Mapping |
 * |-------|---------------|
 * | `bg-gradient-to-r` | UIGradient with horizontal direction |
 * | `bg-gradient-to-b` | UIGradient with vertical direction |
 * | `bg-gradient-to-t` | UIGradient reversed vertical |
 * | `bg-gradient-to-l` | UIGradient reversed horizontal |
 * | `bg-gradient-to-tr` | UIGradient diagonal (top-right) |
 * | `bg-gradient-to-tl` | UIGradient diagonal (top-left) |
 * | `bg-gradient-to-br` | UIGradient diagonal (bottom-right) |
 * | `bg-gradient-to-bl` | UIGradient diagonal (bottom-left) |
 * | `from-[color]` | Start color of gradient |
 * | `to-[color]` | End color of gradient |
 * | `via-[color]` | Midpoint color |
 *
 * @module styles/gradients
 * @packageDocumentation
 */

import { resolveColor, parseArbitraryColor } from './colors';

// Gradient direction map

/** Maps Tailwind gradient direction to the corresponding Roblox UIGradient Rotation. */
const GRADIENT_DIRECTION_MAP: Record<string, number> = {
	'bg-gradient-to-r': 0, // Left → Right (horizontal)
	'bg-gradient-to-t': 90, // Bottom → Top
	'bg-gradient-to-l': 180, // Right → Left
	'bg-gradient-to-b': 270, // Top → Bottom
	'bg-gradient-to-tr': 45, // Bottom-Left → Top-Right
	'bg-gradient-to-tl': 135, // Bottom-Right → Top-Left
	'bg-gradient-to-br': 315, // Top-Left → Bottom-Right
	'bg-gradient-to-bl': 225, // Top-Right → Bottom-Left
};

/**
 * Checks if a class name is a gradient direction.
 *
 * @param className - The class name to check.
 * @returns `true` if it matches a gradient direction.
 * @internal
 */
export function isGradientDirection(className: string): boolean {
	return GRADIENT_DIRECTION_MAP[className] !== undefined;
}

/**
 * Get the gradient direction rotation for a class name.
 *
 * @param className - The class name (e.g. `"bg-gradient-to-r"`).
 * @returns Roblox gradient Rotation value, or `undefined`.
 * @internal
 */
export function getGradientDirection(className: string): number | undefined {
	return GRADIENT_DIRECTION_MAP[className];
}

// Gradient builder

/**
 * State tracking for building a gradient across multiple class names.
 *
 * @internal
 */
export interface GradientBuilder {
	/** Whether a gradient direction has been set. */
	active: boolean;
	/** The rotation for the gradient. */
	rotation: number;
	/** The start color. */
	fromColor?: Color3;
	/** The start color transparency. */
	fromTransparency?: number;
	/** The end color. */
	toColor?: Color3;
	/** The end color transparency. */
	toTransparency?: number;
	/** The midpoint color. */
	viaColor?: Color3;
	/** The midpoint color transparency. */
	viaTransparency?: number;
}

/**
 * Create a new gradient builder.
 *
 * @internal
 */
export function createGradientBuilder(): GradientBuilder {
	return {
		active: false,
		rotation: 270, // default: top to bottom
	};
}

/**
 * Parse a `from-[color]`, `to-[color]`, or `via-[color]` arbitrary value
 * and update the gradient builder.
 *
 * @param prefix - `"from"`, `"to"`, or `"via"`.
 * @param value - The color value (hex, rgb, rgba, named color, etc.)
 * @param builder - The gradient builder to update.
 * @returns `false` if the value couldn't be parsed, `true` if it was applied.
 * @internal
 */
export function applyGradientColor(
	prefix: string,
	value: string,
	builder: GradientBuilder,
	colorMap: Record<string, Record<string, string>>
): boolean {
	let color3: Color3 | undefined;
	let transparency: number | undefined;

	// Try named color first
	const named = resolveColor(value, colorMap);
	if (named !== undefined) {
		// resolveColor returns Color3
		const namedC3 = named as unknown as { R: number; G: number; B: number };
		color3 = new Color3(namedC3.R, namedC3.G, namedC3.B);
		transparency = 0;
	} else {
		// Try arbitrary (hex, rgb, etc.)
		const arb = parseArbitraryColor(value);
		if (arb) {
			color3 = arb.color;
			transparency = arb.transparency;
		}
	}

	if (color3 === undefined) return false;

	// Apply to builder
	switch (prefix) {
		case 'from':
			builder.fromColor = color3;
			builder.fromTransparency = transparency;
			break;
		case 'to':
			builder.toColor = color3;
			builder.toTransparency = transparency;
			break;
		case 'via':
			builder.viaColor = color3;
			builder.viaTransparency = transparency;
			break;
	}

	return true;
}

/**
 * Build the final UIGradient style child from a gradient builder.
 *
 * @param builder - The gradient builder.
 * @returns A UIGradient style child config, or `undefined` if the builder isn't active.
 * @internal
 */
export function buildGradient(builder: GradientBuilder): Record<string, unknown> | undefined {
	if (!builder.active) return undefined;

	const gradientConfig: Record<string, unknown> = {
		__className: 'UIGradient',
		Rotation: builder.rotation,
	};

	if (builder.fromColor) {
		gradientConfig.Color = new ColorSequence([
			new ColorSequenceKeypoint(0, builder.fromColor),
			new ColorSequenceKeypoint(1, builder.toColor ?? new Color3(1, 1, 1)),
		] as unknown as ColorSequenceKeypoint[]);
	}
	if (builder.fromTransparency !== undefined || builder.toTransparency !== undefined) {
		gradientConfig.Transparency = new NumberSequence([
			new NumberSequenceKeypoint(0, builder.fromTransparency ?? 0),
			new NumberSequenceKeypoint(1, builder.toTransparency ?? builder.fromTransparency ?? 0),
		] as unknown as NumberSequenceKeypoint[]);
	}

	return gradientConfig;
}
