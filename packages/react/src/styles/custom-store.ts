/**
 * Internal storage for custom CSS rules, resolver, and experimental flags.
 *
 * This file is intentionally dependency-free so it can be imported by both
 * `define-config.ts` and `parser.ts` without creating a circular dependency.
 *
 * @module styles/custom-store
 * @packageDocumentation
 * @internal
 */

/**
 * A map of custom CSS class names to Roblox GUI property tables.
 *
 * Each key is a class name (e.g. `"btn-primary"`) and the value is a table
 * of Roblox instance properties that are merged onto the element when that
 * class name appears in a `className` or `tw()` call.
 */
export interface CSSRules {
	[className: string]: Record<string, unknown>;
}

/**
 * A custom class-name resolver callback.
 *
 * Called for every class-name token that the built-in parser does not recognize.
 * Return a props table to apply those properties, or `undefined` to let the
 * token be ignored silently.
 *
 * @param className - A single class-name token (e.g. `"btn-primary"`, `"animate-spin"`).
 * @returns A table of Roblox GUI properties, or `undefined` if unrecognised.
 */
export type CustomResolver = (className: string) => Record<string, unknown> | undefined;

/**
 * Experimental feature flags for the style system.
 */
export interface ExperimentalFlags {
	/** Enable `relative` and `absolute` position class names. */
	position?: boolean;
	/** Enable CSS Grid equivalents (`grid`, `grid-cols-{n}`, `grid-rows-{n}`). */
	grid?: boolean;
}

/** Custom CSS rules registered via `defineConfig`. */
let customCSSRules: CSSRules = {};

/** Custom resolver registered via `defineConfig`. */
let customResolver: CustomResolver | undefined;

/** Active experimental flags. */
let experimentalFlags: ExperimentalFlags = {};

// Accessors

/** @internal */
export function getCustomCSSRules(): CSSRules {
	return customCSSRules;
}

/** @internal */
export function getCustomResolver(): CustomResolver | undefined {
	return customResolver;
}

/** @internal */
export function getExperimentalFlags(): ExperimentalFlags {
	return experimentalFlags;
}

// Mutators (called by define-config.ts)

/** @internal */
export function setCustomCSSRules(rules: CSSRules): void {
	customCSSRules = rules;
}

/** @internal */
export function setCustomResolver(resolver: CustomResolver | undefined): void {
	customResolver = resolver;
}

/** @internal */
export function setExperimentalFlags(flags: ExperimentalFlags): void {
	experimentalFlags = flags;
}

/** @internal */
export function resetCustomStore(): void {
	customCSSRules = {};
	customResolver = undefined;
	experimentalFlags = {};
}
