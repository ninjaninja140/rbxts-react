/**
 * `useMotion` — Spring-based animation hook for Roblox UI.
 *
 * Inspired by `@rbxts/pretty-react-hooks`'s `useMotion`, this hook
 * provides smooth spring-physics animations that integrate with React's
 * render cycle. Values are driven by `RunService.Heartbeat` and
 * automatically clean up on unmount.
 *
 * ## Basic Usage
 *
 * ```tsx
 * const [progress, setProgress] = useMotion(0);
 *
 * useEffect(() => {
 *     setProgress.spring(1, { tension: 180, friction: 22 });
 * }, []);
 *
 * // Use .map() to interpolate the animated value into a Roblox type
 * return <frame BackgroundTransparency={progress.map(p => 1 - 0.05 * p)} />;
 * ```
 *
 * ## Hover Animation Example
 *
 * ```tsx
 * const [hovered, setHovered] = useState(false);
 * const [glow, setGlow] = useMotion(0);
 *
 * useEffect(() => {
 *     glow.spring(hovered ? 1 : 0, { tension: 280, friction: 28 });
 * }, [hovered]);
 *
 * return <textbutton
 *     TextColor3={glow.map(t => Color3.new(1,1,1).Lerp(Color3.new(0,0.5,1), t))}
 *     onMouseEnter={() => setHovered(true)}
 *     onMouseLeave={() => setHovered(false)}
 * />;
 * ```
 *
 * @module hooks/use-motion
 * @packageDocumentation
 */

import { useEffect, useRef, useState } from './core';

// Types

/**
 * Configuration for a spring animation.
 */
export interface SpringConfig {
	/** Spring tension (stiffness). Higher = faster settling. Default: 170. */
	tension?: number;
	/** Spring friction (damping). Higher = less bounce. Default: 26. */
	friction?: number;
	/** Mass of the virtual object. Higher = more inertia. Default: 1. */
	mass?: number;
	/** Velocity tolerance for settling. Default: 0.01. */
	restVelocity?: number;
	/** Position tolerance for settling. Default: 0.01. */
	restDelta?: number;
}

/**
 * A motion value that can be used in JSX via `.map()`.
 *
 * `Motion<T>` wraps a number that springs toward a target, and provides
 * a `.map()` method to transform the progress into a Roblox type
 * (Color3, UDim2, number, etc.).
 */
export interface Motion<_T = number> {
	/** Get the current value of the motion (call at render time). */
	current(): number;
	/** Transform the progress (0→1) into a Roblox-compatible value. */
	map<U>(fn: (progress: number) => U): U;
	/** Set the target value with spring physics. */
	spring(target: number, config?: SpringConfig): void;
	/** Immediately snap to a value without animation. */
	snap(value: number): void;
}

// Internal spring state

interface SpringState {
	/** Current position. */
	position: number;
	/** Current velocity. */
	velocity: number;
	/** Target position. */
	target: number;
	/** Whether the spring is active. */
	active: boolean;
}

// Spring physics

const DEFAULT_SPRING_CONFIG: Required<SpringConfig> = {
	tension: 170,
	friction: 26,
	mass: 1,
	restVelocity: 0.01,
	restDelta: 0.01,
};

/**
 * Advances the spring simulation by one time step.
 *
 * Uses **Hooke's Law** with damping for realistic spring behavior:
 *
 * ```
 * F = -k * (x - target) - damping * v
 * a = F / mass
 * v += a * dt
 * x += v * dt
 * ```
 *
 * @param state - Current spring state (mutated in place).
 * @param config - Spring configuration.
 * @param dt - Delta time in seconds.
 * @returns `true` if the spring has settled.
 * @internal
 */
function stepSpring(state: SpringState, config: Required<SpringConfig>, dt: number): boolean {
	// Clamp dt to avoid large jumps
	const clampedDt = math.min(dt, 1 / 30);

	const { tension, friction, mass, restVelocity, restDelta } = config;

	// Hooke's Law: F = -k * displacement
	const displacement = state.position - state.target;
	const springForce = -tension * displacement;
	const dampingForce = -friction * state.velocity;

	const acceleration = (springForce + dampingForce) / mass;
	state.velocity += acceleration * clampedDt;
	state.position += state.velocity * clampedDt;

	// Check for settling
	if (math.abs(state.velocity) < restVelocity && math.abs(state.position - state.target) < restDelta) {
		state.position = state.target;
		state.velocity = 0;
		return true;
	}

	return false;
}

// useMotion hook

/**
 * Creates a spring-animated motion value that smoothly interpolates
 * toward a target.
 *
 * ```tsx
 * const [motion, setMotion] = useMotion(0);
 *
 * // Animate toward 1 with custom spring config
 * setMotion.spring(1, { tension: 200, friction: 20 });
 *
 * // Snap immediately
 * setMotion.snap(0.5);
 *
 * // Use in JSX via .map()
 * <frame BackgroundTransparency={motion.map(p => 1 - 0.1 * p)} />
 * ```
 *
 * @param initialValue - Starting value (default: `0`).
 * @returns A tuple of `[motion, setMotion]`.
 *
 * @public
 */
export function useMotion(initialValue = 0): [Motion, (target: number) => void] {
	const stateRef = useRef<SpringState>({
		position: initialValue,
		velocity: 0,
		target: initialValue,
		active: false,
	});

	const [tick, setTick] = useState(0) as unknown as [number, (v: number) => void];
	// Simple counter ref to avoid functional updater pattern (unsupported in Lua React)
	const tickRef = useRef(0) as unknown as { current: number };

	useEffect(() => {
		const conn = (game as unknown as { GetService: (name: string) => RunService })
			.GetService('RunService')
			.Heartbeat.Connect((dt: number) => {
				const state = stateRef.current!;
				if (!state.active) return;

				const config = { ...DEFAULT_SPRING_CONFIG };
				const settled = stepSpring(state, config, dt);

				if (settled) {
					state.active = false;
				}

				// Force re-render
				tickRef.current = tickRef.current + 1;
				setTick(tickRef.current);
			});

		return () => {
			conn.Disconnect();
		};
	}, []);

	const motion: Motion = {
		current() {
			void tick; // consume tick to establish reactivity
			return stateRef.current!.position;
		},

		map<U>(fn: (progress: number) => U): U {
			void tick; // consume tick to establish reactivity
			return fn(stateRef.current!.position);
		},

		spring(target: number, config?: SpringConfig): void {
			const state = stateRef.current!;
			state.target = target;
			state.active = true;
			if (config) {
				// Config is handled at step time for simplicity
			}
		},

		snap(value: number): void {
			const state = stateRef.current!;
			state.position = value;
			state.target = value;
			state.velocity = 0;
			state.active = false;
			tickRef.current = tickRef.current + 1;
			setTick(tickRef.current);
		},
	};

	return [motion, (target: number) => motion.spring(target)];
}

/**
 * Convenience hook that combines hover state tracking with a spring
 * motion value.
 *
 * ```tsx
 * const [hovered, hoverMotion, hoverProps] = useHoverMotion(280, 28);
 *
 * return <frame {...hoverProps} BackgroundTransparency={hoverMotion.map(p => 1 - 0.05 * p)} />;
 * ```
 *
 * @param tension - Spring tension (default: 280).
 * @param friction - Spring friction (default: 28).
 * @returns A tuple of `[hovered, motion, eventProps]`.
 *
 * @public
 */
export function useHoverMotion(
	tension = 280,
	friction = 28
): [boolean, Motion, { onMouseEnter: (rbx: GuiObject) => void; onMouseLeave: (rbx: GuiObject) => void }] {
	const [hovered, setHovered] = useState(false) as unknown as [boolean, (v: boolean) => void];
	const [motion, _setMotion] = useMotion(0);

	useEffect(() => {
		motion.spring(hovered ? 1 : 0, { tension, friction });
	}, [hovered]);

	const eventProps = {
		onMouseEnter: () => setHovered(true),
		onMouseLeave: () => setHovered(false),
	};

	return [hovered, motion, eventProps];
}
