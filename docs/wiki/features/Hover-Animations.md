# Hover Animations

`@nrbx/react` supports hover-driven visual feedback for Roblox GUIs using Tailwind-style class names. Instead of relying on CSS pseudo-classes, the runtime listens to Roblox hover events and applies hover state to the element.

This makes hover effects feel familiar to React and Tailwind users while still mapping to Roblox GUI properties and animation behavior.

## How hover animations work

Hover interactions are implemented through the element's event system:

- `onMouseEnter` and `onMouseLeave` are translated into hover state.
- `onHover` and `onUnhover` are accepted as aliases.
- Any class prefixed with `hover:` is treated as a hover variant.
- When the pointer enters the element, the hover values are applied.
- When the pointer leaves, the original values are restored.
- `transition-*` classes control how the state changes over time.

Internally, the hover variant stores the target values during render and toggles them when the pointer enters or leaves. The transitions are smooth because the runtime updates values through `RunService.Heartbeat`, using spring or tween-driven interpolation.

In other words, the hover state is JavaScript-driven, not CSS-driven, but the API feels like Tailwind.

## Supported hover variants

The following hover variants are supported:

- `hover:bg-{color}-{shade}` — background color change
- `hover:text-{color}-{shade}` — text color change
- `hover:opacity-{n}` — opacity change
- `hover:scale-{n}` — scale transform
- `hover:rotate-{n}` — rotation change
- `hover:translate-x-{n}` — horizontal shift
- `hover:translate-y-{n}` — vertical shift
- `hover:border-{color}-{shade}` — border color change
- `hover:shadow` / `hover:shadow-{size}` — shadow on hover
- `hover:brightness-{n}` — brightness change, simulated with lighter/darker `Color3`

### Example

```tsx
<textbutton
  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 hover:scale-105 transition-all duration-200"
  Text="Hover Me"
  onClick={() => print("clicked")}
/>

<frame className="bg-gray-800 hover:shadow-lg hover:border-blue-500 border-2 border-transparent rounded-lg p-4 transition-all">
  <textlabel Text="Interactive Card" className="text-white hover:text-blue-300 transition-colors" />
</frame>
```

## Hover behavior in practice

Hover effects are usually applied to interactive components such as buttons, cards, badges, and tooltips.

When you add a hover class, the hover variant is stored alongside the base styles. On pointer enter, the target values are swapped in; on pointer leave, the original state is restored.

This allows a component to have a base style and a hover-only variant without writing custom event logic every time.

## `transition-*` classes

You can control the animation between normal and hover states using transition classes such as:

- `transition-all`
- `transition-colors`
- `transition-opacity`
- `transition-transform`
- `duration-{n}`
- `ease-out`, `ease-in`, `ease-in-out`

```tsx
<textbutton
  className="bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 hover:scale-105 transition-all duration-150 ease-out"
  Text="Launch"
  onClick={() => print("launch")}
/>
```

These classes tell the animation layer how quickly values should move between states. The actual interpolation uses Roblox-friendly updates on `RunService.Heartbeat`, which makes motion smooth while staying lightweight.

## Button hover effects

Hover states are a great fit for buttons because they can provide immediate visual reinforcement without much code.

```tsx
function StyledButton({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <textbutton
      className={cn(
        "bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg",
        "hover:bg-indigo-700 hover:scale-105",
        "transition-all duration-150 ease-out",
      )}
      Text={text}
      onClick={onClick}
    />
  );
}
```

This pattern is useful for:

- primary action buttons
- card actions and controls
- menu items
- toolbar or HUD buttons

## Custom hover handling

Sometimes you want more control than a utility class gives you. You can still use the same pattern by creating your own hover state and toggling classes manually.

```tsx
function HoverReveal({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);

  return (
    <frame
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "transition-opacity duration-300",
        hovered ? "opacity-100" : "opacity-50",
      )}
    >
      {children}
    </frame>
  );
}
```

This is especially useful when:

- a hover state should gate other content
- you want a tooltip or reveal panel
- multiple hover-related states need to be coordinated
- the hover effect is tied to app logic rather than simple styling

## Advanced patterns

### Group hover

Hover on a parent can be used to influence child elements. This usually uses React state and a shared condition, rather than a single `hover:` class.

```tsx
function Panel({ title }: { title: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <frame
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn("bg-gray-900 p-4 rounded-lg transition-all", hovered && "bg-gray-800")}
    >
      <textlabel
        className={cn("text-gray-300 transition-colors", hovered && "text-white")}
        Text={title}
      />
    </frame>
  );
}
```

### Hover with tooltip reveal

```tsx
function InfoChip({ label, hint }: { label: string; hint: string }) {
  const [open, setOpen] = useState(false);

  return (
    <frame>
      <textbutton
        Text={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="bg-slate-700 text-white px-3 py-1 rounded"
      />

      {open && (
        <frame className="bg-black text-white px-2 py-1 rounded mt-1">
          <textlabel Text={hint} />
        </frame>
      )}
    </frame>
  );
}
```

### Ripple or click accent

You can combine hover and click states to create richer interactive feedback.

```tsx
function ActionButton() {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <textbutton
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className={cn(
        "bg-blue-500 text-white rounded px-4 py-2 transition-all",
        hovered && "bg-blue-600 scale-105",
        pressed && "scale-95",
      )}
      Text="Open"
    />
  );
}
```

### Hover trail effects

For more expressive interfaces, you can attach hover motion to child elements or decorative overlays to create an animated trail or glow.

```tsx
function GlowCard() {
  const [hovered, setHovered] = useState(false);

  return (
    <frame
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn("bg-gray-800 rounded-xl p-4 transition-all", hovered && "shadow-lg")}
    >
      <frame className={cn("absolute inset-0 rounded-xl transition-opacity", hovered ? "opacity-100" : "opacity-0")} />
      <textlabel Text="Hover card" className="text-white" />
    </frame>
  );
}
```

## Performance

Hover state is lightweight and local to each element:

- each element keeps its own hover state in a local `useState`
- multiple hover elements are fine because each instance manages its own interaction
- spring-based hover transitions are processed with `RunService.Heartbeat`
- similar hover effects can be batched efficiently by the runtime

This keeps hover interactions responsive without requiring a global animation manager.

## Limitations

Hover effects in `@nrbx/react` are intentionally simple, and there are a few important limitations to keep in mind:

- There is no real CSS `:hover` pseudo-class in Roblox.
- `hover:` is a className convention, not native CSS behavior.
- The runtime is JavaScript-driven, so it depends on mouse event listeners.
- Multiple hover properties on the same element compose into a single hover toggle.
- More complex hover logic is best handled with explicit state when you need conditions beyond a simple visual swap.

## Summary

Hover animations in `@nrbx/react` provide a practical, Tailwind-like API for Roblox GUIs:

- quick visual feedback with `hover:*` classes
- smooth motion with `transition-*` and heartbeat-based interpolation
- support for common interaction patterns like scale, opacity, color, shadows, and movement
- easy extension for custom hover logic when you need more than a simple toggle

Use hover variants when you want a component to react naturally to pointer entry and exit without writing bespoke tween code for every element.
