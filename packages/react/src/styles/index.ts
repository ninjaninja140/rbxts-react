/**
 * Tailwind-style className system for `@nrbx/react`.
 *
 * Maps Tailwind CSS utility classes to Roblox GUI properties.
 *
 * ## Quick Start
 *
 * ```tsx
 * import { tw, cn } from "@nrbx/react";
 *
 * // Use tw() directly:
 * <frame {...tw("flex flex-col p-4 bg-blue-500 rounded")} />
 *
 * // Or use className + cn():
 * <frame className={cn("flex p-4", isActive && "bg-green-500")} />
 * ```
 *
 * ## Supported Classes
 *
 * - **Layout**: `flex`, `flex-col`, `flex-row`, `hidden`
 * - **Alignment**: `items-center`, `items-start`, `items-end`,
 *   `justify-center`, `justify-start`, `justify-end`, `justify-between`
 * - **Spacing**: `p-{n}`, `px-{n}`, `py-{n}`, `pt-{n}`, `pr-{n}`,
 *   `pb-{n}`, `pl-{n}`, `m-{n}`, `mx-{n}`, `my-{n}`, `gap-{n}`
 * - **Sizing**: `w-full`, `w-screen`, `w-px`, `w-{n}`, `h-full`,
 *   `h-screen`, `h-px`, `h-{n}`
 * - **Colors**: `bg-{color}-{shade}`, `text-{color}-{shade}`
 * - **Typography**: `text-{size}`, `font-{family}`, `font-bold`,
 *   `font-normal`, `italic`, `text-left`, `text-center`, `text-right`
 * - **Borders**: `border`, `border-{n}`, `border-{color}-{shade}`,
 *   `rounded`, `rounded-{size}`
 * - **Effects**: `opacity-{n}`, `z-{n}`, `shadow`, `shadow-sm/md/lg`
 * - **Other**: `overflow-hidden`, `overflow-visible`, `pointer-events-none`
 *
 * @module styles
 * @packageDocumentation
 */

export type { StyleConfig, ResolvedStyleConfig, HexColor } from './types';
export type { CSSRules, CustomResolver, ExperimentalFlags, StyleSystemConfig } from './define-config';
export { cn } from './cn';
export { tw } from './tw';
export { resolveClassName } from './parser';
export { resolveColor, hexToColor3 } from './colors';
export { configureStyles, createStyleSystem, getStyleConfig } from './config';
export {
	defineConfig,
	getCustomCSSRules,
	getCustomResolver,
	getExperimentalFlags,
	resetCustomConfig,
} from './define-config';

// Transforms
export {
	resolveTransform,
	resolveScaleArbitrary,
	resolveRotate,
	resolveRotateArbitrary,
	resolveTranslate,
	resolveTranslateArbitrary,
	resolveSkew,
} from './transforms';

// Gradients
export type { GradientBuilder } from './gradients';
export {
	isGradientDirection,
	getGradientDirection,
	createGradientBuilder,
	applyGradientColor,
	buildGradient,
} from './gradients';

// Animations
export type { AnimationMeta } from './animations';
export { isAnimationClass, resolveAnimation, resolveMotionPrefixed } from './animations';
