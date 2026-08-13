# @nrbx/react

This is the documentation for `@nrbx/react`, a React 19 binding for Roblox TypeScript. It wraps the Lua React 17 runtime and extends it with modern React 19 patterns, Tailwind-inspired styling, familiar HTML elements, and Roblox-specific optimizations.

If you want to build fast, expressive Roblox interfaces with a React-first workflow, `@nrbx/react` is built for you.

## Why @nrbx/react?

- **Text as Children** — Use string/number children in JSX, auto-wrapped as `TextLabels`
- **Tailwind Class Names** — Utility-first styling with `tw()` and `cn()`, configurable
- **HTML Elements** — Familiar `<div>`, `<span>`, `<h1>`, `<button>`, `<img>`, `<a>` etc.
- **Event Handlers** — `onClick`, `onMouseEnter`, `onFocus` instead of `Event={{ Activated }}`
- **React 19 Hooks** — `useId`, `useTransition`, `useDeferredValue`, `useOptimistic`, `useActionState`, `useSyncExternalStore`, `useInsertionEffect`
- **Class Components** — Full `Component` and `PureComponent` with lifecycle methods
- **Error Boundaries** — Graceful error handling with Roblox-aware error formatting
- **Form Handling** — React 19 form actions with `useFormStatus` and `useActionState`
- **Motion & Animations** — Spring physics, CSS transforms, gradients, hover animations
- **Configurable** — `defineConfig()` for custom colors, spacing, and style resolvers entirely based on Tailwind
- **TypeScript-first** — Full type safety, JSDoc comments, IntelliSense support

## Quick Start

```tsx
import React, { useState } from "@nrbx/react";

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <frame className="flex flex-col items-center gap-4 p-8">
      <textlabel className="text-2xl font-bold" Text={`Count: ${count}`} />
      <textbutton
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        Text="Increment"
        onClick={() => setCount(count + 1)}
      />
    </frame>
  );
}
```

## Start Here

- [Getting Started](getting-started/Getting-Started) — the first stop for install and setup
- [Tailwind Class Names](features/tailwind/Overview)
- [HTML Elements](features/HTML-Elements)
- [Hooks](core/Hooks)
- [Motion and Animations](features/Motion-and-Animations)
- [Form Handling](features/Form-Handling)
- [Class Components](core/Class-Components)

Built by the community, author: ninjaninja140

**Hot note:** This is a work-in-progress project. A lot of the documentation and jsDocs are written or have been re-written using AI (because i can write good code, but can't document for the life of me beyond minimum effort comments), so any comments and issues you may find, please just pull request with your amendments.

MIT licensed

Current version: 19.0.0
