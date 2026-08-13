# Gradients & Animations

`@nrbx/react` includes Tailwind-inspired utilities for styling Roblox GUIs with gradients and lightweight motion effects. These utilities are designed to feel familiar to web developers while still mapping cleanly to Roblox UI objects.

## Gradients

Gradients are applied via `className` using Tailwind-like syntax.

### Direction classes

- `bg-gradient-to-r` — Horizontal gradient (left to right)
- `bg-gradient-to-b` — Vertical gradient (top to bottom)
- `bg-gradient-to-br` — Diagonal gradient (top-left to bottom-right)
- `bg-gradient-to-tr` — Diagonal gradient (bottom-left to top-right)
- `bg-gradient-to-tl` — Diagonal gradient (top-right to bottom-left)
- `bg-gradient-to-bl` — Diagonal gradient (bottom-right to top-left)

### Color stop classes

- `from-{color}-{shade}` — Starting color: `from-blue-500`
- `via-{color}-{shade}` — Middle color: `via-indigo-500`
- `to-{color}-{shade}` — Ending color: `to-purple-500`

### Arbitrary gradient values

- `bg-gradient-[#FF0000,#00FF00,#0000FF]` — Comma-separated hex colors
- `bg-gradient-[rgb(255,0,0),rgb(0,255,0)]` — RGB colors
- `bg-gradient-[Color3.fromRGB(255,0,0),Color3.fromRGB(0,0,255)]` — Roblox `Color3` values in code

### Basic usage

```tsx
<frame className="bg-gradient-to-r from-blue-500 to-purple-600 w-64 h-32 rounded-lg">
  <textlabel Text="Gradient BG" className="text-white font-bold" />
</frame>

<frame className="bg-gradient-to-br from-red-400 via-yellow-400 to-green-400 w-full h-48">
  <textlabel Text="Rainbow!" />
</frame>
```

### How it works

Under the hood, gradients create a `UIGradient` instance and map your color stops to `ColorSequence` keypoints. The direction is translated into the `Rotation` property on the `UIGradient`, which keeps the result fast and consistent with Roblox native rendering.

This means you get familiar class-based configuration without having to manually create gradient data each time.

### Programmatic API

```tsx
import { resolveGradient } from "@nrbx/react";

const gradient = resolveGradient("from-blue-500 to-purple-600 bg-gradient-to-r");
// Returns UIGradient props

// Or create manually:
import { createGradient } from "@nrbx/react";

const gradient = createGradient({
  direction: "to right",
  colors: [
    { color: Color3.fromRGB(59, 130, 246), position: 0 },
    { color: Color3.fromRGB(147, 51, 234), position: 1 },
  ],
});
```

### Gradient performance

`UIGradient` is efficient for Roblox GUI work, especially when used on a small number of large visual elements. It is generally a good fit for backgrounds, hero sections, buttons, and panels that benefit from a single gradient rather than a large number of layered frames.

Use gradients where they add visual clarity, and avoid overusing them across many nested GUI elements in the same screen.

## Animations

Tailwind-style animation classes can be applied directly via `className`.

### Animation classes

- `animate-pulse` — Pulsing opacity (0.5 ↔ 1.0)
- `animate-spin` — Continuous rotation
- `animate-bounce` — Bouncing vertical movement
- `animate-fade-in` — One-shot fade from transparent to opaque
- `animate-slide-up` — One-shot slide from below
- `animate-slide-down` — One-shot slide from above
- `animate-slide-left` — One-shot slide from right
- `animate-slide-right` — One-shot slide from left
- `animate-scale-in` — One-shot scale from 0 to 1

### Timing modifiers

- `duration-{ms}` — Animation duration: `duration-500` = 500ms
- `delay-{ms}` — Animation delay: `delay-200` = 200ms delay
- `ease-linear`, `ease-in`, `ease-out`, `ease-in-out` — Easing functions

### Basic usage

```tsx
<frame className="animate-pulse bg-blue-500 rounded-full w-16 h-16" />

<textlabel
  className="animate-fade-in duration-1000 delay-500"
  Text="I fade in after 500ms!"
/>

<frame className="animate-spin duration-2000 ease-linear">
  <textlabel Text="Loading..." />
</frame>
```

### Programmatic API

```tsx
import { applyAnimation } from "@nrbx/react";

const props = applyAnimation({
  type: "pulse",
  duration: 1000,
  delay: 0,
  easing: "ease-in-out",
  iteration: "infinite", // or a number
});
```

### One-shot vs infinite animations

Some animations are meant to run once and finish, while others are intended to loop continuously.

- `animate-pulse`, `animate-spin`, and `animate-bounce` commonly behave as repeating/infinite animations.
- `animate-fade-in`, `animate-slide-up`, `animate-slide-down`, `animate-slide-left`, `animate-slide-right`, and `animate-scale-in` are typically one-shot transitions.

Use the `iteration` value in the programmatic API to control this behavior:

- `"infinite"` for looping motion
- a number such as `1`, `2`, or `3` for a fixed count

### Custom animation timing

Animation timing is flexible and easy to tune:

```tsx
<frame className="animate-slide-up duration-750 delay-150 ease-out" />
<frame className="animate-scale-in duration-300 ease-in-out" />
<textlabel className="animate-bounce duration-1200 ease-linear" Text="Loading" />
```

The duration and delay values reflect millisecond timing, so `duration-500` means 500ms and `delay-200` means a 200ms pause before the animation begins.

### Combining animations

You can combine animation classes with other Tailwind-like GUI utilities to create layered effects:

```tsx
<frame className="animate-pulse bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-lg duration-1000" />

<textlabel
  className="animate-fade-in animate-scale-in delay-200 duration-700 text-white font-bold"
  Text="Hello"
/>
```

The motion system is intended to compose cleanly with other classes and properties, so a component can be both visually styled and animated without needing custom imperative logic for every effect.

### Animation cleanup on unmount

`@nrbx/react` cleans up animation state when components are unmounted. This prevents lingering Heartbeat listeners, tween state, or animation loops from continuing after the GUI is no longer in use.

This matters in Roblox UI because stale animations can continue consuming resources even when a screen has been removed from the tree.

### Performance considerations

Animations are powerful, but they are not free. Each active animation can create a Heartbeat connection or update loop, so a large number of simultaneous animations can have a measurable cost.

Keep these guidelines in mind:

- prefer a few meaningful animations over dozens of tiny ones
- avoid animating every nested element on a screen at once
- use one-shot transitions for modal and card entrance effects
- reserve continuous animations for things like loading indicators and pulse states
- clean up animation instances when screens unmount

In general: many animations = many Heartbeat connections, so it is best to be selective and intentional.

## Summary

The gradients and animation utilities in `@nrbx/react` provide a familiar, declarative API for Roblox GUI development:

- use class names for directional gradients and color stops
- use arbitrary values for custom gradient color lists
- use animation classes for common UI motion patterns
- tune timing with duration, delay, and easing modifiers
- prefer one-shot animations for entrances and infinite animations for looping effects
- keep animation count reasonable to avoid unnecessary Heartbeat overhead

Together, these utilities let you build polished Roblox interfaces without writing custom tween logic for every visual effect.
