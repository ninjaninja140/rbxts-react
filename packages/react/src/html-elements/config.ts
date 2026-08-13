/**
 * Per-element configuration for HTML→Roblox mapping.
 *
 * Provides sensible defaults for heading sizes, special element
 * styling, and a global override API.
 *
 * @module html-elements/config
 * @packageDocumentation
 */

import type { HeadingConfig, HeadingOverrides, SpecialElementConfig } from './types';

// Default heading configurations

/**
 * Default heading configurations (h1 through h6).
 */
export const DEFAULT_HEADINGS: Record<string, HeadingConfig> = {
	h1: { font: Enum.Font.GothamBold, size: 32 },
	h2: { font: Enum.Font.GothamBold, size: 24 },
	h3: { font: Enum.Font.GothamBold, size: 20 },
	h4: { font: Enum.Font.GothamBold, size: 18 },
	h5: { font: Enum.Font.GothamBold, size: 16 },
	h6: { font: Enum.Font.Gotham, size: 14 },
};

// Default special element configurations

/**
 * Default configurations for special elements beyond headings.
 */
export const DEFAULT_SPECIAL_ELEMENTS: Record<string, SpecialElementConfig> = {
	p: {
		font: Enum.Font.Gotham,
		textSize: 14,
		backgroundTransparency: 1,
	},
	span: {
		backgroundTransparency: 1,
	},
	code: {
		font: Enum.Font.Code,
		textSize: 14,
		backgroundTransparency: 0.9,
	},
	pre: {
		font: Enum.Font.Code,
		textSize: 14,
		backgroundTransparency: 0.9,
	},
	a: {
		font: Enum.Font.Gotham,
		textSize: 14,
	},
	label: {
		font: Enum.Font.Gotham,
		textSize: 14,
	},
};

// Mutable runtime state

const headingConfigs: Record<string, HeadingConfig> = { ...DEFAULT_HEADINGS };
const specialElementConfigs: Record<string, SpecialElementConfig> = { ...DEFAULT_SPECIAL_ELEMENTS };

// Public API

/**
 * Override heading configurations (h1 through h6).
 *
 * ```ts
 * import { configureHeadings } from "@nrbx/react";
 *
 * configureHeadings({
 *   h1: { font: Enum.Font.GothamBlack, size: 48 },
 *   h6: { size: 16 },
 * });
 * ```
 *
 * @param overrides - Partial heading configurations to apply.
 */
export function configureHeadings(overrides: HeadingOverrides): void {
	for (const [tag, override] of pairs(overrides as Record<string, Partial<HeadingConfig>>)) {
		if (headingConfigs[tag]) {
			headingConfigs[tag] = { ...headingConfigs[tag], ...override };
		}
	}
}

/**
 * Retrieves the configured heading style for a heading tag.
 *
 * @param tag - The heading tag to look up (e.g., `"h2"`).
 * @returns The heading configuration, or `undefined`.
 */
export function getHeadingConfig(tag: string): HeadingConfig | undefined {
	return headingConfigs[tag];
}

/**
 * Retrieves the special-element configuration for a tag.
 *
 * @param tag - The tag to look up (e.g., `"code"`, `"a"`).
 * @returns The element configuration, or `undefined`.
 */
export function getSpecialElementConfig(tag: string): SpecialElementConfig | undefined {
	return specialElementConfigs[tag];
}

/**
 * Replaces the special-element configuration for a specific tag.
 *
 * @param tag - The tag to configure.
 * @param config - The new configuration.
 */
export function setSpecialElementConfig(tag: string, config: SpecialElementConfig): void {
	specialElementConfigs[tag] = config;
}
