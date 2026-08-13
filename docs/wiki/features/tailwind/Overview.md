# Tailwind Class Names

`@nrbx/react` includes a Tailwind-style utility system for Roblox GUIs. Instead of writing raw Roblox props by hand, you can express layout, spacing, colors, typography, borders, transforms, and motion with utility strings and let the runtime resolve them into real Roblox properties.

This page covers the main APIs:

- `tw()` — tagged template literal that returns Roblox props
- `cn()` — conditional class joining, like `clsx`
- `className` — direct utility string on JSX elements
- `configureStyles(config)` — set global design tokens
- `defineConfig(config)` — define the entire style system
- `createStyleSystem(config)` — create an isolated style system

The style system is meant to feel familiar to Tailwind users, but it resolves into Roblox GUI properties like `BackgroundColor3`, `Size`, `TextSize`, `BorderSizePixel`, `UDim2`, and `UIGradient`/`UICorner` children.

## In this section

- [Overview](Overview) — this page, the core `tw`/`cn`/`className` APIs
- [Utility Classes](Utility-Classes) — every supported utility group
- [Hover Variants](Hover-Variants) — `hover:` prefixed classes
- [Arbitrary Values](Arbitrary-Values) — `#hex`, `rgb()`, `rgba()`, and `px` lengths
- [Configuration](Configuration) — `defineConfig`, `configureStyles`, and `createStyleSystem`
- [Custom Style Systems](Custom-Style-Systems) — deep dive on scoped styling
- [Examples](Examples) — end-to-end component examples

## Quick start

```tsx
import React from "@nrbx/react";
import { tw, cn, defineConfig } from "@nrbx/react";

defineConfig({
  colors: {
    brand: {
      500: "#3b82f6",
      600: "#2563eb",
    },
  },
  spacing: {
    18: 72,
  },
});

const props = tw("flex flex-col p-4 bg-brand-500 rounded");

function Card() {
  const active = true;

  return (
    <frame {...props}>
      <textlabel
        className={cn(
          "text-white text-lg font-bold",
          active && "bg-brand-600",
          "rounded px-3 py-2",
        )}
      >
        Hello from Tailwind-style Roblox props
      </textlabel>
    </frame>
  );
}
```

## Using `tw()` as props spread

`tw()` is useful when you want to generate a props object and spread it onto a Roblox element.

```tsx
import React from "@nrbx/react";
import { tw } from "@nrbx/react";

const panelProps = tw("flex flex-col p-4 bg-blue-500 rounded-lg shadow-md");

function Panel() {
  return (
    <frame {...panelProps}>
      <textlabel className="text-white text-lg font-bold">Panel</textlabel>
    </frame>
  );
}
```

You can also use a template literal with dynamic values:

```tsx
import React from "@nrbx/react";
import { tw } from "@nrbx/react";

function StatusBadge({ enabled }: { enabled: boolean }) {
  const props = tw`
    flex items-center justify-center
    rounded-full px-3 py-1
    ${enabled ? "bg-green-500" : "bg-red-500"}
    text-white text-sm font-bold
  `;

  return <frame {...props} />;
}
```

`tw()` is especially good for reusable component props or a small set of static styles that you want as one object.

## Using `className` directly on elements

The simplest pattern is just passing a utility string to the `className` prop.

```tsx
import React from "@nrbx/react";

function LoginButton() {
  return (
    <textbutton className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-bold">
      Sign in
    </textbutton>
  );
}
```

This works with intrinsic Roblox elements and HTML-alias elements alike:

```tsx
import React from "@nrbx/react";

function Form() {
  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-100 rounded-lg">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      <p className="text-sm text-gray-600">Keep your account secure.</p>
    </div>
  );
}
```

When `className` is present, the runtime resolves utility names into Roblox GUI props automatically. Later utilities override earlier ones when they target the same property.

## Using `cn()` for conditional classes

`cn()` is the same idea as `clsx` or a simple conditional class joiner. It accepts strings, booleans, and falsy values are ignored.

```tsx
import React from "@nrbx/react";
import { cn } from "@nrbx/react";

function Toggle({ isActive, isDisabled }: { isActive: boolean; isDisabled: boolean }) {
  return (
    <frame
      className={cn(
        "flex items-center justify-center rounded px-4 py-2",
        isActive && "bg-green-500 text-white",
        !isActive && "bg-gray-300 text-gray-700",
        isDisabled && "opacity-50",
        "shadow-sm",
      )}
    />
  );
}
```

Another common pattern is mixing static classes with dynamic ones:

```tsx
import React from "@nrbx/react";
import { cn } from "@nrbx/react";

function Card({ selected, compact }: { selected: boolean; compact: boolean }) {
  return (
    <frame
      className={cn(
        "flex flex-col rounded-lg border",
        selected && "border-blue-500 bg-blue-50",
        compact ? "p-2" : "p-4",
      )}
    />
  );
}
```

---

[Utility-Classes →](Utility-Classes)
