/**
 * `defineConfig` — the one-stop configuration entry point for the entire
 * React-Tailwind styling system.
 *
 * Call `defineConfig()` once at your application entry point (e.g. `src/client/init.client.ts`)
 * to set up your design tokens, custom CSS class names, custom resolvers, and
 * experimental feature flags. Internally it delegates to `configureStyles()` and
 * stores custom rules that the built-in `resolveClassName` parser will consult.
 *
 * ## Quick Start
 *
 * ```ts
 * import { defineConfig } from "@nrbx/react";
 *
 * defineConfig({
 *   // Tailwind design-token overrides / extensions
 *   colors: {
 *     brand: { "500": "#6366f1", "600": "#4f46e5" },
 *   },
 *   spacing: { 72: 72, 84: 84 },
 *
 *   // Custom CSS class name → Roblox property map
 *   css: {
 *     "btn-primary": {
 *       BackgroundColor3: Color3.fromRGB(59, 130, 246),
 *       TextColor3: Color3.fromRGB(255, 255, 255),
 *       Font: Enum.Font.GothamBold,
 *       BorderSizePixel: 0,
 *     },
 *     "card": {
 *       BackgroundColor3: Color3.fromRGB(255, 255, 255),
 *       BorderSizePixel: 1,
 *       BorderColor3: Color3.fromRGB(229, 231, 235),
 *     },
 *   },
 *
 *   // Custom resolver for unsupported class names
 *   resolve(className) {
 *     if (className.match("^animate%-")) {
 *       return { Rotation: 360 };
 *     }
 *     return undefined; // fallback to built-in
 *   },
 *
 *   // Experimental features
 *   experimental: {
 *     position: true,
 *   },
 * });
 * ```
 *
 * @module styles/define-config
 * @packageDocumentation
 */

import type { StyleConfig } from './types';
import {
	setCustomCSSRules,
	setCustomResolver,
	setExperimentalFlags,
	resetCustomStore,
	getCustomCSSRules,
	getExperimentalFlags,
} from './custom-store';

// Re-export types for the public API (defined in custom-store.ts to avoid circular deps)
export type { CSSRules, CustomResolver, ExperimentalFlags } from './custom-store';
// Explicit import for local use in StyleSystemConfig
import type { CSSRules, CustomResolver, ExperimentalFlags } from './custom-store';

// Avoid circular dependency: parser.ts → define-config.ts → config.ts → parser.ts
// We use a dynamic require for configureStyles, same pattern as config.ts uses for parser.ts

/**
 * Full styling system configuration accepted by `defineConfig()`.
 *
 * Extends the standard `StyleConfig` (design tokens) with custom CSS rules,
 * a custom resolver, and experimental feature flags.
 */
export interface StyleSystemConfig extends StyleConfig {
	/**
	 * Custom CSS class-name → Roblox GUI property mappings.
	 *
	 * These are merged into the parser's resolution table and take priority
	 * over built-in Tailwind classes with the same name.
	 */
	css?: CSSRules;

	/**
	 * A custom resolver function that is called for every class-name token
	 * *before* the built-in parser runs. Return a props table to apply
	 * those properties, or `undefined` to fall through to the built-in
	 * resolver and then to custom CSS rules.
	 *
	 * This is the most flexible extension point — use it for vendor-prefixed
	 * utilities, animation classes, or anything not covered by the built-in
	 * parser or `css` rules.
	 */
	resolve?: CustomResolver;

	/** Experimental feature toggles. */
	experimental?: ExperimentalFlags;
}

// defineConfig

/**
 * Configures the global styling system with design tokens, custom CSS
 * class names, custom resolvers, and experimental feature flags.
 *
 * Call this **once** at your application's entry point, before rendering
 * any React elements.
 *
 * `defineConfig` merges its settings with any previously applied configuration,
 * so it is safe to call it multiple times (e.g. from different modules).
 *
 * ```ts
 * // src/client/init.client.ts
 * import { defineConfig, ReactRoblox } from "@nrbx/react";
 *
 * defineConfig({
 *   colors: { brand: { "500": "#6366f1" } },
 *   css: {
 *     "btn-primary": {
 *       BackgroundColor3: Color3.fromRGB(59, 130, 246),
 *       TextColor3: new Color3(1, 1, 1),
 *       BorderSizePixel: 0,
 *     },
 *   },
 *   experimental: { position: true },
 * });
 *
 * const root = ReactRoblox.createRoot(screenGui);
 * root.render(<App />);
 * ```
 *
 * @param config - The full styling system configuration.
 */
export function defineConfig(config: StyleSystemConfig): void {
	// 1. Apply standard design-token overrides (dynamic require to avoid circular deps)
	const { configureStyles } = (require as unknown as (path: string) => unknown)('./config') as {
		configureStyles: (cfg: StyleConfig) => void;
	};
	configureStyles(config);

	// 2. Merge custom CSS rules
	if (config.css) {
		setCustomCSSRules({ ...getCustomCSSRules(), ...config.css });
	}

	// 3. Register custom resolver
	if (config.resolve) {
		setCustomResolver(config.resolve);
	}

	// 4. Apply experimental flags
	if (config.experimental) {
		setExperimentalFlags({ ...getExperimentalFlags(), ...config.experimental });
	}
}

/**
 * Clears all custom configuration (CSS rules, resolver, experimental flags).
 * Does **not** reset design tokens; use `configureStyles()` with explicit
 * overrides for that.
 *
 * Primarily useful in test teardowns.
 *
 * @internal
 */
export function resetCustomConfig(): void {
	resetCustomStore();
}

// Re-export store accessors so the public API remains stable
export { getCustomCSSRules, getCustomResolver, getExperimentalFlags } from './custom-store';
