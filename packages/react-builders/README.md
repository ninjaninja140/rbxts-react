<div align="center" id="top">
    <img src="https://github.com/nn140/Branding/blob/main/LogoWhite-Full.png?raw=true" alt="NN140.UK logo" width="800"/>
    <img src="https://github.com/nn140/Branding/blob/main/LogoBlack-Full.png?raw=true" alt="NN140.UK logo" width="800"/>
    <br />
    <br />
    <img src="https://img.shields.io/badge/Stripe-Donate%20to%20support%20NN140.UK-1b1b1b?style=for-the-badge&labelColor=6860ff&logo=stripe&logoColor=ffffff&logoSize=auto&link=https%3A%2F%2Fdonate.stripe.com%2F9B6eVdbTd4n1a6H1yXa3u04&link=https%3A%2F%2Fdonate.stripe.com%2F9B6eVdbTd4n1a6H1yXa3u04" alt="Badge">
    <img src="https://img.shields.io/badge/Stripe-Donate%20to%20Support%20NN140.UK%20(RECCURING)-1b1b1b?style=for-the-badge&labelColor=6860ff&logo=stripe&logoColor=ffffff&logoSize=auto&link=https%3A%2F%2Fdonate.stripe.com%2FdRm9ATe1laLpgv5b9xa3u05&link=https%3A%2F%2Fdonate.stripe.com%2FdRm9ATe1laLpgv5b9xa3u05" alt="Badge">
</div>

<hr />

## @nrbx/react-builders

> Builder-style component construction and serialization for Roblox React.

## Installation

```bash
npm install @nrbx/react-builders
```

## Usage

```tsx
import { Frame, TextLabel } from "@nrbx/react-builders";

const element = Frame({ Size: new UDim2(1, 0, 1, 0) })
  .addChild(TextLabel({ Text: "Hello" }))
  .build();
```

## Builders

Provides builder classes for common Roblox instances: `Frame`, `TextLabel`, `TextButton`, `TextBox`, `ImageLabel`, `ImageButton`, `ScrollingFrame`, `CanvasGroup`, `ViewportFrame`, and layout/constraint instances such as `UIListLayout`, `UIGridLayout`, `UIPadding`, `UICorner`, `UIStroke`, `UIGradient`, and `UISizeConstraint`.

Also exports `resolveClassName`, `resolveColor`, and the `BaseBuilder` class for extending the system.
---

Built with [roblox-ts](https://roblox-ts.com)

<hr />

<div align="center" id="top">
    <img src="https://img.shields.io/badge/Stripe-Donate%20to%20support%20NN140.UK-1b1b1b?style=for-the-badge&labelColor=6860ff&logo=stripe&logoColor=ffffff&logoSize=auto&link=https%3A%2F%2Fdonate.stripe.com%2F9B6eVdbTd4n1a6H1yXa3u04&link=https%3A%2F%2Fdonate.stripe.com%2F9B6eVdbTd4n1a6H1yXa3u04" alt="Badge">
    <img src="https://img.shields.io/badge/Stripe-Donate%20to%20Support%20NN140.UK%20(RECCURING)-1b1b1b?style=for-the-badge&labelColor=6860ff&logo=stripe&logoColor=ffffff&logoSize=auto&link=https%3A%2F%2Fdonate.stripe.com%2FdRm9ATe1laLpgv5b9xa3u05&link=https%3A%2F%2Fdonate.stripe.com%2FdRm9ATe1laLpgv5b9xa3u05" alt="Badge">
    <br />
    <br />
    <img src="https://github.com/nn140/Branding/blob/main/LogoBlack-Full.png?raw=true" alt="NN140.UK logo" width="800"/>
    <img src="https://github.com/nn140/Branding/blob/main/LogoWhite-Full.png?raw=true" alt="NN140.UK logo" width="800"/>
</div>
