# Getting Started with @nrbx/react

`@nrbx/react` is a React 19-style UI layer for Roblox built on top of the Lua React 17 runtime. In plain terms: you write components with JSX, use hooks like `useState`, and render them into Roblox Instances without needing to hand-write every property update yourself.

It gives you a modern developer experience for Roblox UI work, including:

- React-style components and hooks
- `className` utilities for Tailwind-inspired styling
- JSX for Roblox Instances like `frame`, `textlabel`, and `button`
- A `react-roblox` runtime for mounting your app into a Roblox container

If you want to build Roblox UIs with a familiar React mental model, this is the package for you.

## Prerequisites

Before you start, make sure you have the basics set up:

- `roblox-ts` installed in your project
- `rojo` configured for syncing your TypeScript project to Roblox Studio
- A Roblox project open in Studio and a place to mount your UI
- Node.js and a package manager (`npm`, `yarn`, or `pnpm`)

If you are already using `roblox-ts`, you are most of the way there.

## Install

Install the runtime and the Roblox renderer:

```bash
npm install @nrbx/react @nrbx/react-roblox
```

Or with your preferred package manager:

```bash
yarn add @nrbx/react @nrbx/react-roblox
pnpm add @nrbx/react @nrbx/react-roblox
```

## Your first component

Here is a simple TSX example that renders a welcome UI:

```tsx
import React from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

function Welcome() {
  return (
    <frame
      Size={new UDim2(1, 0, 1, 0)}
      BackgroundColor3={Color3.fromRGB(15, 23, 42)}
      BackgroundTransparency={0.1}
    >
      <textlabel
        Size={new UDim2(1, 0, 0, 48)}
        Position={new UDim2(0, 0, 0.5, -24)}
        Text="Hello from @nrbx/react"
        TextColor3={Color3.fromRGB(255, 255, 255)}
        Font={Enum.Font.GothamBold}
        TextSize={28}
        BackgroundTransparency={1}
        TextXAlignment={Enum.TextXAlignment.Center}
      />
    </frame>
  );
}

const root = createRoot(new Instance("ScreenGui"));
root.render(<Welcome />);
```

This creates a ScreenGui and renders your component into it.

## A basic Counter example

This example shows a more realistic pattern: `useState`, Tailwind-style `className`, and Roblox event handling.

```tsx
import React, { useState } from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div
      className="flex h-40 w-72 flex-col items-center justify-center gap-3 rounded-2xl bg-slate-900 p-5 shadow-lg"
      Size={new UDim2(0, 280, 0, 160)}
      Position={new UDim2(0.5, -140, 0.5, -80)}
      AnchorPoint={new Vector2(0.5, 0.5)}
    >
      <h1 className="text-3xl font-bold text-white">{count}</h1>

      <button
        className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        Event={{
          Activated: () => setCount((value) => value + 1),
        }}
      >
        Increment
      </button>
    </div>
  );
}

const root = createRoot(new Instance("ScreenGui"));
root.render(<Counter />);
```

A few things to notice:

- `useState` gives you local component state.
- `className` is the quick path for Tailwind-style styling.
- `Event={{ Activated: ... }}` wires Roblox UI events directly to React handlers.
- The rendered `div` and `button` map to Roblox GUI elements automatically.

## Creating a root with react-roblox

The root is the entry point for your UI tree. `@nrbx/react-roblox` provides `createRoot`, which attaches a React tree to a Roblox Instance.

```tsx
import React from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

const playerGui = game.GetService("Players").LocalPlayer.WaitForChild("PlayerGui");
const root = createRoot(playerGui);

root.render(
  <frame Size={new UDim2(1, 0, 1, 0)} BackgroundColor3={Color3.fromRGB(0, 0, 0)}>
    <textlabel
      Size={new UDim2(1, 0, 0, 40)}
      Text="Mounted with @nrbx/react"
      TextColor3={Color3.fromRGB(255, 255, 255)}
      BackgroundTransparency={1}
    />
  </frame>,
);
```

Common patterns:

- Render into a `ScreenGui` for full-screen UI
- Render into `PlayerGui` for player HUD / menu UI
- Use a `Folder` or `Frame` as a local mount point for nested UI

## Recommended project setup

Once your environment is ready, your regular workflow usually looks like this:

1. Write components in TypeScript (`.tsx`)
2. Sync the project with Rojo to Roblox Studio
3. Run the client script that creates the root
4. Watch your component tree render in Studio

That keeps your UI logic clean, reusable, and easy to reason about.

## Next step

From here you can start building more complex interfaces with:

- state and effects (`useState`, `useMemo`, `useEffect`)
- nested components
- layout primitives using `className`
- Roblox-specific event handling and instance props

If you can write React in the browser, you can write it in Roblox with `@nrbx/react`.

Happy building.
