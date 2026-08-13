/**
 * Configuration for the text-as-children system.
 *
 * @module text/config
 * @packageDocumentation
 */

import type { TextChildConfig, TextChildOptions } from './types';

// Default Configuration

const defaultConfig: TextChildConfig = {
	defaults: {
		font: Enum.Font.Gotham,
		textSize: 14,
		textColor: new Color3(1, 1, 1),
		autoSize: true,
		textXAlignment: Enum.TextXAlignment.Left,
		textYAlignment: Enum.TextYAlignment.Center,
		textWrapped: true,
	},
	overrides: {},
};

const activeConfig: TextChildConfig = { ...defaultConfig };

// configureTextChildren

/**
 * Configures the global text-as-children system.
 *
 * ```ts
 * import { configureTextChildren } from "@nrbx/react";
 *
 * configureTextChildren({
 *   defaults: {
 *     font: Enum.Font.Gotham,
 *     textSize: 16,
 *     textColor: Color3.fromRGB(240, 240, 240),
 *   },
 *   overrides: {
 *     TextButton: { textSize: 18, font: Enum.Font.GothamBold },
 *   },
 * });
 * ```
 *
 * @param config - Partial configuration to merge with current settings.
 */
export function configureTextChildren(config: Partial<TextChildConfig>): void {
	if (config.defaults) {
		activeConfig.defaults = { ...activeConfig.defaults, ...config.defaults };
	}
	if (config.overrides) {
		for (const [className, override] of pairs(config.overrides as Record<string, Partial<TextChildOptions>>)) {
			const existing = activeConfig.overrides[className] || {};
			activeConfig.overrides[className] = { ...existing, ...override };
		}
	}
}

// getTextOptions

/**
 * Returns the resolved `TextChildOptions` for a given parent Roblox class.
 *
 * @param parentClassName - The class name of the parent element (e.g. "Frame").
 * @returns The merged options (defaults + per-class overrides).
 */
export function getTextOptions(parentClassName: string): TextChildOptions {
	const override = activeConfig.overrides[parentClassName];
	if (override) {
		return { ...activeConfig.defaults, ...override };
	}
	return activeConfig.defaults;
}

/**
 * Returns the active configuration (for debugging or introspection).
 */
export function getTextConfig(): TextChildConfig {
	return activeConfig;
}
