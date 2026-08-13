/**
 * CSS Animation → Roblox motion utilities.
 *
 * Maps Tailwind animation classes to Roblox tween / spring animations.
 * Integrates with the `useMotion` / `useHoverMotion` hooks for
 * programmatic animation control.
 *
 * ## Supported classes
 *
 * | Class | Effect |
 * |-------|--------|
 * | `animate-spin` | Rotate continuously |
 * | `animate-ping` | Scale pulse (like a notification ping) |
 * | `animate-pulse` | Opacity pulse |
 * | `animate-bounce` | Vertical bounce |
 * | `animate-none` | Disable animation |
 *
 * These are NOT real-time CSS animations — they set animation metadata
 * that gets picked up by `useAnimate` or the motion hooks.
 *
 * @module styles/animations
 * @packageDocumentation
 */

// Animation metadata

/**
 * Animation metadata stored on the Roblox instance so hooks can pick it up.
 *
 * The parser sets defaults (`__animationName`, `__animationDuration`) on the props
 * table. A dedicated `useAnimate` hook (or the existing `useMotion`) reads these
 * and drives the actual animation loop.
 *
 * @public
 */
export interface AnimationMeta {
	/** Which animation to run. */
	name: string;
	/** Duration in seconds. */
	duration: number;
	/** Iteration count (0 = infinite). */
	iterationCount: number;
	/** Timing function (linear, ease-in, ease-out, ease-in-out). */
	timingFunction: string;
	/** Delay before starting, in seconds. */
	delay: number;
}

/**
 * Pre-defined animation presets.
 *
 * @internal
 */
const ANIMATION_PRESETS: Record<string, AnimationMeta> = {
	'animate-spin': {
		name: 'spin',
		duration: 1,
		iterationCount: 0, // infinite
		timingFunction: 'linear',
		delay: 0,
	},
	'animate-ping': {
		name: 'ping',
		duration: 1,
		iterationCount: 0,
		timingFunction: 'ease-out',
		delay: 0,
	},
	'animate-pulse': {
		name: 'pulse',
		duration: 2,
		iterationCount: 0,
		timingFunction: 'ease-in-out',
		delay: 0,
	},
	'animate-bounce': {
		name: 'bounce',
		duration: 1,
		iterationCount: 0,
		timingFunction: 'ease-in-out',
		delay: 0,
	},
};

/**
 * Checks if a class name is a known animation class.
 *
 * @param className - The class name to check.
 * @internal
 */
export function isAnimationClass(className: string): boolean {
	return className in ANIMATION_PRESETS || className === 'animate-none';
}

/**
 * Resolve an animation class to its metadata.
 *
 * @param className - The animation class (e.g. `"animate-spin"`).
 * @returns Animation metadata, or `undefined` for `animate-none`.
 * @internal
 */
export function resolveAnimation(className: string): AnimationMeta | undefined {
	if (className === 'animate-none') return undefined;
	return ANIMATION_PRESETS[className];
}

/**
 * Resolve animation props for a `motion-safe:` or `motion-reduce:` prefix.
 *
 * @param className - The full prefixed class.
 * @returns Animation metadata or `undefined`, and whether to honor the preference.
 * @internal
 */
export function resolveMotionPrefixed(
	className: string
): { animation?: AnimationMeta; reducePreferred: boolean } | undefined {
	const safe = (className as unknown as string).sub(1, 12) === 'motion-safe:';
	if (safe) {
		const animCls = className.sub(12);
		return { animation: resolveAnimation(animCls), reducePreferred: false };
	}
	const reduce = (className as unknown as string).sub(1, 14) === 'motion-reduce:';
	if (reduce) {
		const animCls = className.sub(15);
		return { animation: resolveAnimation(animCls), reducePreferred: true };
	}
	return undefined;
}
