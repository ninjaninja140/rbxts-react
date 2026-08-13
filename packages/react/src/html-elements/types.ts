/**
 * Types for the HTML-elements-to-Roblox mapping system.
 *
 * @module html-elements/types
 * @packageDocumentation
 */

/**
 * Configuration for a heading element (h1-h6).
 */
export interface HeadingConfig {
	/** Font enum to use. */
	font: Enum.Font;
	/** Text size in points. */
	size: number;
	/** Optional text color override. */
	color?: Color3;
}

/**
 * Configuration for a special HTML element (p, a, code, pre, etc.).
 */
export interface SpecialElementConfig {
	/** Optional default font. */
	font?: Enum.Font;
	/** Optional default text size. */
	textSize?: number;
	/** Background transparency (defaults to 1 for text elements). */
	backgroundTransparency?: number;
}

/**
 * User-configurable heading overrides.
 */
export interface HeadingOverrides {
	h1?: Partial<HeadingConfig>;
	h2?: Partial<HeadingConfig>;
	h3?: Partial<HeadingConfig>;
	h4?: Partial<HeadingConfig>;
	h5?: Partial<HeadingConfig>;
	h6?: Partial<HeadingConfig>;
}
