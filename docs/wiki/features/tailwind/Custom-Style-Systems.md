# Custom Style Systems

The styling system is designed to feel familiar to Tailwind users, but it is ultimately mapped to Roblox Instance properties. The key is to configure design tokens at the application level, then layer custom utility classes or scoped wrappers when you need isolation.

### `defineConfig(config)` for project-wide style configuration

Use `defineConfig` once at your app entry point. It configures the global style system that `className` resolution uses.

```tsx
import React from "@nrbx/react";
import { defineConfig } from "@nrbx/react";

defineConfig({
  colors: {
    brand: {
      500: "#6366f1",
      600: "#4f46e5",
    },
    accent: {
      500: "#14b8a6",
    },
  },
  spacing: {
    18: 18,
    24: 24,
    72: 72,
  },
  fontSizes: {
    display: 36,
    label: 14,
  },
  css: {
    "panel-surface": {
      BackgroundColor3: Color3.fromRGB(17, 24, 39),
      BorderSizePixel: 0,
      CornerRadius: new UDim(0, 12),
    },
    "soft-shadow": {
      BackgroundTransparency: 0.15,
      BorderSizePixel: 0,
    },
  },
  resolve(className) {
    if (className === "safe-area") {
      return {
        Position: new UDim2(0, 12, 0, 12),
        Size: new UDim2(1, -24, 1, -24),
      };
    }

    return undefined;
  },
  experimental: {
    position: true,
  },
});
```

A good rule of thumb:

- Use `colors` and `spacing` for tokenized design values
- Use `css` for app-level reusable classes like `panel-surface` or `btn-primary`
- Use the `resolve` hook for one-off utilities that do not fit the default parser

### Custom color palettes

Color tokens are easier to maintain than scattering `Color3` values throughout components.

```tsx
import React from "@nrbx/react";
import { defineConfig } from "@nrbx/react";

defineConfig({
  colors: {
    ui: {
      50: "#f8fafc",
      100: "#f1f5f9",
      500: "#64748b",
      900: "#0f172a",
    },
    game: {
      success: "#22c55e",
      warn: "#f59e0b",
      danger: "#ef4444",
    },
  },
});

function StatusBadge() {
  return (
    <frame className="rounded-md bg-game-success px-3 py-1">
      <textlabel className="text-xs font-bold text-white">ONLINE</textlabel>
    </frame>
  );
}
```

This keeps the palette coherent across menus, inventories, notification banners, and system bars.

### Custom spacing scales

Spacing grows from small, fixed values into meaningful UI rhythm. Define a project scale once and reuse it consistently.

```tsx
import { defineConfig } from "@nrbx/react";

defineConfig({
  spacing: {
    2: 2,
    4: 4,
    6: 6,
    8: 8,
    12: 12,
    16: 16,
    20: 20,
    24: 24,
    32: 32,
  },
});
```

This makes classes like `p-4`, `gap-8`, and `m-24` predictable across the app.

### Custom className resolvers

If you need a custom utility that is too app-specific for the default parser, register a resolver.

```tsx
import React from "@nrbx/react";
import { defineConfig } from "@nrbx/react";

defineConfig({
  resolve(className) {
    if (className === "shadow-soft") {
      return {
        BackgroundTransparency: 0.15,
        BorderSizePixel: 0,
        ZIndex: 10,
      };
    }

    if (className.startsWith("animate-")) {
      return {
        Rotation: 360,
      };
    }

    return undefined;
  },
});
```

This is ideal for gameplay-specific styling such as `danger-glow`, `hud-badge`, or `safe-area` layout helpers.

### `createStyleSystem(config)` for isolated style contexts

`createStyleSystem` creates a localized style context for a component library or subtree. This is useful when a plugin, menu, or widget needs its own tokens without mutating the global app config.

```tsx
import React from "@nrbx/react";
import { createStyleSystem } from "@nrbx/react";

const inventoryStyles = createStyleSystem({
  colors: {
    panel: {
      500: "#1f2937",
    },
    accent: {
      500: "#fbbf24",
    },
  },
  spacing: {
    14: 14,
  },
});

function InventoryPanel() {
  const { tw } = inventoryStyles;

  return (
    <frame {...tw("bg-panel-500 p-4 rounded-lg")}>
      <textlabel {...tw("text-white text-base font-bold")}>Inventory</textlabel>
    </frame>
  );
}
```

This keeps a sub-tree independent while still leveraging the same styling pipeline.

### `configureStyles(config)` for runtime configuration

Use `configureStyles` when you want to merge additional design tokens at runtime without replacing the entire config.

```tsx
import { configureStyles } from "@nrbx/react";

configureStyles({
  colors: {
    theme: {
      500: "#8b5cf6",
    },
  },
  spacing: {
    28: 28,
  },
});
```

A common usage pattern is a runtime theme switcher:

```tsx
import React, { useState, useEffect } from "@nrbx/react";
import { configureStyles } from "@nrbx/react";

function ThemeController() {
  const [mode, setMode] = useState("dark");

  useEffect(() => {
    if (mode === "dark") {
      configureStyles({
        colors: {
          brand: {
            500: "#3b82f6",
          },
        },
      });
    } else {
      configureStyles({
        colors: {
          brand: {
            500: "#f97316",
          },
        },
      });
    }
  }, [mode]);

  return null;
}
```

This works well for runtime themes or feature-specific style swaps.

---

[← Configuration](Configuration) · [Examples →](Examples)
