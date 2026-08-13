<div align="center" id="top">
    <img src="https://github.com/nn140/Branding/blob/main/LogoWhite-Full.png?raw=true" alt="NN140.UK logo" width="800"/>
    <img src="https://github.com/nn140/Branding/blob/main/LogoBlack-Full.png?raw=true" alt="NN140.UK logo" width="800"/>
    <br />
    <br />
    <img src="https://img.shields.io/badge/Stripe-Donate%20to%20support%20NN140.UK-1b1b1b?style=for-the-badge&labelColor=6860ff&logo=stripe&logoColor=ffffff&logoSize=auto&link=https%3A%2F%2Fdonate.stripe.com%2F9B6eVdbTd4n1a6H1yXa3u04&link=https%3A%2F%2Fdonate.stripe.com%2F9B6eVdbTd4n1a6H1yXa3u04" alt="Badge">
    <img src="https://img.shields.io/badge/Stripe-Donate%20to%20Support%20NN140.UK%20(RECCURING)-1b1b1b?style=for-the-badge&labelColor=6860ff&logo=stripe&logoColor=ffffff&logoSize=auto&link=https%3A%2F%2Fdonate.stripe.com%2FdRm9ATe1laLpgv5b9xa3u05&link=https%3A%2F%2Fdonate.stripe.com%2FdRm9ATe1laLpgv5b9xa3u05" alt="Badge">
</div>

<hr />

## @nrbx/react-tsconfig

> Shared TypeScript configuration presets for roblox-ts projects using @nrbx/react.

## Installation

```bash
npm install @nrbx/react-tsconfig --save-dev
```

Then in your `tsconfig.json`:

```json
{
  "extends": "@nrbx/react-tsconfig"
}
```

## Presets

| Preset | Extends | Description |
|---|---|---|
| `@nrbx/react-tsconfig` | `tsconfig.json` | Default preset. React JSX (`react-jsx`), strict mode, path aliases, Roblox types. |
| `@nrbx/react-tsconfig/tsconfig.base.json` | — | Bare minimum. ESNext target, commonjs module, noLib, synthetic imports. No JSX. Use for packages or non-UI code. |
| `@nrbx/react-tsconfig/tsconfig.client.json` | `tsconfig.json` | React JSX, scoped to `src/client`. Use when your workspace has separate client/server tsconfigs. |
| `@nrbx/react-tsconfig/tsconfig.server.json` | `tsconfig.base.json` | No JSX, scoped to `src/server`. Use for server-only code with no React dependency. |
| `@nrbx/react-tsconfig/tsconfig.strict.json` | `tsconfig.json` | Default settings plus extra strictness: `noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `noImplicitReturns`. |

## What's Included

### tsconfig.json (default)

- `jsx: "react-jsx"` with `jsxImportSource: "@nrbx/react"`
- `strict: true`
- Path aliases: `@client/*`, `@server/*`, `@shared/*` mapping to `src/client`, `src/server`, `src/shared`
- `typeRoots` including both `@rbxts` and `@nrbx` scopes

### tsconfig.base.json (bare minimum)

- `target: "ESNext"`, `module: "commonjs"`, `moduleResolution: "Node"`
- `noLib: true`, `allowSyntheticDefaultImports: true`
- `downlevelIteration: true`, `resolveJsonModule: true`
- `forceConsistentCasingInFileNames: true`
- **No JSX settings** — add them yourself if needed

## Overriding Settings

You can override any setting from a preset:

```json
{
  "extends": "@nrbx/react-tsconfig/tsconfig.strict.json",
  "compilerOptions": {
    "outDir": "dist",
    "noUnusedLocals": false
  }
}
```

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
