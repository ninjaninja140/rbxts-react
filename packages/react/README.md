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

> React 19 bindings for Roblox TypeScript, with Tailwind-style className, HTML elements, and text-as-children.

## Installation

```bash
npm install @nrbx/react @nrbx/react-roblox
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
      Size={new UDim2(0, 120, 0, 50)}
      Event={{ Activated: () => setCount(count + 1) }}
    />
  );
}

const root = createRoot(container);
root.render(<Counter />);
```

## Features

- All core and React 19 hooks, available on the default export or as named imports
- Text as children: string and number children become `TextLabel` instances automatically
- Tailwind-style `className` utilities (`flex`, `items-center`, `bg-blue-500`, `w-32`, ...)
- HTML element aliases (`div`, `span`, `h1`-`h6`, `p`, `a`, `button`, `img`, ...)
- Class components, error boundaries, portals, and a configurable styling system via `defineConfig()`

See the [wiki](https://github.com/ninjaninja140/rbxts-react/wiki) for full documentation.
---

Built with [roblox-ts](https://roblox-ts.com) - [React Lua](https://github.com/jsdotlua/react-lua)

<hr />

<div align="center" id="top">
    <img src="https://img.shields.io/badge/Stripe-Donate%20to%20support%20NN140.UK-1b1b1b?style=for-the-badge&labelColor=6860ff&logo=stripe&logoColor=ffffff&logoSize=auto&link=https%3A%2F%2Fdonate.stripe.com%2F9B6eVdbTd4n1a6H1yXa3u04&link=https%3A%2F%2Fdonate.stripe.com%2F9B6eVdbTd4n1a6H1yXa3u04" alt="Badge">
    <img src="https://img.shields.io/badge/Stripe-Donate%20to%20Support%20NN140.UK%20(RECCURING)-1b1b1b?style=for-the-badge&labelColor=6860ff&logo=stripe&logoColor=ffffff&logoSize=auto&link=https%3A%2F%2Fdonate.stripe.com%2FdRm9ATe1laLpgv5b9xa3u05&link=https%3A%2F%2Fdonate.stripe.com%2FdRm9ATe1laLpgv5b9xa3u05" alt="Badge">
    <br />
    <br />
    <img src="https://github.com/nn140/Branding/blob/main/LogoBlack-Full.png?raw=true" alt="NN140.UK logo" width="800"/>
    <img src="https://github.com/nn140/Branding/blob/main/LogoWhite-Full.png?raw=true" alt="NN140.UK logo" width="800"/>
</div>
