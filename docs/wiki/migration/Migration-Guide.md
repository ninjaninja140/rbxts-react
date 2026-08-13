# Migration Guide: @rbxts/react v17 to @nrbx/react v19

This guide helps you move an existing `@rbxts/react` v17 project to `@nrbx/react` v19 with the least friction.

`@nrbx/react` keeps the React-style development model you already know, but adds a React 19-style runtime, JSX wrapper, `className` styling, text-as-children support, and a few compatibility changes that are worth handling intentionally.

## At a glance

The biggest changes are:

- Package rename: `@rbxts/react` → `@nrbx/react`
- New JSX factory: `React.createElement` wrapper with text/`className`/event support
- String children auto-create `TextLabel`s
- `Event={{ Activated: ... }}` is still accepted, but `onClick={...}` is preferred
- Styling moves from raw Roblox props to `className` / `tw()` / `defineConfig`
- HTML element aliases like `<div>`, `<span>`, `<button>`, `<h1>` are available
- New React 19 APIs are available (`useId`, `useTransition`, `useDeferredValue`, `useActionState`, etc.)
- Error boundaries, forms, motion, gradients, and class components are built in

---

## 1. Update the package

### Package.json

Before:

```json
{
  "dependencies": {
    "@rbxts/react": "^17.3.7"
  }
}
```

After:

```json
{
  "dependencies": {
    "@nrbx/react": "^19.0.0"
  }
}
```

Install:

```bash
npm install @nrbx/react@^19.0.0
```

If you also use the Roblox renderer, install or update it as needed:

```bash
npm install @nrbx/react-roblox
```

---

## 2. Update imports

The import changes are straightforward:

Before:

```tsx
import React from "@rbxts/react";
```

After:

```tsx
import React from "@nrbx/react";
```

You should also update any named imports:

```tsx
import React, { useState, useMemo, useEffect } from "@nrbx/react";
```

If you imported a project helper or utility from the old package namespace, check whether it was moved or renamed.

---

## 3. Update JSX transformation setup

`@nrbx/react` uses a `React.createElement` wrapper that understands Roblox-friendly props, text children, event props, and `className`.

If you previously configured custom JSX output, make sure it points at the new runtime.

### tsconfig.json

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "React.createElement",
    "jsxFragmentFactory": "React.createFragment"
  }
}
```

### roblox-ts / `rbxtsc` setup

If your project has a custom `tsconfig` or a `roblox-ts` config that was pointing at the legacy package, update the JSX configuration to match the new runtime:

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "React.createElement",
    "jsxFragmentFactory": "React.createFragment",
    "paths": {
      "@nrbx/react": ["node_modules/@nrbx/react/src"]
    }
  }
}
```

If you previously used a custom factory or custom JSX transform, check any `jsxInject` / `jsxFactory` references and replace them with the `@nrbx/react` equivalent.

---

## 4. Event prop migration

The main migration is moving from the old Roblox-ish `Event={{ ... }}` pattern toward more React-like event props such as `onClick`, `onChange`, and similar `onXxx` props.

### Preferred pattern

```tsx
<textbutton
  Text="Click"
  onClick={() => print("hi")}
  className="bg-blue-500"
/>
```

### Before / After example

```tsx
Before:
<textbutton
  Text="Click"
  Event={{ Activated: () => print("hi") }}
  BackgroundColor3={Color3.fromRGB(0, 100, 255)}
/>

After:
<textbutton
  Text="Click"
  onClick={() => print("hi")}
  className="bg-blue-500"
/>
```

### Event migration table

| Old pattern | Preferred v19 pattern | Notes |
| --- | --- | --- |
| `Event={{ Activated: handler }}` | `onClick={handler}` | Use the React-style event name when available |
| `Event={{ MouseButton1Click: handler }}` | `onClick={handler}` | `onClick` is preferred for button-like interactions |
| `Event={{ TextChanged: handler }}` | `onChange={handler}` | Common React-style form naming |
| `Event={{ FocusLost: handler }}` | `onBlur={handler}` | More React-like semantics |
| `Event={{ InputBegan: handler }}` | `onMouseDown={handler}` or other specific handlers | Some event names are mapped by element behavior |

Important:

- `Event={{ ... }}` still works for compatibility.
- `onXxx` is preferred for readability and consistency.
- If you still use `Event`, it is not an immediate blocker — just treat it as a migration path, not the target pattern.

---

## 5. Text as children

`@nrbx/react` supports plain text children automatically. If you pass a string or number as a child to a container, it is turned into a `TextLabel` automatically instead of requiring explicit wrapping.

Before:

```tsx
<frame>
  <textlabel Text="Hello" BackgroundTransparency={1} />
</frame>
```

After:

```tsx
<frame>
  Hello
</frame>
```

This is especially useful for labels, headings, and nested text content:

```tsx
<div className="p-4">
  <h1 className="text-2xl font-bold">Welcome</h1>
  {"Ready to play"}
</div>
```

Text-capable elements such as `TextLabel`, `TextButton`, and `TextBox` receive the text directly as their `Text` property.

---

## 6. Styling migration: raw Roblox props → `className`

The new style system is built around `className` and utility classes rather than manually setting `BackgroundColor3`, `TextColor3`, `BorderSizePixel`, and similar props everywhere.

Before:

```tsx
<textbutton
  Text="Save"
  BackgroundColor3={Color3.fromRGB(59, 130, 246)}
  TextColor3={Color3.fromRGB(255, 255, 255)}
  BorderSizePixel={0}
  Size={new UDim2(0, 140, 0, 40)}
/>
```

After:

```tsx
<textbutton
  Text="Save"
  className="bg-blue-500 text-white border-0 rounded-md"
  Size={new UDim2(0, 140, 0, 40)}
/>
```

### Optional: use `tw()` and config

```tsx
import React, { tw, defineConfig } from "@nrbx/react";

defineConfig({
  colors: {
    brand: { 500: "#3b82f6", 600: "#2563eb" },
  },
});

const buttonClass = tw("rounded-md bg-brand-500 px-4 py-2 text-white");

return <button className={buttonClass}>Save</button>;
```

This is the recommended direction if you want to keep styling consistent and readable.

---

## 7. HTML elements are available

`@nrbx/react` provides familiar HTML element aliases such as:

- `div`
- `span`
- `h1`, `h2`, `h3`
- `button`
- `input`
- `label`
- `img`

This makes migration easier when you are used to web-like markup.

Example:

```tsx
<div className="flex flex-col gap-2 p-4">
  <h1 className="text-2xl font-bold">Profile</h1>
  <span className="text-sm text-gray-500">Welcome back.</span>
  <button className="bg-blue-500 text-white px-4 py-2 rounded">Open</button>
</div>
```

If you prefer to keep direct Roblox control names, you can still do that; the new HTML aliases are simply a more familiar option.

---

## 8. JSX / component type migration

The component model is familiar, but the runtime has updated semantics in a few places.

### Function components

Before:

```tsx
const Greeting = (props: { name: string }) => {
  return <textlabel Text={`Hello, ${props.name}`} />;
};
```

After:

```tsx
const Greeting = ({ name }: { name: string }) => {
  return <textlabel Text={`Hello, ${name}`} />;
};
```

### Class components

`@nrbx/react` supports class components with full lifecycle support.

```tsx
class Counter extends React.Component<{}, { value: number }> {
  state = { value: 0 };

  render() {
    return (
      <button className="bg-blue-500" onClick={() => this.setState({ value: this.state.value + 1 })}>
        {this.state.value}
      </button>
    );
  }
}
```

### Refs

A breaking change to be aware of:

- `ref` objects now look like `{ current: T }`
- they are no longer raw Roblox object refs in the same way they were in older code

Before:

```tsx
const myTextLabel = useRef<TextLabel>();
```

After:

```tsx
const myTextLabel = React.useRef<TextLabel | undefined>(undefined);
```

In practice, this means reading the value from `myTextLabel.current` instead of treating the ref as the instance object itself.

---

## 9. New hooks and React 19 features

`@nrbx/react` includes React 19 APIs and helpers that are not available in older `@rbxts/react` versions.

Examples include:

- `useId`
- `useTransition`
- `useDeferredValue`
- `useActionState`
- `useFormStatus`
- `useOptimistic`
- `use` (for promise/context patterns)
- `startTransition`

Example:

```tsx
import React, { useId, useTransition } from "@nrbx/react";

function SubmitButton() {
  const id = useId();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      id={id}
      className="bg-blue-500 text-white px-4 py-2 rounded"
      onClick={() => {
        startTransition(() => {
          print("transitioning");
        });
      }}
    >
      {isPending ? "Saving..." : "Save"}
    </button>
  );
}
```

### Error boundaries

`@nrbx/react` includes built-in error boundary support to catch rendering failures in child trees.

```tsx
class AppErrorBoundary extends React.Component {
  static getDerivedStateFromError(error: unknown) {
    print("render error", error);
    return { hasError: true };
  }

  render() {
    return this.props.children;
  }
}
```

### Forms

The new form APIs make server-action style patterns easier, especially for user input and optimistic updates.

```tsx
import React, { useActionState, useFormStatus } from "@nrbx/react";

function SubmitForm() {
  const [state, formAction] = useActionState(async () => {
    print("submitted");
    return "Saved";
  }, "Idle");

  return (
    <form action={formAction}>
      <button className="bg-green-500 text-white px-4 py-2 rounded">{state}</button>
    </form>
  );
}
```

### Motion and animation

`@nrbx/react` includes motion/animation support in the runtime, making UI transitions easier without writing custom tween code for every interaction.

```tsx
<div className="transition-all duration-200 hover:scale-105">Hello</div>
```

### Gradient support

You can use gradient backgrounds and rich visual styling through the config and `className` layer:

```tsx
<div className="bg-gradient-to-r from-blue-500 to-purple-500" />
```

---

## 10. Common issues and solutions

### Issue: `Event={{ ... }}` still exists but is no longer the preferred pattern

Solution:

- Keep it working temporarily during the migration
- Convert to `onXxx={handler}` as you touch each component

### Issue: Raw Roblox props are not styling the UI the way you expect

Solution:

- Replace raw style props with `className`
- Use `tw()` for repeated styles
- Centralize shared rules with `defineConfig()`

### Issue: Text content is not rendering

Solution:

- Remember that plain string children are now auto-wrapped for container elements
- Use `Text` for explicit text values on text-capable controls

### Issue: Ref values are no longer the raw Roblox instance

Solution:

- Read from `ref.current`
- Type the ref as `TextLabel | undefined`, `Frame | undefined`, etc.

### Issue: JSX factory mismatch

Solution:

- Ensure `tsconfig.json` uses `jsxFactory: "React.createElement"`
- Recheck any custom project transforms or old `roblox-ts` settings

### Issue: `className` is being treated as a regular prop

Solution:

- Confirm you are using the new runtime and JSX wrapper
- Check that you are passing the `className` prop to the component tree after the migration

---

## 11. Gradual migration: mix old and new patterns

You do not have to rewrite everything in one pass. The new runtime allows a gradual migration path.

Example:

```tsx
function Toolbar() {
  return (
    <frame Size={new UDim2(1, 0, 0, 56)} BackgroundColor3={Color3.fromRGB(17, 24, 39)}>
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded"
        Event={{
          Activated: () => print("Still works during migration"),
        }}
      >
        Save
      </button>
    </frame>
  );
}
```

As you touch a component, convert it to the new pattern:

```tsx
function Toolbar() {
  return (
    <div className="h-14 w-full bg-slate-900">
      <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={() => print("Preferred")}>
        Save
      </button>
    </div>
  );
}
```

This lets teams migrate component by component without a big-bang rewrite.

---

## 12. Breaking changes to keep in mind

The following are the key compatibility changes in v19:

- `Event={{ ... }}` still works, but `onXxx` is preferred
- `React.createPortal()` and `React.flushSync()` are now in `@nrbx/react-roblox` (the renderer), matching React's own split between `react` and `react-dom`. Import them as `import { createPortal, flushSync } from "@nrbx/react-roblox"`.
- `React.useState()`, `React.useEffect()`, and all other hooks are available on the default import (`import React from "@nrbx/react"` → `React.useState(...)`). Both `React.useState()` and `import { useState } from "@nrbx/react"` work.
- Ref objects are `{ current: T }` rather than raw Roblox object refs
- Some internal types and runtime expectations changed
- Styling is now driven by `className` / config rather than direct prop-by-prop Roblox assignments
- JSX output relies on the new `React.createElement` wrapper

These are manageable, and most migrations are a matter of updating your style and event patterns rather than rewriting your entire app.

---

## 13. Recommended migration order

If you want the least painful upgrade path, do this in order:

1. Update `package.json` and install `@nrbx/react`
2. Update `import React from "@rbxts/react"` to `@nrbx/react`
3. Fix your JSX factory / `tsconfig` setup
4. Replace major `Event={{ ... }}` handlers with `onXxx={...}`
5. Introduce `className` and `tw()` for styling
6. Convert repeated raw Roblox props to utility classes
7. Adopt HTML elements and text-as-children where helpful
8. Optionally move to new hooks, forms, motion, and error boundaries

---

## 14. Final recommendation

`@nrbx/react` v19 is a modernized, React-19-style API surface. The migration is most often a package rename plus a style and event cleanup, not a complete rewrite.

The most important decisions are:

- update imports
- update `jsxFactory`
- prefer `onXxx` events over `Event={{ ... }}`
- adopt `className`/`tw()` styling
- migrate gradually as you touch components

If you follow those steps, most projects move over cleanly and gain a more ergonomic React-like development experience.
