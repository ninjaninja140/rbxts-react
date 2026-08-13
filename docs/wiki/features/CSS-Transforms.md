# CSS Transforms

`@nrbx/react` includes CSS-like transform utilities for Roblox GUIs. They let you scale, rotate, translate, skew, and reposition elements without manually writing repeated `Size`, `Position`, `Rotation`, and `AnchorPoint` logic.

These utilities are designed to feel familiar to Tailwind and CSS users, but they resolve into Roblox GUI properties.

## How transforms work

Transforms are applied either through the `transform` prop or through a `className` string.

Internally, the runtime maps transform utilities to Roblox properties such as:

- `Size` for scale
- `Position` for translation
- `Rotation` for rotation
- `AnchorPoint` for transform origin

A transform origin changes the pivot point used when scaling or rotating. That is why a transform can appear to grow from a corner, center, or edge instead of always expanding from the middle of the element.

Multiple transform utilities compose together. For example, a widget can be scaled, rotated, and offset at once while keeping the overall visual hierarchy consistent.

## Supported transforms

### Scale

- `scale-{n}` — Scale the element by a percentage. `scale-110` = 1.1× size.
- `scale-x-{n}` — Scale X only.
- `scale-y-{n}` — Scale Y only.

```tsx
<frame className="scale-110 bg-blue-500 rounded">
  <textlabel Text="Scaled up" />
</frame>

<frame className="scale-x-125 scale-y-90 bg-red-500">
  <textlabel Text="Wide and short" />
</frame>
```

### Rotation

- `rotate-{n}` — Rotate by degrees. `rotate-45` = 45°.

```tsx
<frame className="rotate-45 bg-green-500 rounded">
  <textlabel Text="Rotated" />
</frame>
```

### Translation

- `translate-x-{n}` — Translate in X by pixels. `translate-x-50` = 50px right.
- `translate-y-{n}` — Translate in Y by pixels. Positive values move down; negative values move up.
- `translate-y-neg-20` = -20px = 20px up.

```tsx
<frame className="translate-x-50 translate-y-neg-20 bg-red-500">
  <textlabel Text="Offset" />
</frame>
```

### Skew

- `skew-x-{n}` — Shear in the X direction.
- `skew-y-{n}` — Shear in the Y direction.

```tsx
<frame className="skew-x-12 skew-y-8 bg-yellow-500 rounded">
  <textlabel Text="Skewed" />
</frame>
```

### Transform origin

- `transform-origin-{keyword}` — Set the transform pivot point.
- Supported keywords:
  - `center`
  - `top-left`
  - `top-right`
  - `bottom-left`
  - `bottom-right`

```tsx
<frame className="transform-origin-top-left scale-110 bg-purple-500 rounded">
  <textlabel Text="Grows from the corner" />
</frame>

<frame className="transform-origin-bottom-right rotate-20 bg-orange-500 rounded">
  <textlabel Text="Rotates from the corner" />
</frame>
```

This is the equivalent of setting the element's `AnchorPoint` based on the origin. For example:

- `center` -> `(0.5, 0.5)`
- `top-left` -> `(0, 0)`
- `top-right` -> `(1, 0)`
- `bottom-left` -> `(0, 1)`
- `bottom-right` -> `(1, 1)`

Transform origin matters when you want a card to zoom out from its corner, a modal to scale around its center, or a button to rotate around a specific edge.

## Hover transforms

Hover variants are useful for simple interaction states such as lifting a card, scaling a button, or subtly nudging an icon.

Supported hover patterns include:

- `hover:scale-{n}`
- `hover:rotate-{n}`
- `hover:translate-x-{n}`
- `hover:translate-y-{n}`

```tsx
<textbutton
  className="bg-blue-500 hover:scale-110 hover:rotate-3 transition-transform"
  Text="Hover me!"
  onClick={() => print("clicked")}
/>
```

This is ideal for:

- button hover states
- card lift effects
- icon emphasis
- compact motion without a dedicated animation system

### Hover button example

```tsx
<textbutton
  className="bg-blue-500 text-white hover:scale-105 hover:translate-y-neg-2 rounded"
  Text="Get started"
/>
```

### Hover card example

```tsx
<frame className="bg-white rounded-xl p-4 hover:scale-105 hover:translate-y-neg-4">
  <textlabel Text="Product card" />
</frame>
```

## Basic usage

```tsx
<frame className="scale-110 rotate-45 bg-blue-500 rounded">
  <textlabel Text="Transformed!" />
</frame>
```

```tsx
<frame className="translate-x-50 translate-y-neg-20 bg-red-500">
  <textlabel Text="Offset" />
</frame>
```

```tsx
<frame className="scale-x-120 scale-y-80 rotate-12 bg-green-500 rounded">
  <textlabel Text="Combined transforms" />
</frame>
```

## Combining transforms

The real power of transform utilities comes from combining them. You can layer scale, rotation, translation, and skew to create expressive UI states without writing custom property logic each time.

```tsx
<frame className="scale-110 rotate-15 translate-x-12 translate-y-neg-8 skew-y-6 bg-purple-500 rounded">
  <textlabel Text="Multi-transform card" />
</frame>
```

This is useful when you want:

- a button that scales and rotates slightly on hover
- a modal that appears from above while shrinking into place
- a panel that shifts and rotates to indicate focus or selection
- a decorative element that lifts, skews, and scales without affecting layout too much

As with CSS transforms, the values are composed into a single transform state. The result is not a full animation system by itself, but it is a lightweight and readable way to express visual movement.

## Programmatic API

If you need to construct a transform object in code, use `applyTransform`.

```tsx
import { applyTransform } from "@nrbx/react";

const props = applyTransform({
  scale: 1.1,
  rotation: 45,
  translateX: 50,
  translateY: -20,
  origin: "center",
});

// props: { Size, Position, Rotation, AnchorPoint, ... }
```

This is useful when the transform values are computed from state, user input, or animation logic. For example, a spring or drag value can be mapped into `scale`, `translateX`, or `rotation` before the component renders.

## Performance and layout impact

Transforms are fast and ergonomic, but they are not free.

Because the runtime maps transforms to Roblox `Size` and `Position` values, some transform changes may trigger layout recalculations. That means:

- large numbers of transformed elements can cost more than a small number of static elements
- hover transforms on many cards or buttons can become expensive if they are repeated in a large list
- layout-sensitive widgets may need careful use of `transform-origin` to avoid visual jitter

Use transforms for:

- card hover states
- button emphasis
- modal entrances
- subtle focus accents

Avoid using them for:

- large lists with dozens of animated items at once
- heavy per-frame transformations on deeply nested UI trees
- layout-critical states where the element needs to retain precise size/position semantics during interaction

In general, keep transform-heavy effects to key interactive components and prefer simple motion on a small, intentional subset of the UI.

## Inverse transforms for children

A transform on a parent can affect its descendants. If a parent is scaled up, the child may appear too large unless it is counter-adjusted.

This is a common pattern when a card or panel is visually enlarged but its contents should stay readable.

```tsx
<frame className="scale-110 bg-gray-900 rounded-xl">
  <frame className="scale-90">
    <textlabel Text="Normal content inside a bigger parent" />
  </frame>
</frame>
```

Here the parent is scaled 1.1×, while the child is scaled back to 0.9× to keep its content visually balanced. This is the same mental model as a "zoomed container with compensating inner content" in CSS.

## Common UI patterns

### Button hover effect

```tsx
<textbutton
  className="bg-blue-500 text-white hover:scale-105 hover:rotate-2 rounded"
  Text="Action"
/>
```

Use this for action buttons, confirmation controls, and inventory item calls to action.

### Card hover effect

```tsx
<frame className="bg-white rounded-xl p-4 hover:translate-y-neg-4 hover:scale-105">
  <textlabel Text="Featured card" />
</frame>
```

This works well for panels, product cards, menu items, and stat summaries where the card lifts slightly on hover.

### Modal entrance

```tsx
<frame className="transform-origin-center scale-95 translate-y-12 bg-white rounded-xl p-4">
  <textlabel Text="Modal content" />
</frame>
```

A modal can start slightly smaller and offset from its final position, then animate into place as the UI opens. This keeps the entrance feeling polished while still acting like a quick, lightweight transform.

## Limitations vs CSS

These utilities are intentionally compact and Roblox-friendly, but they do not try to replicate the entire CSS transform system.

Current limitations include:

- no 3D transforms
- no perspective or perspective-origin
- no `transform-style: preserve-3d`
- no full matrix-based transform pipelines
- no CSS `transform` ordering semantics identical to full browser CSS

This makes the system excellent for common 2D GUI motion and interactive states, but not a replacement for a full web-style 3D graphics pipeline.

## Summary

`@nrbx/react` transform utilities are a practical way to express common 2D interaction patterns in Roblox GUIs:

- scale for emphasis and focus
- rotate for punchy hover and accent effects
- translate for directional movement and offset states
- skew for stylistic tilt and motion accents
- origin control for pivoting around edges or corners

They are best used for lightweight UI feedback and decorative motion rather than deep layout logic or complex 3D composition.

When you want a quick visual improvement on a button, card, or modal without writing custom Roblox property code, transforms are a clean and readable solution.
