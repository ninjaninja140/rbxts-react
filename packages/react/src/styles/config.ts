/**
 * Style system configuration.
 *
 * @module styles/config
 * @packageDocumentation
 */

import type { StyleConfig, ResolvedStyleConfig } from './types';
import {
	TAILWIND_COLORS,
	DEFAULT_SPACING,
	DEFAULT_FONT_SIZES,
	DEFAULT_FONT_FAMILIES,
	DEFAULT_BORDER_RADII,
	DEFAULT_Z_INDEX,
} from './tokens';

// Active Configuration

/** The global active style configuration. */
const activeConfig: ResolvedStyleConfig = {
	colors: TAILWIND_COLORS,
	spacing: DEFAULT_SPACING,
	fontSizes: DEFAULT_FONT_SIZES,
	fontFamilies: DEFAULT_FONT_FAMILIES,
	borderRadii: DEFAULT_BORDER_RADII,
	zIndex: DEFAULT_Z_INDEX,
};

/** Returns the current global style configuration (read-only). */
export function getStyleConfig(): ResolvedStyleConfig {
	return activeConfig;
}

// configureStyles

/**
 * Configures the global style system with custom design tokens.
 *
 * ```ts
 * import { configureStyles } from "@nrbx/react";
 *
 * configureStyles({
 *   colors: { brand: { "500": "#6366f1", "600": "#4f46e5" } },
 *   spacing: { 72: 72 },
 *   fontSizes: { huge: 48 },
 * });
 * ```
 *
 * @param config - Partial style configuration to merge with defaults.
 */
export function configureStyles(config: StyleConfig): void {
	if (config.colors) {
		activeConfig.colors = { ...activeConfig.colors, ...config.colors };
	}
	if (config.spacing) {
		activeConfig.spacing = { ...activeConfig.spacing, ...config.spacing };
	}
	if (config.fontSizes) {
		activeConfig.fontSizes = { ...activeConfig.fontSizes, ...config.fontSizes };
	}
	if (config.fontFamilies) {
		activeConfig.fontFamilies = { ...activeConfig.fontFamilies, ...config.fontFamilies };
	}
	if (config.borderRadii) {
		activeConfig.borderRadii = { ...activeConfig.borderRadii, ...config.borderRadii };
	}
	if (config.zIndex) {
		activeConfig.zIndex = { ...activeConfig.zIndex, ...config.zIndex };
	}
}

// createStyleSystem

/**
 * Creates a scoped style system with custom design tokens. Useful for
 * component libraries or sections that need their own token set.
 *
 * ```ts
 * import { createStyleSystem } from "@nrbx/react";
 *
 * const { tw, cn } = createStyleSystem({
 *   colors: { brand: { "500": "#6366f1" } },
 * });
 *
 * // scoped tw uses the custom token set:
 * <frame {...tw("bg-brand-500 p-4")} />
 * ```
 *
 * @param config - Custom style configuration to layer on top of global defaults.
 * @returns An object with scoped `tw`, `cn`, and `resolveClassName` functions.
 */
export function createStyleSystem(config: StyleConfig): {
	tw: (strings: TemplateStringsArray | string, ...values: unknown[]) => Record<string, unknown>;
	cn: (...args: (string | undefined | boolean | 0)[]) => string;
	resolveClassName: (className: string) => Record<string, unknown>;
} {
	const scopedConfig: ResolvedStyleConfig = {
		colors: { ...activeConfig.colors, ...config.colors },
		spacing: { ...activeConfig.spacing, ...config.spacing },
		fontSizes: { ...activeConfig.fontSizes, ...config.fontSizes },
		fontFamilies: { ...activeConfig.fontFamilies, ...config.fontFamilies },
		borderRadii: { ...activeConfig.borderRadii, ...config.borderRadii },
		zIndex: { ...activeConfig.zIndex, ...config.zIndex },
	};

	// We import these lazily to avoid circular deps
	const { resolveClassNameWithConfig } = (require as unknown as (path: string) => unknown)('./parser') as {
		resolveClassNameWithConfig: (cls: string, cfg: ResolvedStyleConfig) => Record<string, unknown>;
	};
	const { cn: baseCn } = (require as unknown as (path: string) => unknown)('./cn') as {
		cn: (...args: (string | undefined | boolean | 0)[]) => string;
	};

	return {
		tw: makeTw(scopedConfig, resolveClassNameWithConfig),
		cn: baseCn,
		resolveClassName: (className: string) => resolveClassNameWithConfig(className, scopedConfig),
	};
}

// makeTw — helper to build a tw function for a given config

function makeTw(
	cfg: ResolvedStyleConfig,
	resolver: (className: string, cfg: ResolvedStyleConfig) => Record<string, unknown>
): (strings: TemplateStringsArray | string, ...values: unknown[]) => Record<string, unknown> {
	return (strings: TemplateStringsArray | string, ...values: unknown[]): Record<string, unknown> => {
		if ((type as unknown as (value: unknown) => string)(strings) === 'string') {
			return resolver(strings as string, cfg);
		}
		// Template literal
		const parts: string[] = [];
		const strs = strings as TemplateStringsArray;
		for (let i = 0; i < strs.size(); i++) {
			parts.push(strs[i]);
			if (i < values.size()) {
				const v = values[i];
				if (v !== undefined && v !== false) {
					parts.push(tostring(v));
				}
			}
		}
		return resolver(parts.join(''), cfg);
	};
}
