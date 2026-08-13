<div align="center" id="top">
    <img src="https://github.com/nn140/Branding/blob/main/LogoWhite-Full.png?raw=true" alt="NN140.UK logo" width="800"/>
    <img src="https://github.com/nn140/Branding/blob/main/LogoBlack-Full.png?raw=true" alt="NN140.UK logo" width="800"/>
    <br />
    <br />
    <img src="https://img.shields.io/badge/Stripe-Donate%20to%20support%20NN140.UK-1b1b1b?style=for-the-badge&labelColor=6860ff&logo=stripe&logoColor=ffffff&logoSize=auto&link=https%3A%2F%2Fdonate.stripe.com%2F9B6eVdbTd4n1a6H1yXa3u04&link=https%3A%2F%2Fdonate.stripe.com%2F9B6eVdbTd4n1a6H1yXa3u04" alt="Badge">
    <img src="https://img.shields.io/badge/Stripe-Donate%20to%20Support%20NN140.UK%20(RECCURING)-1b1b1b?style=for-the-badge&labelColor=6860ff&logo=stripe&logoColor=ffffff&logoSize=auto&link=https%3A%2F%2Fdonate.stripe.com%2FdRm9ATe1laLpgv5b9xa3u05&link=https%3A%2F%2Fdonate.stripe.com%2FdRm9ATe1laLpgv5b9xa3u05" alt="Badge">
</div>

<hr />

## @nrbx/react

> React 19 for Roblox TypeScript. A full-featured UI layer built on the React Lua 17 runtime, extended with React 19 APIs, text-as-children, Tailwind-style `className`, HTML element aliases, and a configurable styling system.

## Packages

| Package | Description |
|---|---|
| [`@nrbx/react`](packages/react) | Core React bindings: JSX, hooks, components, styling, HTML elements |
| [`@nrbx/react-roblox`](packages/react-roblox) | Roblox renderer: `createRoot`, `createPortal`, `flushSync` |
| [`@nrbx/react-tsconfig`](packages/react-tsconfig) | Shared TypeScript presets for `@nrbx/react` projects |
| [`@nrbx/react-is`](packages/react-is) | Type-checking utilities for React elements |
| [`@nrbx/react-globals`](packages/react-globals) | React global flags and the DevTools hook |
| [`@nrbx/react-devtools-core`](packages/react-devtools-core) | DevTools backend, vendored for Roblox |
| [`@nrbx/react-devtools`](packages/react-devtools) | Connect to DevTools by importing this package |
| [`@nrbx/react-debug-tools`](packages/react-debug-tools) | Hook inspection helpers for debugging |
| [`@nrbx/react-builders`](packages/react-builders) | Builder-style component construction and serialization |
| [`@nrbx/scheduler`](packages/scheduler) | Cooperative scheduler used by the reconciler |

## Installation

```bash
npm install @nrbx/react @nrbx/react-roblox
# or
pnpm add @nrbx/react @nrbx/react-roblox
# or
yarn add @nrbx/react @nrbx/react-roblox
```

Add the package folders to your Rojo project file under `node_modules`:

```json
"node_modules": {
  "$className": "Folder",
  "@nrbx": {
    "$path": "node_modules/@nrbx"
  },
  "@rbxts": {
    "$path": "node_modules/@rbxts"
  },
  "@rbxts-js": {
    "$path": "node_modules/@rbxts-js"
  }
}
```

### TypeScript configuration

The simplest option is to extend the shared preset:

```bash
npm install @nrbx/react-tsconfig
```

```json
{
  "extends": "@nrbx/react-tsconfig"
}
```

Or configure JSX manually:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@nrbx/react",
    "types": ["@rbxts/types"]
  }
}
```

## Quick Start

```tsx
import React, { useState } from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <textbutton
      Text={`Count: ${count}`}
      AnchorPoint={new Vector2(0.5, 0.5)}
      Size={new UDim2(0, 120, 0, 50)}
      Position={new UDim2(0.5, 0, 0.5, 0)}
      Event={{ Activated: () => setCount(count + 1) }}
    />
  );
}

const root = createRoot(script.Parent!.WaitForChild("ScreenGui") as ScreenGui);
root.render(<Counter />);
```

## Features

- **React 19 hooks** — `useId`, `useTransition`, `useDeferredValue`, `useSyncExternalStore`, `useInsertionEffect`, `useOptimistic`, `useActionState`, `use`, and more
- **Text as children** — string and number children are automatically wrapped in `TextLabel` instances with transparent backgrounds
- **Tailwind-style `className`** — map utility classes like `flex`, `items-center`, `bg-blue-500`, and `w-32` to Roblox GUI properties
- **HTML elements** — `div`, `span`, `h1`-`h6`, `p`, `a`, `button`, `img`, `ul`, `li`, `form`, `input`, and more
- **Class components** — `Component`, `PureComponent`, full lifecycle, and error boundaries
- **Configurable styling** — `defineConfig()` for custom colors, spacing, and theme defaults
- **DevTools support** — connect the standalone DevTools app to inspect your component tree

## Documentation

The full wiki lives in [`docs/wiki`](docs/wiki):

- [Home](docs/wiki/Home.md)
- [Installation & Setup](docs/wiki/Installation.md)
- [Getting Started](docs/wiki/Getting-Started.md)
- [Migration Guide](docs/wiki/Migration-Guide.md)
- [Caveats & Limitations](docs/wiki/Caveats-and-Limitations.md)
- [API Reference](docs/wiki/API-Reference.md)

## React DevTools

To connect the standalone DevTools app, import the backend before React:

```tsx
import ReactGlobals from "@nrbx/react-globals";
import { backend } from "@nrbx/react-devtools-core";

ReactGlobals.__DEV__ = true;
ReactGlobals.__PROFILE__ = true;

backend.connectToDevtools();
```

## License

MIT — see [LICENSE.txt](LICENSE.txt)

---

Built with [React](https://react.dev) concepts - [roblox-ts](https://roblox-ts.com) - [React Lua](https://github.com/jsdotlua/react-lua)

## Notes

This is a work-in-progress project. A lot of the documentation and jsDocs are written or have been re-written using AI (because i can write good code, but can't document for the life of me beyond minimum effort comments), so any comments and issues you may find, please just pull request with your amendments.

Part of this package was also made with AI assistance for sections where it was a bit rough or difficult to get around, if you don't like AI you can scream down my ear, but I am a single developer doing the work of a team, I could care less what you think, I wasn't going to work on this by myself and leave loads of holes and stuff which I'll probably never get back to doing.


<hr />

<div align="center" id="top">
    <img src="https://img.shields.io/badge/Stripe-Donate%20to%20support%20NN140.UK-1b1b1b?style=for-the-badge&labelColor=6860ff&logo=stripe&logoColor=ffffff&logoSize=auto&link=https%3A%2F%2Fdonate.stripe.com%2F9B6eVdbTd4n1a6H1yXa3u04&link=https%3A%2F%2Fdonate.stripe.com%2F9B6eVdbTd4n1a6H1yXa3u04" alt="Badge">
    <img src="https://img.shields.io/badge/Stripe-Donate%20to%20Support%20NN140.UK%20(RECCURING)-1b1b1b?style=for-the-badge&labelColor=6860ff&logo=stripe&logoColor=ffffff&logoSize=auto&link=https%3A%2F%2Fdonate.stripe.com%2FdRm9ATe1laLpgv5b9xa3u05&link=https%3A%2F%2Fdonate.stripe.com%2FdRm9ATe1laLpgv5b9xa3u05" alt="Badge">
    <br />
    <br />
    <img src="https://github.com/nn140/Branding/blob/main/LogoBlack-Full.png?raw=true" alt="NN140.UK logo" width="800"/>
    <img src="https://github.com/nn140/Branding/blob/main/LogoWhite-Full.png?raw=true" alt="NN140.UK logo" width="800"/>
</div>
