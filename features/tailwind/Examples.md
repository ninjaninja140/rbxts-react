# Tailwind Examples

A complete component that ties together configuration, conditional classes, hover variants, and gradients.

## Full component example

```tsx
import React, { useState } from "@nrbx/react";
import { defineConfig, cn } from "@nrbx/react";

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

function App() {
  const [active, setActive] = useState(false);

  return (
    <frame className="flex flex-col gap-4 p-6 bg-gray-100 rounded-xl">
      <textlabel className="text-2xl font-bold text-gray-900">Dashboard</textlabel>

      <frame className="flex gap-3">
        <textbutton
          className={cn(
            "px-4 py-2 rounded font-bold",
            active ? "bg-brand-500 text-white" : "bg-gray-300 text-gray-800",
          )}
          Event={{
            Activated: () => setActive((value) => !value),
          }}
        >
          Toggle
        </textbutton>

        <textbutton className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-bold">
          Delete
        </textbutton>
      </frame>

      <frame className="bg-gradient-to-r from-brand-500 via-cyan-400 to-green-500 p-4 rounded-lg shadow-md hover:scale-105">
        <textlabel className="text-white text-lg font-bold">Gradient card</textlabel>
      </frame>
    </frame>
  );
}
```

## Summary

The `@nrbx/react` Tailwind-style system is meant to feel familiar to front-end developers while mapping cleanly to Roblox GUI primitives:

- `tw()` gives you a props object to spread directly
- `cn()` is great for conditional styling
- `className` works naturally on JSX elements
- `configureStyles()` and `defineConfig()` let you customize your palette and utility rules
- `createStyleSystem()` gives you scoped, isolated styling contexts
- Arbitrary values make custom colors and sizes easy without writing boilerplate

If you want to style Roblox GUIs in a fast, declarative way without losing access to actual Roblox props, this utility system is the fastest path.

---

[← Custom-Style-Systems](Custom-Style-Systems)
