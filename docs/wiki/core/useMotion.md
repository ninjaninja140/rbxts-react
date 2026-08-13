# useMotion

`useMotion` and `useSpring` are hooks that provide spring-physics-based animation for Roblox GUI properties. They animate numbers over time using a mass-spring-damper model, running on `RunService.Heartbeat`.

## useSpring

Animate a single numeric value with spring physics:

```tsx
import { useSpring } from "@nrbx/react";

function AnimatedFrame() {
  const offset = useSpring(0, {
    tension: 170,
    friction: 26,
    mass: 1,
  });

  useEffect(() => {
    offset.set(100); // Spring to 100
  }, []);

  // Access current value:
  const x = offset.current();

  return (
    <frame
      Position={new UDim2(0, x, 0, 0)}
      Size={new UDim2(0, 100, 0, 100)}
    />
  );
}
```

## useMotion

Animate multiple numeric values simultaneously:

```tsx
import { useMotion } from "@nrbx/react";

function BouncingBall() {
  const motion = useMotion(
    { x: 0, y: 0, scale: 1 },
    { tension: 120, friction: 14 },
  );

  useEffect(() => {
    motion.set({ x: 200, y: 200, scale: 1.5 });
  }, []);

  const values = motion.current();

  return (
    <frame
      Position={new UDim2(0, values.x, 0, values.y)}
      Size={new UDim2(0, 50 * values.scale, 0, 50 * values.scale)}
      AnchorPoint={new Vector2(0.5, 0.5)}
      className="bg-blue-500 rounded-full"
    />
  );
}
```

## Motion Interface

```ts
interface Motion<T> {
  /** Get the current interpolated value(s). Optionally override alpha. */
  current(alpha?: number): T;

  /** Set the target value(s) — starts the animation. */
  set(target: T): void;

  /** Immediately set value(s) with no animation. */
  jump(target: T): void;

  /** Stop the animation and clean up. */
  destroy(): void;

  /** Whether the animation has settled at the target. */
  readonly isAnimating: boolean;

  /** The current velocity (for advanced use). */
  readonly velocity: number;
}
```

## SpringConfig

```ts
interface SpringConfig {
  /** "spring" (physics) or "tween" (interpolation) */
  type?: "spring" | "tween";

  /** Mass of the simulated object (default 1). Higher = more inertia */
  mass?: number;

  /** Spring stiffness (default 170). Higher = faster, more bouncy */
  tension?: number;

  /** Damping coefficient (default 26). Higher = less bounce */
  friction?: number;

  /** Initial velocity */
  velocity?: number;

  /** For tween type: duration in milliseconds */
  duration?: number;

  /** For tween type: easing style */
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "bounce";
}
```

## Examples

### Hover scale effect:
```tsx
function HoverButton() {
  const scale = useSpring(1, { tension: 300, friction: 20 });

  return (
    <textbutton
      Size={new UDim2(0, 100 * scale.current(), 0, 40 * scale.current())}
      Text="Hover Me"
      onMouseEnter={() => scale.set(1.1)}
      onMouseLeave={() => scale.set(1)}
      className="bg-indigo-500 text-white rounded"
    />
  );
}
```

### Chained animations (with useEffect):
```tsx
function StaggerIn() {
  const opacity = useSpring(0, { tension: 100, friction: 20 });
  const offset = useSpring(-50, { tension: 100, friction: 20 });

  useEffect(() => {
    opacity.set(1);
    offset.set(0);
  }, []);

  return (
    <frame
      Position={new UDim2(0, offset.current(), 0, 0)}
      BackgroundTransparency={1 - opacity.current()}
    >
      <textlabel Text="I slide in and fade!" />
    </frame>
  );
}
```

### Continuous bounce:
```tsx
function Bounce() {
  const bounce = useSpring(0, { tension: 100, friction: 10 });

  useEffect(() => {
    const interval = setInterval(() => {
      bounce.set(-30);
      task.wait(0.3);
      bounce.set(0);
    }, 1);
    return () => clearInterval(interval);
  }, []);

  return (
    <frame Position={new UDim2(0.5, 0, 0, bounce.current())}>
      <textlabel Text="Bouncing!" />
    </frame>
  );
}
```

### Scroll-driven animation:
```tsx
function ParallaxScroll() {
  const scrollY = useSpring(0, { tension: 80, friction: 30 });
  // Connect scrollY.set() to scrolling frame's CanvasPosition.Y
}
```

Cover:
- Spring physics basics
- Tween vs spring
- Performance (one Heartbeat connection per spring)
- Cleanup with destroy()
- Combining springs
- Common animation recipes
- Limitations: no keyframe animations, no Bezier curves for spring
