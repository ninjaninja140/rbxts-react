# Caveats and Limitations

`@nrbx/react` is a self-contained TypeScript port of the React reconciler for Roblox, with React 19-era APIs layered on top. It has no dependency on `@rbxts-js/*` or any Lua-vendored runtime. The reconciler core still descends from the React 17-generation architecture, so a number of React 18/19 runtime semantics behave differently here than in the browser.

This page is intentionally candid: if a pattern works in the browser but depends on React 18/19 runtime behaviour, it may not behave the same way here.

## 1. Reconciler is React 17-generation

The reconciler core is a direct TypeScript port of the React 17 fiber implementation. The public API (hooks, types, entry points) is React 19-flavored, but the scheduling and update machinery underneath is not the React 18/19 concurrent implementation. That means several React 18/19 runtime features are not available in the same way they are in the browser.

### What this means

- No true Concurrent Mode
  - no `createRoot` concurrent features
  - no deep `useDeferredValue` integration
  - no Suspense-driven data fetching model
- No automatic batching
  - state updates are effectively synchronous from the runtime's perspective
- `setState(prev => next)` may not behave as expected in the same way as React DOM
- `useTransition` does not work in the React 18/19 sense with `isPending` indicators

### Workarounds

- Prefer explicit state updates and simple commit patterns instead of depending on batched transitions.
- Keep state values primitive or object-based and assign them directly when you know the next value.
- For state sequences, use refs when you need to accumulate values before committing.
- For loading or "in-flight" states, use your own boolean flags, such as `isBusy` and `isLoading`, rather than `useTransition`.

```tsx
import React, { useRef, useState } from "@nrbx/react";

function Counter() {
  const [count, setCount] = useState(0);
  const nextValue = useRef(0);

  function increment() {
    nextValue.current += 1;
    setCount(nextValue.current);
  }

  return (
    <textbutton onClick={increment}>Count: {count}</textbutton>
  );
}
```

## 2. Text-as-Children

Text-as-Children is a convenience feature: plain strings and numbers are automatically wrapped in Roblox text instances when you write JSX such as:

```tsx
<frame>Hello world</frame>
```

This is helpful, but it comes with costs.

### What this means

- It creates additional `TextLabel` instances behind the scenes.
- Large trees of text content can increase instance count.
- Empty strings and `0` are still rendered as text labels.
- If you need precise control over layout or styling, explicit `<textlabel>` elements are clearer and more predictable.

### Workarounds

- For important text, use explicit `textlabel` nodes and configure them directly.
- Avoid relying on empty text nodes as spacers.
- Use layout constraints or `UIListLayout`/`UIPadding` rather than empty labels as padding.

```tsx
function Header() {
  return (
    <frame Size={new UDim2(0, 240, 0, 48)}>
      <textlabel
        Size={new UDim2(1, 0, 1, 0)}
        Text="Welcome"
        BackgroundTransparency={1}
        TextXAlignment={Enum.TextXAlignment.Left}
      />
    </frame>
  );
}
```

## 3. Tailwind Class Names

Tailwind-style `className` support is useful, but it is not a full browser Tailwind implementation.

### What this means

- Not all Tailwind classes are supported.
- Roblox doesn't have CSS positioning, so classes like `absolute` and `relative` are not meaningful.
- There are no media queries or responsive breakpoints like `@media`.
- No `dark:` mode behavior.
- No `peer-*` or `group-*` variants.
- Only a curated subset of classes is available.
- Class resolution happens at element creation time, not at compile time, which can affect performance if you generate many dynamic class names.

### Workarounds

- Use a curated set of supported classes only.
- Prefer explicit Roblox properties for layout and position rather than trying to mimic CSS layout semantics.
- For dynamic styling, compute a small set of known class combinations or use direct instance props.

```tsx
function Card() {
  return (
    <frame
      className="flex h-16 w-64 items-center rounded-xl bg-slate-900 px-4"
      Size={new UDim2(0, 256, 0, 64)}
    >
      <textlabel
        className="text-sm font-bold text-white"
        Text="Inventory"
        BackgroundTransparency={1}
      />
    </frame>
  );
}
```

## 4. HTML Elements

Not every HTML element has a direct Roblox UI equivalent.

### Unsupported or limited elements

The following are not supported:

- `canvas`
- `video`
- `audio`
- `iframe`
- `table`, `tr`, `td`, `th`, `thead`, `tbody`

Some inputs have no Roblox equivalent or only partial approximations:

- `<input type="file">` has no real file-system upload path in Roblox.
- `<input type="datetime-local">` is approximated with a `TextBox` and custom date formatting.

### Workarounds

- Use `frame`, `textlabel`, `textbox`, `imagebutton`, and `scroller`-style layouts instead of HTML-only structures.
- For file input, build a custom upload flow using a Roblox UI and a server or remote event boundary.
- For date/time input, wire a `TextBox` to a formatter/parser you control.

```tsx
function DateInput() {
  return (
    <textbox
      Text="2026-08-12"
      PlaceholderText="YYYY-MM-DD"
      ClearTextOnFocus={false}
      TextXAlignment={Enum.TextXAlignment.Left}
    />
  );
}
```

## 5. Event System

React's browser-style `SyntheticEvent` system does not exist here.

### What this means

- Event handlers receive raw Roblox input objects, not DOM-like events.
- `event.target` is the Roblox `Instance`, not a React element.
- `event.preventDefault()` does not exist.
- `event.stopPropagation()` does not exist.
- Input events carry `InputObject`, which behaves differently from DOM events.

### Workarounds

- Treat the first callback argument as the Roblox instance and the second as input data.
- Use Roblox-native APIs such as `input.UserInputType`, `input.KeyCode`, and instance property checks instead of browser event semantics.
- Build custom event wrappers if you want a higher-level abstraction.

```tsx
function SearchBox() {
  return (
    <textbox
      onInputBegan={(rbx, input) => {
        if (input.UserInputType === Enum.UserInputType.Keyboard) {
          print("Key pressed:", input.KeyCode.Name);
        }
      }}
      onInputChanged={(rbx, input) => {
        if (input.UserInputType === Enum.UserInputType.Keyboard) {
          print("Current key state:", input.UserInputState.Name);
        }
      }}
    />
  );
}
```

## 6. No Virtual DOM Diffing for Roblox Properties

The underlying reconciler works at the Roblox instance level, not with a browser-style virtual DOM diff for all properties.

### What this means

- Some computed values that change frequently, such as `UDim2` calculations, may not diff as efficiently as a browser DOM update.
- You may need to be more careful about property churn on hot UI elements.
- Readable React code does not automatically imply perfect property diff efficiency in Roblox.

### Workarounds

- Memoize expensive derived values when possible.
- Avoid re-creating large `UDim2` objects on every render when the values are identical.
- Keep property updates stable and deterministic.
- Prefer a small number of frequently-updated elements rather than large dynamic trees.

```tsx
function Panel({ width, height }: { width: number; height: number }) {
  const size = new UDim2(0, width, 0, height);

  return <frame Size={size} BackgroundColor3={Color3.fromRGB(20, 20, 30)} />;
}
```

## 7. CSS Transforms

Transforms are not a CSS engine. They are mapped to Roblox properties such as `UDim2`, `Rotation`, and size adjustments.

### What this means

- They do not compose like browser CSS transforms.
- The transform order can differ from CSS stacking behavior.
- Complex transform logic may need to be implemented manually with Roblox UI properties.

### Workarounds

- Use `Position`, `Size`, and `Rotation` directly.
- Prefer compositional layout and explicit UI structure over complex transform chains.
- For animation, model the final state as concrete values rather than trying to mimic CSS keyframes exactly.

```tsx
function RotatedBadge() {
  return (
    <frame
      Size={new UDim2(0, 160, 0, 60)}
      Rotation={12}
      BackgroundColor3={Color3.fromRGB(255, 140, 0)}
    >
      <textlabel
        Size={new UDim2(1, 0, 1, 0)}
        Text="Featured"
        TextColor3={Color3.fromRGB(255, 255, 255)}
        BackgroundTransparency={1}
      />
    </frame>
  );
}
```

## 8. Gradients

Roblox uses `UIGradient` rather than the browser's CSS gradient engine.

### What this means

- Only linear gradients are supported in practice.
- Complex CSS gradients such as repeating, conic, or radial gradients are not modeled the same way.
- Some gradient behavior is Roblox-specific and may require property tuning.

### Workarounds

- Use `UIGradient` and keep the gradient simple.
- Make the gradient a small number of stop points rather than trying to replicate many browser gradient styles.

```tsx
function GradientPanel() {
  return (
    <frame
      Size={new UDim2(0, 260, 0, 120)}
      BackgroundColor3={Color3.fromRGB(60, 60, 80)}
    >
      <uiGradient
        Rotation={90}
        Color={ColorSequence.new({
          ColorSequenceKeypoint.new(0, Color3.fromRGB(79, 70, 229)),
          ColorSequenceKeypoint.new(1, Color3.fromRGB(14, 165, 233)),
        })}
      />
    </frame>
  );
}
```

## 9. Animations

Animations are implemented using Roblox's runtime and scheduling model.

### What this means

- Spring-like animations can use `RunService.Heartbeat`, which can affect performance if you animate many elements at once.
- Tailwind animation utilities such as `animate-pulse` and `animate-spin` are simple tween-based patterns, not browser CSS animations.
- A large number of simultaneous animations can be expensive in Roblox UI.

### Workarounds

- Keep the number of simultaneously animated elements low.
- Prefer targeted animation for active elements instead of animating every component in a large tree.
- Use `TweenService` or small custom spring logic for important transitions only.

```tsx
function AnimatedButton() {
  const [hovered, setHovered] = useState(false);

  return (
    <textbutton
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      Size={new UDim2(0, 160, 0, 42)}
      BackgroundColor3={hovered ? Color3.fromRGB(59, 130, 246) : Color3.fromRGB(37, 99, 235)}
    >
      Hover me
    </textbutton>
  );
}
```

## 10. Forms

`FormData` is only a lightweight polyfill and does not model browser form semantics fully.

### What this means

- It only supports text serialization.
- No file uploads.
- No multipart form encoding.
- You should not rely on web form paths that expect browser file upload flows.

### Workarounds

- Serialize form values into plain strings or JSON when sending to a backend.
- For file uploads, use a custom Roblox-native file picker or a server-side upload flow.
- Keep form data model simple and explicit.

```tsx
function UserForm() {
  const [name, setName] = useState("Guest");

  function submit() {
    const payload = {
      name,
    };

    print("Submit payload:", payload);
  }

  return (
    <textbox Text={name} onInputChanged={(rbx, input) => setName(rbx.Text)} />
  );
}
```

## 11. React DevTools Support

`@nrbx/react-devtools` connects to the standalone React DevTools server (the Node process you run locally), not to the browser extension.

### What this means

- The bundled backend speaks the standalone DevTools wire protocol from the React 17-era codebase, so the latest DevTools frontend may not support every panel or feature.
- Component tree, prop, and hook inspection work; profiling and some newer panels can be unreliable.

### Workarounds

- Run the standalone DevTools server version that pairs with the bundled backend if a panel misbehaves.
- Fall back to Roblox Studio's object tree and `print` statements when DevTools does not surface what you need.
- Add debug views and debug overlays to your UI when you need to inspect state.
- Log props and instance trees during development.

## 12. `useSyncExternalStore`

`useSyncExternalStore` is implemented as a lightweight wrapper around `useState` + `useEffect`, not the full React 18/19 external-store fiber semantics.

### What this means

- It is not a complete browser-like subscription system.
- `getServerSnapshot` is ignored because there is no SSR in Roblox.
- You should not assume the same semantics as web React when integrating with external mutable stores.

### Workarounds

- Use your own state + effect subscription patterns for Roblox data sources.
- Create a custom hook wrapper that listens to your store and returns derived state.

```tsx
function useRobloxStore<T>(source: T, selector: (value: T) => unknown) {
  const [value, setValue] = useState(() => selector(source));

  useEffect(() => {
    setValue(selector(source));
  }, [source, selector]);

  return value;
}
```

## 13. No StrictMode

`StrictMode` is effectively a no-op wrapper in this runtime.

### What this means

- There is no double-rendering in development.
- You cannot rely on StrictMode-specific warning behavior.
- Side effects that are intentionally double-invoked in browser React will not behave the same way.

### Workarounds

- Keep render logic pure and idempotent.
- Place side effects in `useEffect` and guard them when necessary.
- Avoid assumptions that development mode will mount/unmount twice.

## 14. No Server Components

There is no React Server Components model in the Roblox runtime.

### What this means

- No RSC.
- Everything runs on the client side.
- Data fetching and rendering patterns that rely on server component boundaries are not available.

### Workarounds

- Fetch data from remote endpoints or Roblox services in `useEffect`.
- Use client-side state, service adapters, or remote event/message patterns.
- Keep UI and data-loading logic explicit.

## 15. Memory

Roblox UI instances have a real memory cost.

### What this means

- Large React trees with many GUI instances can become heavy.
- Frequent creation and destruction of UI elements can create churn.
- Complex UI with many nested elements can be more expensive than a browser DOM tree of similar complexity.

### Workarounds

- Reuse UI instead of recreating it when possible.
- Use `ObjectPool`-style patterns for frequently created/destroyed UIs.
- Hide or recycle panels instead of mounting and unmounting large trees repeatedly.
- Keep deeply nested UIs minimal and intentionally structured.

## 16. TypeScript Build

The runtime expects `roblox-ts` 3.x+ and compiles to Lua.

### What this means

- Build output is Lua, not browser JS.
- Source maps may not be perfectly accurate for debugging.
- Some tooling assumptions from browser React projects do not carry over directly.

### Workarounds

- Keep the project on supported `roblox-ts` versions.
- Favor explicit runtime logging and simple debug panels when investigating issues.
- Expect a smaller subset of browser tooling to map cleanly to Roblox.

## 17. Refs

Refs are more Roblox-native than web React refs in a few important ways.

### What this means

- `createRef()` returns `{ current: T | undefined }`.
- `useRef()` returns `{ current: T }` and is mutable.
- Roblox instances often require explicit lookup steps such as `FindFirstChild` or a parent-child traversal pattern when the ref points to a child instance created by React.

### Workarounds

- Treat refs as instance handles, not as DOM nodes with browser semantics.
- If React creates a nested instance and you need to reach it, keep a stable parent reference and query child instances explicitly.
- Use refs for values or instance handles, but be intentional about the object graph.

```tsx
import React, { useRef } from "@nrbx/react";

function Toolbar() {
  const panelRef = useRef<Frame>();

  function focusPanel() {
    const panel = panelRef.current;
    if (panel) {
      const child = panel.FindFirstChild("Title") as TextLabel | undefined;
      if (child) {
        print("Found child:", child.Text);
      }
    }
  }

  return (
    <frame ref={panelRef} Name="Toolbar" Size={new UDim2(0, 200, 0, 60)}>
      <textlabel Name="Title" Text="Toolbar" BackgroundTransparency={1} />
    </frame>
  );
}
```

## Bottom line

`@nrbx/react` is a useful and ergonomic way to build Roblox UIs with a React-like mental model, but it is not a drop-in replacement for browser React 18/19. The runtime is intentionally simpler and more Roblox-native, which means some features are intentionally missing or behave differently.

The best way to get the most out of it is to design around Roblox's actual GUI system:

- prefer explicit Roblox properties over browser-like abstractions
- keep state updates simple and deterministic
- use explicit text and event handling where the platform differs
- treat UI performance and instance count as first-class concerns

If you know these limitations up front, you can write clearer, more stable Roblox UI code without pretending the runtime is a browser React implementation.
