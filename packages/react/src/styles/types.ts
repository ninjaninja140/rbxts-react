/**
 * Type definitions for the Tailwind-style className system.
 *
 * @module styles/types
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

/** A hex color string like `"#3b82f6"`. */
export type HexColor = string;

/** Configuration for the style system. */
export interface StyleConfig {
	/** Override or extend the color palette. */
	colors?: Record<string, Record<string, HexColor>>;
	/** Spacing scale in pixels (keyed by Tailwind spacing value). */
	spacing?: Record<number, number>;
	/** Font size scale (keyed by label like "xs", "base", "xl"). */
	fontSizes?: Record<string, number>;
	/** Font family mapping (Tailwind name → Roblox font). */
	fontFamilies?: Record<string, Enum.Font>;
	/** Border radius scale (keyed by label like "sm", "md", "lg"). */
	borderRadii?: Record<string, number>;
	/** Z-index scale (keyed by integer level). */
	zIndex?: Record<number, number>;
}

/** Full active style configuration (all properties required). */
export interface ResolvedStyleConfig {
	colors: Record<string, Record<string, HexColor>>;
	spacing: Record<number, number>;
	fontSizes: Record<string, number>;
	fontFamilies: Record<string, Enum.Font>;
	borderRadii: Record<string, number>;
	zIndex: Record<number, number>;
}
