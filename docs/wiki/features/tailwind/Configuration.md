# Configuration

The styling system is configured through `defineConfig`, `configureStyles`, and `createStyleSystem`. Each fills a different need: global defaults, runtime overrides, and isolated scoped systems.

## Setup with `defineConfig`

`defineConfig()` is the recommended way to configure the global style system. It merges into the active configuration and allows you to add custom colors, spacing, and custom class resolvers.

```tsx
import React from "@nrbx/react";
import { defineConfig } from "@nrbx/react";

defineConfig({
  colors: {
    brand: {
      50: "#eef2ff",
      500: "#6366f1",
      600: "#4f46e5",
    },
    accent: {
      500: "#14b8a6",
    },
  },
  spacing: {
    18: 72,
    22: 88,
  },
  borderRadii: {
    xl: 16,
    "2xl": 32,
  },
  css: {
    "hero-card": {
      BackgroundColor3: Color3.fromRGB(17, 24, 39),
      BorderSizePixel: 1,
      BorderColor3: Color3.fromRGB(75, 85, 99),
    },
  },
  resolve(className) {
    if (className === "glass") {
      return {
        BackgroundTransparency: 0.35,
        BorderSizePixel: 1,
        BorderColor3: Color3.fromRGB(255, 255, 255),
      };
    }

    return undefined;
  },
});
```

Once defined, the new palette and custom rules are available everywhere:

```tsx
<frame className="bg-brand-500 text-white p-18 rounded-xl glass" />
```

## Configuring styles with `configureStyles`

`configureStyles()` is a lighter-weight global override for design tokens.

```tsx
import React from "@nrbx/react";
import { configureStyles } from "@nrbx/react";

configureStyles({
  colors: {
    brand: {
      500: "#3b82f6",
    },
  },
  spacing: {
    18: 72,
  },
  fontSizes: {
    giant: 36,
  },
  borderRadii: {
    xl: 16,
  },
  zIndex: {
    60: 60,
  },
});
```

After that, you can use your new tokens directly:

```tsx
<frame className="bg-brand-500 p-18 rounded-xl z-60" />
<textlabel className="text-giant" />
```

## Isolated style systems with `createStyleSystem`

If you want a styling context that is isolated from the global system, use `createStyleSystem(config)`. It returns a scoped `tw`, `cn`, and `resolveClassName`.

```tsx
import React from "@nrbx/react";
import { createStyleSystem } from "@nrbx/react";

const ui = createStyleSystem({
  colors: {
    brand: {
      500: "#6366f1",
    },
  },
  spacing: {
    18: 72,
  },
});

function BrandButton() {
  const props = ui.tw`flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-white`;

  return <textbutton {...props}>Launch</textbutton>;
}
```

You can also use the scoped `cn` helper:

```tsx
import React from "@nrbx/react";
import { createStyleSystem } from "@nrbx/react";

const ui = createStyleSystem({
  colors: {
    success: {
      500: "#22c55e",
    },
  },
});

function StatusChip({ active }: { active: boolean }) {
  return (
    <frame
      className={ui.cn(
        "rounded-full px-3 py-1 text-sm font-bold",
        active && "bg-success-500 text-white",
        !active && "bg-gray-200 text-gray-700",
      )}
    />
  );
}
```

---

[← Arbitrary-Values](Arbitrary-Values) · [Custom-Style-Systems →](Custom-Style-Systems)
