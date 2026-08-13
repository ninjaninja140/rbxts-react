# Installation & Setup

This guide covers the steps required to install and configure `@nrbx/react` in a `roblox-ts` project.

## Prerequisites

Before installing `@nrbx/react`, make sure your project meets the following requirements:

- Node.js 18 or newer
- npm, pnpm, or yarn available in your environment
- `roblox-ts` 3.x or newer with TypeScript 5.x
- Rojo 7.x or newer
- A Roblox project already set up for `roblox-ts`

If you already have a `roblox-ts` project running with Rojo and TypeScript configured, you are ready to add `@nrbx/react`.

## Installation

Install the core package and the Roblox renderer:

```bash
npm install @nrbx/react @nrbx/react-roblox
# or
pnpm add @nrbx/react @nrbx/react-roblox
# or
yarn add @nrbx/react @nrbx/react-roblox
```

Optional packages can be added when you want extra tooling or compatibility helpers:

```bash
npm install @nrbx/react-is @nrbx/scheduler @nrbx/react-devtools
```

Most projects only need:

- `@nrbx/react` — the React-compatible runtime and JSX layer
- `@nrbx/react-roblox` — the Roblox mounting/rendering runtime

## tsconfig.json Configuration

### Quick Setup with `@nrbx/react-tsconfig` (Recommended)

The easiest way to configure your project is to extend the `@nrbx/react-tsconfig` preset:

```bash
npm install @nrbx/react-tsconfig
# or
pnpm add @nrbx/react-tsconfig
# or
yarn add @nrbx/react-tsconfig
```

Then in your `tsconfig.json`:

```json
{
  "extends": "@nrbx/react-tsconfig"
}
```

That's it — the preset includes JSX, React import source, Roblox types, and path aliases.

#### Available Presets

| Preset | Extends From | Use Case |
|---|---|---|
| `@nrbx/react-tsconfig` | `.tsconfig.json` | Default: full React JSX + path aliases |
| `@nrbx/react-tsconfig/tsconfig.base.json` | — | No JSX, minimum settings. Use for packages or build tooling. |
| `@nrbx/react-tsconfig/tsconfig.strict.json` | `tsconfig.json` | Full React JSX + strict checks (`noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes`, etc.) |
| `@nrbx/react-tsconfig/tsconfig.client.json` | `tsconfig.json` | React JSX, scoped to `src/client/**/*`. Use for client-only workspaces. |
| `@nrbx/react-tsconfig/tsconfig.server.json` | `tsconfig.base.json` | No JSX, scoped to `src/server/**/*`. Use for server-only workspaces. |

### Manual Configuration

If you prefer to configure manually, `@nrbx/react` works with standard `roblox-ts` JSX settings.

#### Recommended: `react-jsx`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "commonjs",
    "moduleResolution": "Node16",
    "strict": true,
    "jsx": "react-jsx",
    "jsxImportSource": "@nrbx/react",
    "types": ["@rbxts/types"],
    "lib": ["ESNext"],
    "rootDir": "src",
    "outDir": "out"
  }
}
```

#### Alternative: classic `react` mode

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "React.createElement",
    "jsxFragmentFactory": "React.Fragment",
    "types": ["@rbxts/types"]
  }
}
```

### Notes

- `"jsx": "react"` or `"jsx": "react-jsx"` are both valid
- If you use `react-jsx`, set `"jsxImportSource": "@nrbx/react"`
- `"types": ["@rbxts/types"]` ensures Roblox Instance and global type definitions are available

## Typings Configuration

If your project includes a `types` folder or custom type declarations, make sure those Roblox types are still available to the compiler.

In most `roblox-ts` projects, the important piece is this:

```json
{
  "compilerOptions": {
    "types": ["@rbxts/types"]
  }
}
```

No additional type packages are required for `@nrbx/react` itself — the package ships with its own TypeScript definitions.

## Project Structure

A typical project layout looks like this:

```text
src/
  client/
    main.client.tsx    # React entry point
  shared/
    components/        # Shared components
  server/              # Server code (no React)
```

This keeps your React UI in `src/client` while leaving server scripts separate.

## Creating Your First Root

Create a client script that mounts a React tree into a Roblox `ScreenGui` or other container.

```tsx
// src/client/main.client.tsx
import React from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

function App() {
  return (
    <textlabel
      Text="Hello from @nrbx/react"
      Size={new UDim2(1, 0, 0, 40)}
      BackgroundTransparency={1}
      TextColor3={Color3.fromRGB(255, 255, 255)}
    />
  );
}

const container = script.Parent!.WaitForChild("ScreenGui") as ScreenGui;
const root = createRoot(container);
root.render(<App />);
```

This mounts your first React tree into a Roblox UI container. You can swap the container with `PlayerGui`, a `Folder`, or another valid Roblox Instance as needed.

## Style Configuration (Optional)

`@nrbx/react` supports optional configuration through `defineConfig()`. This is useful if you want custom colors, spacing scales, or theme defaults.

```tsx
// src/shared/style.config.ts
import { defineConfig } from "@nrbx/react";

export default defineConfig({
  colors: {
    brand: {
      50: Color3.fromRGB(239, 246, 255),
      500: Color3.fromRGB(59, 130, 246),
      900: Color3.fromRGB(30, 58, 138),
    },
  },
  spacing: {
    // custom spacing scale
  },
});
```

You can then import and use your configured style system as your project grows.

## Verifying Installation

After installing the package, verify everything is working before building a larger UI.

### 1. Build with `rbxtsc`

Run the compiler:

```bash
npx rbxtsc
```

If there are no TypeScript errors, the package has been resolved correctly.

### 2. Sync with Rojo

Run Rojo and open the place in Roblox Studio. Make sure the compiled output is being synced to the expected place.

### 3. Check the runtime output

Use a minimal component to confirm the UI renders:

```tsx
import React from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

const root = createRoot(script.Parent!.WaitForChild("ScreenGui") as ScreenGui);

function HelloWorld() {
  return <textlabel Text="Hello World" Size={new UDim2(0, 200, 0, 40)} />;
}

root.render(<HelloWorld />);
```

If the label appears in Roblox Studio, the installation is working correctly.

## Troubleshooting

If something does not work as expected, check the following:

- "Cannot find module @nrbx/react" — make sure the package is installed in the project and that `node_modules` is present
- "JSX element type does not have construct signature" — verify the `jsx` config is set correctly and matches the runtime you are using
- "Cannot find name 'React'" — import React explicitly in your component files
- Build errors about `require` — this is usually handled correctly by `roblox-ts` 3.x; confirm your `roblox-ts` version is up-to-date
- Rojo not finding built files — check the `outDir` in your `tsconfig.json` and verify Rojo is watching the correct output folder
- Missing Roblox types — ensure `@rbxts/types` is included in `compilerOptions.types`

## Next Steps

Once your project is installed and compiling, you can start building components, using hooks, and rendering Roblox UI trees with `@nrbx/react`.

For the next step, move on to your first real UI component and connect it to a `ScreenGui` or `PlayerGui` root.
