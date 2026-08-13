# Motion & Animations

`@nrbx/react` includes a lightweight motion system for Roblox GUIs. It combines spring-driven motion hooks with Tailwind-inspired animation utilities so you can animate UI values, transforms, fades, slides, and presets without writing one-off tween logic for every element.

Use motion hooks when you need physical, continuous animation values like position, scale, opacity, or offsets. Use animation classes when you want declarative visual effects such as pulses, slides, scaling, or hover transforms.

## Motion hooks

### `useSpring(target: number, config?: SpringConfig): Motion<number>`

`useSpring` creates a spring-driven value that smoothly moves toward a target number. It is ideal for animating numeric UI state like X position, size, opacity, or rotation values.

```tsx
const offset = useSpring(0, { tension: 200, friction: 20 });

useEffect(() => {
  offset.set(100);
}, []);
```

### `useMotion(target: MotionTarget, config?: SpringConfig): Motion<MotionValue>`

`useMotion` animates multiple values simultaneously. This is useful when a component needs to move in two dimensions or update several values together.

```tsx
const position = useMotion({ x: 0, y: 0 }, {
  type: "spring",
  mass: 1,
  tension: 180,
  friction: 22,
});

useEffect(() => {
  position.set({ x: 220, y: 120 });
}, []);
```

### `SpringConfig`

```ts
interface SpringConfig {
  type?: "spring" | "tween";
  mass?: number;
  tension?: number;
  friction?: number;
  velocity?: number;
  stiffness?: number;
  damping?: number;
}
```

Options:

- `type`: Choose between spring physics (`"spring"`) and interpolation (`"tween"`).
- `mass`: Spring mass. Higher mass gives more inertia.
- `tension`: Spring stiffness. Higher values produce a snappier response.
- `friction`: Damping. Higher values reduce overshoot and jitter.
- `velocity`: Initial motion velocity for the spring.
- `stiffness`: Roblox `RbxSpring` constraint stiffness.
- `damping`: Roblox `RbxSpring` constraint damping.

Default behavior is a sensible spring profile, but you can tune it for playful UI or faster, more rigid motion.

### `Motion<T>` interface

```ts
interface Motion<T> {
  current(alpha?: number): T;
  set(value: T): void;
  destroy(): void;
  isAnimating: boolean;
}
```

- `current(alpha?)`: Reads the current value. You can optionally pass an alpha override for custom interpolation control.
- `set(value)`: Updates the target immediately without animation.
- `destroy()`: Releases the motion loop and cleans up resources.
- `isAnimating`: Tracks whether the motion is still running.

## Basic usage

```tsx
function AnimatedFrame() {
  const offset = useSpring(0, { tension: 200, friction: 20 });
  const scale = useSpring(1, { type: "tween" });

  useEffect(() => {
    offset.set(100);   // Animate to X=100
    scale.set(1.5);    // Animate to scale 1.5
  }, []);

  return (
    <frame Position={new UDim2(0, offset.current(), 0, 0)} Size={new UDim2(0, 100, 0, 100)} />
  );
}
```

This pattern works well for:

- moving frames and buttons into place
- animating opacity, rotation, and scale
- transitioning motion from user input or state changes
- composing a larger UI animation system without hard-coded tween blocks

## Spring physics explained

The motion hooks use a mass-spring-damper model. In practical terms:

- mass controls inertia
- tension controls stiffness
- friction controls damping
- velocity influences how the spring responds to changes

The spring tries to settle at its target while resisting sudden changes and reducing oscillation. This gives more natural motion than a flat tween because the value keeps reacting to the target over time instead of jumping directly there.

A common mental model is:

- low tension + low friction = slow, soft motion
- high tension + moderate friction = snappy but controlled motion
- very high tension + low friction = over-responsive, potentially bouncy motion

Use `type: "spring"` for natural, physical motion and `type: "tween"` when you want a deterministic interpolation curve.

## Performance considerations

Motion hooks are designed for Roblox GUIs and run on a per-frame loop through `RunService`, which means they are responsive and smooth, but they do carry a cost.

Keep these tips in mind:

- only animate values that actually need to move
- avoid dozens of independent springs updating every frame when a single shared value can be reused
- prefer a few high-quality motion values over many tiny animations
- avoid maintaining huge object graphs of animated values across the lifetime of a screen
- stop or destroy motion when the UI is removed

Because springs run per frame, they are best for continuous, interactive motion rather than one-shot visual flourishes that can be handled by a simple tween or preset class.

## Combining springs with Roblox constraints

Springs pair well with Roblox constraints and dynamic UI behavior. A common pattern is:

- use a spring to drive an exposed value or transform
- pass that value into a position, size, rotation, or layout calculation
- combine it with `AlignPosition`, `HingeConstraint`, or other physical Roblox constraints when you want procedural motion and game physics to work together

This is especially useful for:

- draggable panels
- smooth HUD transitions
- floating widgets that follow player view changes
- layered motion where UI movement is influenced by game-space constraints

The key idea is to use the spring as the high-level animation controller, while Roblox constraints handle deeper physical relationships when needed.

## Hover animation pattern

Hover interactions are a common use case for spring values.

```tsx
function HoverButton() {
  const hoverScale = useSpring(1, { tension: 260, friction: 18 });

  return (
    <textbutton
      Text="Hover me"
      Size={new UDim2(0, 180, 0, 48)}
      AutomaticSize={Enum.AutomaticSize.XY}
      onMouseEnter={() => hoverScale.set(1.08)}
      onMouseLeave={() => hoverScale.set(1)}
      Scale={new Vector3(hoverScale.current(), hoverScale.current(), 1)}
    />
  );
}
```

This pattern is excellent for:

- cards that lift on hover
- icon buttons that react to pointer entry
- subtle focus-state transitions
- complex interactions where state and motion are tightly coupled

## Animation presets

The package includes preset animation classes for common motion patterns:

- `animate-pulse` — pulsing opacity animation
- `animate-spin` — rotating animation (uses rotation)
- `animate-bounce` — bouncing position animation
- `animate-fade-in` — fade from transparent
- `animate-slide-up` — slide from below
- `animate-slide-down` — slide from above
- `animate-slide-left` — slide from right
- `animate-slide-right` — slide from left
- `animate-scale-in` — scale from 0 to 1
- `motion-preset-slide-up` — pre-configured slide-up preset
- `motion-preset-slide-down` — slide-down preset
- `motion-preset-scale-in` — scale-in preset
- `motion-duration-{n}` — animation duration in ms

Example:

```tsx
<div
  className="animate-slide-up motion-duration-350"
  Size={new UDim2(0, 220, 0, 120)}
/>
```

## Tailwind animation classes

The animation utilities are CSS-like and meant to feel familiar to Tailwind users:

```tsx
<frame
  className="animate-scale-in motion-duration-250 hover:scale-110"
  Size={new UDim2(0, 200, 0, 100)}
/>
```

These classes are helpful for simple, declarative motion that doesn't need custom physics or value tracking. They are especially useful for one-off UI transitions, entrances, and quick micro-interactions.

## CSS transforms

Transforms can be applied via `className` or direct props, depending on your usage pattern.

Available transform helpers:

- `scale-{n}` — scale value, e.g. `scale-110` = 1.1×
- `rotate-{n}` — rotation in degrees
- `translate-x-{n}` — X translation in pixels
- `translate-y-{n}` — Y translation in pixels
- `skew-x-{n}` — skew in degrees
- `skew-y-{n}` — skew in degrees
- `hover:scale-110` — scale on hover
- `hover:rotate-45` — rotate on hover

Example:

```tsx
<frame
  className="scale-110 hover:scale-120 rotate-12 translate-x-8"
  Size={new UDim2(0, 180, 0, 80)}
/>
```

This makes it easy to express a direct UI transform without writing manual `Vector3` or `UDim2` logic each time.

## Gradients

Gradients are applied with Tailwind-like class names:

- `from-{color}-{shade}` — gradient start color
- `via-{color}-{shade}` — gradient middle color
- `to-{color}-{shade}` — gradient end color
- `gradient-direction` — examples include `bg-gradient-to-r`, `bg-gradient-to-b`, `bg-gradient-to-br`, `bg-gradient-to-tl`
- `bg-gradient-[...]` — arbitrary gradient values

Example:

```tsx
<div
  className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-600"
  Size={new UDim2(0, 260, 0, 120)}
/>
```

This works well for hero panels, callouts, avatars, or app shells where a richer visual treatment is needed without manual `UIGradient` setup.

## Cleanup and memory management

Motion values should be cleaned up when the component unmounts or when a specific animation is no longer needed.

```tsx
function AnimatedPanel() {
  const motion = useSpring(0, { tension: 150, friction: 18 });

  useEffect(() => {
    motion.set(240);
    return () => motion.destroy();
  }, []);

  return <frame Position={new UDim2(0, motion.current(), 0, 0)} />;
}
```

Best practices:

- call `destroy()` when animations are no longer active
- avoid leaving long-lived motion objects in global state
- clean up event listeners or effect subscriptions alongside the motion
- prefer short-lived spring values for one-off transitions and reuse them only when needed

This keeps the UI free of stale animation loops and prevents memory leaks in long-running Roblox experiences.

## Motion hooks vs Tailwind animation classes

Use motion hooks when you need:

- physics-based animation
- numeric control over position, scale, opacity, and transforms
- values tied directly to game or UI state
- fine-grained control over start, end, and runtime updates

Use Tailwind animation classes when you need:

- quick declarative motion
- class-based styling and composition
- reusable animation presets
- simple hover or entrance effects without custom state logic

In short:

- motion hooks = imperative, data-driven, physics-aware
- animation classes = declarative, UI-visual, preset-based

The two are complementary. A common pattern is to use motion hooks for core interactive movement, and class-based animation utilities for decorative motion or preset transitions.

## Summary

`@nrbx/react` gives you a flexible motion layer for Roblox UI:

- `useSpring` for single-number spring animation
- `useMotion` for multi-value simultaneous motion
- Tailwind-like animation classes for entry and decorative motion
- transform utilities for scale, rotation, and translation
- gradient classes for polished visual treatment

The result is a motion system that feels familiar to web developers while remaining tailored to Roblox GUI constraints and per-frame rendering.
