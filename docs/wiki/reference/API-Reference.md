# API Reference

`@nrbx/react` is a React 19-style API for Roblox. It keeps the familiar React component model, adds web-like HTML tags for Roblox GUI instances, resolves Tailwind-style `className` strings, and renders through `@nrbx/react-roblox`.

This page is the package reference for the public API surface. It is organized by module and concept so it is easy to browse from the GitHub Wiki.

## Main React API

```tsx
import React, { useState } from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

const root = createRoot(new Instance("ScreenGui"));

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <React.Fragment>
      <div className="flex items-center gap-2 p-4">
        <button
          className="rounded bg-blue-500 px-3 py-2 text-white"
          onClick={() => setCount(c => c + 1)}
        >
          Count: {count}
        </button>
      </div>
    </React.Fragment>
  );
}

root.render(<Counter />);
```

### `React.createElement(type, config, ...children)`

Creates a React element. In `@nrbx/react`, this wrapper does the following:

- resolves HTML tags to Roblox GUI classes (`div` -> `Frame`, `button` -> `TextButton`)
- auto-wraps text children (`"Hello"`, `123`) into Roblox text elements when needed
- translates React-style events like `onClick` into Roblox `Event` tables
- parses Tailwind-style `className` values into Roblox properties

```tsx
const el = React.createElement(
  "button",
  { className: "bg-blue-500 p-2", onClick: () => print("clicked") },
  "Save"
);
```

### `React.Fragment`

Fragment component used for grouping multiple children without creating a wrapper instance.

```tsx
const ui = (
  <>
    <h1>Title</h1>
    <p>Body</p>
  </>
);
```

### `React.StrictMode`

No-op wrapper. Roblox does not support the browser-style concurrent-mode dev checks, so this is kept as a compatibility layer.

```tsx
<React.StrictMode>
  <App />
</React.StrictMode>
```

## Type Utilities

```tsx
type ReactNode =
  | ReactElement<any>
  | string
  | number
  | boolean
  | null
  | undefined
  | ReactNode[];

type ReactElement<P = any> = {
  type: string | ComponentType<P>;
  props: P & { children?: ReactNode };
  key: string | null;
  ref?: unknown;
};

type ComponentType<P = {}> =
  | ((props: P) => ReactNode)
  | (new (props: P) => Component<P, any>);

type FC<P = {}> = (props: P) => ReactNode;

type PropsWithChildren<P> = P & { children?: ReactNode };
type PropsWithRef<P, R = unknown> = P & { ref?: { current: R | null } };

type CSSProperties = Partial<Record<string, unknown>>;
type ClassName =
  | string
  | string[]
  | Record<string, boolean>
  | ReturnType<typeof cn>;
```

### `React.ReactNode`

Allowed child shapes for React elements.

### `React.ReactElement<P>`

The runtime element object created by `React.createElement`.

### `React.ComponentType<P>`

A class or function component constructor or callable component.

### `React.FC<P>` / `React.FunctionComponent<P>`

Function component type aliases.

```tsx
const Card: React.FC<{ title: string }> = ({ title }) => <div>{title}</div>;
```

### `React.PropsWithChildren<P>`

Props extended with an optional `children` field.

### `React.PropsWithRef<P>`

Props extended with a `ref` field.

### `React.CSSProperties`

Roblox GUI property types and style properties. Typical values include `Size`, `Position`, `BackgroundColor3`, `TextColor3`, `LayoutOrder`, etc.

### `React.ClassName`

Classname input accepted by helpers such as `tw()` and `cn()`.

```tsx
const c: React.ClassName = "flex items-center";
const d: React.ClassName = ["px-4", condition && "bg-blue-500"];
```

## Component Types

### `React.Component<P, S>`

Base class component. Supports lifecycle methods and `state`.

```tsx
class Counter extends React.Component<{ initialValue?: number }, { count: number }> {
  state = { count: this.props.initialValue ?? 0 };

  render() {
    return <button onClick={() => this.setState({ count: this.state.count + 1 })}>{this.state.count}</button>;
  }
}
```

### `React.PureComponent<P, S>`

Pure class component with shallow prop/state comparison before re-render.

### `React.memo<P>(component, compare?)`

Higher-order component that memoizes a component for shallow-equality prop checks.

```tsx
const MemoButton = React.memo(function Button(props: { label: string }) {
  return <button>{props.label}</button>;
}, (prev, next) => prev.label === next.label);
```

### `React.cloneElement(element, config?, ...children)`

Clones an existing React element and merges new props.

```tsx
const next = React.cloneElement(<button className="bg-gray-200" />, {
  className: "bg-blue-500",
  children: "Save",
});
```

### `React.isValidElement(object)`

Type guard for React element values.

```tsx
const ok = React.isValidElement(<div />);
```

### `React.Children`

Utilities for working with `children`.

```tsx
React.Children.map(children, child => child);
React.Children.forEach(children, child => {});
React.Children.count(children);
const only = React.Children.only(children);
const arr = React.Children.toArray(children);
```

### `React.createRef<T>()`

Creates a ref object with a mutable `current` field.

```tsx
const inputRef = React.createRef<TextBox>();
```

## Context

### `React.createContext<T>(defaultValue)`

Creates a context object.

```tsx
const ThemeContext = React.createContext({ accent: Color3.fromRGB(59, 130, 246) });
```

### `Context.Provider`

Provides a context value to descendants.

```tsx
<ThemeContext.Provider value={{ accent: Color3.fromRGB(255, 255, 255) }}>
  <ThemedButton />
</ThemeContext.Provider>
```

### `Context.Consumer`

Consumes a context value with a render prop.

```tsx
<ThemeContext.Consumer>
  {value => <button TextColor3={value.accent}>Theme</button>}
</ThemeContext.Consumer>
```

### `React.useContext(context)`

Hook for reading the current context value.

```tsx
const theme = React.useContext(ThemeContext);
```

## Hooks (Core)

```tsx
// State and lifecycle
useState<S>(initialState: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void]
useReducer<R, A>(reducer: (state: R, action: A) => R, initialState: R): [R, (action: A) => void]
useRef<T>(initialValue?: T): { current: T | undefined }
useEffect(effect: () => void | (() => void), deps?: unknown[]): void
useLayoutEffect(effect: () => void | (() => void), deps?: unknown[]): void
useMemo<T>(factory: () => T, deps: unknown[]): T
useCallback<T extends (...args: any[]) => any>(callback: T, deps: unknown[]): T
useContext<T>(context: React.Context<T>): T
useImperativeHandle<T, R extends T>(ref: { current: T | undefined }, createHandle: () => R, deps?: unknown[]): void
```

### `useState` 

Stores local state and triggers rerenders when updated.

### `useReducer`

Reducer-based state management for complex state transitions.

### `useRef`

Keeps mutable values across renders without causing rerenders.

### `useEffect`

Runs after render; useful for event subscriptions and cleanup.

### `useLayoutEffect`

Runs after DOM/GUI mutations but before paint; useful for layout measurements.

### `useMemo`

Memoizes expensive calculations based on dependency changes.

### `useCallback`

Memoizes a callback function for stable identity.

### `useContext`

Reads from a context object.

### `useImperativeHandle`

Exposes imperative methods via a ref.

## Hooks (React 19 Polyfills)

```tsx
useId(): string
useTransition(): [boolean, (callback: () => void) => void]
useDeferredValue<T>(value: T): T
useSyncExternalStore<T>(
  subscribe: (callback: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T
useInsertionEffect(effect: () => void | (() => void), deps?: unknown[]): void
useEffectEvent<T extends (...args: any[]) => void>(callback: T): T
useOptimistic<T, U>(
  initialValue: T,
  updateFn?: (state: T, payload: U) => T,
): [T, (payload: U) => void]
use<T>(resource: Promise<T> | { read(): T }): T
useActionState<S, P>(
  action: (prevState: S, payload: P) => S | Promise<S>,
  initialState: S,
  permalink?: string,
): [S, (payload: P) => void, boolean]
```

### `useId`

Generates a stable unique identifier for IDs and accessibility hooks.

### `useTransition`

Marks work as non-urgent and returns a pending flag plus a transition start function.

### `useDeferredValue`

Defers expensive updates until the browser/engine is idle.

### `useSyncExternalStore`

Synchronizes with external data stores or Roblox runtime state.

### `useInsertionEffect`

Runs before layout effects for style injection and CSS-like work.

### `useEffectEvent`

Creates a stable event handler that is not recreated as dependencies change.

### `useOptimistic`

Applies optimistic UI updates before a background async action resolves.

### `use`

Reads a Promise or context-like resource with React 19 semantics.

### `useActionState`

Manages async action results and pending state, similar to React 19 forms.

```tsx
const [state, submit, pending] = useActionState(
  async (previous, payload: { name: string }) => ({
    ok: true,
    name: payload.name || previous.name,
  }),
  { ok: false, name: "" }
);
```

## Hooks (Motion)

```tsx
interface SpringConfig {
  tension?: number;
  friction?: number;
  mass?: number;
  restVelocity?: number;
  restDelta?: number;
}

interface Motion<T = number> {
  current(): number;
  map<U>(fn: (progress: number) => U): U;
  spring(target: number, config?: SpringConfig): void;
  snap(value: number): void;
}

useMotion(initialValue?: number): [Motion, (target: number) => void]
useHoverMotion(initialValue?: number): [Motion, (target: number) => void]
```

### `useMotion(initialValue?)`

Creates a spring-driven animated value for Roblox UI props.

```tsx
const [motion, setMotion] = React.useMotion(0);

useEffect(() => {
  setMotion.spring(1, { tension: 200, friction: 22 });
}, []);

<frame BackgroundTransparency={motion.map(v => 1 - v)} />
```

### `Motion.current()`

Returns the current motion value.

### `Motion.map(fn)`

Maps the motion progress to a Roblox value such as `Color3`, `UDim2`, or a numeric property.

### `Motion.spring(target, config?)`

Animates toward a target with spring physics.

### `Motion.snap(value)`

Imposes an immediate value without spring interpolation.

## Hooks (Compiler)

### `useMemoCache(size: number): Array<any>`

Compiler hook used by the React compiler to hold memoized values across renders.

```tsx
const cache = React.useMemoCache(4);
```

This is primarily for React Compiler / Forget integration and should not normally be called by hand unless you are implementing compiler-generated code.

## Styles API

`@nrbx/react` includes a Tailwind-like utility layer for Roblox GUI props and layout.

### Core Functions

```tsx
// Tagged template utility
const className = tw`flex items-center gap-2 p-4`;

// Conditional join utility
const merged = cn("flex", active && "bg-blue-500", !disabled && "opacity-100");

configureStyles(config: Partial<StyleConfig>): void
defineConfig(config: StyleSystemConfig): void
createStyleSystem(config: StyleSystemConfig): StyleSystem
processClassName(className: string): Record<string, unknown>
resolveArbitraryValue(value: string): unknown
resolveColor(value: string): Color3
resolveGradient(value: string): Record<string, unknown>
```

### `tw(strings, ...values)`

Tagged template literal for Tailwind-style className generation.

```tsx
const props = tw`flex items-center p-4 bg-slate-900 text-white rounded-lg`;
return <frame {...props} />;
```

### `cn(...inputs)`

Conditional class joiner. Values are filtered out when falsy, similar to `clsx`.

```tsx
className={cn("rounded", active && "bg-blue-500", disabled && "opacity-50")}
```

### `configureStyles(config)`

Override the runtime style config at startup or in a plugin.

### `defineConfig(config)`

Define a complete style system configuration for theme tokens and custom rules.

### `createStyleSystem(config)`

Create an isolated style system instance without mutating the global config.

### `processClassName(className)`

Resolves a class string into actual Roblox props and virtual children.

### `resolveArbitraryValue(value)`

Parses arbitrary values such as `h-[40px]`, `[10]`, or custom CSS-like values into Roblox-friendly numbers or props.

### `resolveColor(value)`

Parses a color token or arbitrary color string into a `Color3` object.

### `resolveGradient(value)`

Parses gradient values and resolves them to Roblox-compatible gradient props.

### Color Tokens

Built-in palette names:

- `slate`, `gray`, `zinc`, `neutral`, `stone`
- `red`, `orange`, `amber`, `yellow`, `lime`
- `green`, `emerald`, `teal`, `cyan`, `sky`
- `blue`, `indigo`, `violet`, `purple`, `fuchsia`
- `pink`, `rose`

Each palette supports shades from `50` through `950`.

```tsx
className="bg-blue-500 text-slate-100 border-red-300"
```

### Spacing Scale

The default spacing scale follows Tailwind-like values: `0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96`.

These map to pixel values around the default design system, including `0, 4, 8, 12, 16, ..., 384`.

### Typography Scale

```tsx
text-xs, text-sm, text-base, text-lg, text-xl,
text-2xl, text-3xl, text-4xl, text-5xl,
text-6xl, text-7xl, text-8xl, text-9xl
```

This maps to the default Roblox font sizes.

## HTML Elements API

`@nrbx/react` provides browser-like element aliases that resolve to Roblox GUI class names.

### Default HTML-to-Roblox mapping

```tsx
<div />        // Frame
<span />       // TextLabel
<p />          // TextLabel
<h1 />         // TextLabel
<h6 />         // TextLabel
<button />     // TextButton
<a />          // TextButton
<img />        // ImageLabel
<input />      // TextBox
<textarea />   // TextBox
<ul />         // ScrollingFrame
<ol />         // ScrollingFrame
<li />         // TextLabel
<label />      // TextLabel
<form />       // Frame
<section />    // Frame
<header />     // Frame
<footer />     // Frame
<nav />        // Frame
<main />       // Frame
<article />    // Frame
<aside />      // Frame
<table />      // Frame
<tr />         // Frame
<td />         // Frame
<th />         // Frame
<fieldset />   // Frame
<legend />     // TextLabel
<select />     // Custom selector
<option />     // Choice item
```

You can override the mapping with `setHTMLElementMap` or custom default configs when needed.

## Drag & Resize Props (Experimental)

`@nrbx/react` ships two experimental, opt-in behavior props for Roblox GUI elements: `draggable` and `resizable`. Both are disabled by default, and both are marked experimental — their behavior may change in future releases.

### `draggable`

When `draggable` is `true`, the element can be moved freely by dragging it. Movement is clamped to the bounds of the element's parent container, so it can never be dragged outside its parent.

```tsx
<frame
  Position={new UDim2(0, 50, 0, 50)}
  Size={new UDim2(0, 200, 0, 120)}
  draggable
/>
```

### `resizable`

When `resizable` is `true`, you can tug any of the element's four corners to resize it. Resizing is clamped to the parent container: the element can never grow larger than its parent. A minimum size of 10 pixels is enforced so the element stays usable.

```tsx
<frame
  Position={new UDim2(0, 50, 0, 50)}
  Size={new UDim2(0, 200, 0, 120)}
  resizable
/>
```

The two props can be combined, and both can be toggled at runtime. Setting a prop back to `false` stops the corresponding interaction and cleans up its internal listeners.

### Notes

- Only applies to `GuiObject` instances (for example `Frame`, `TextLabel`, `TextButton`, `ImageLabel`) — elements that expose `Position` and `Size`.
- Only runs on the client; it requires `RunService:IsClient()`.
- Experimental: the API surface and behavior are not yet stable.

## Events API

`@nrbx/react` translates React-style props to Roblox `Event` tables.

```tsx
<button
  onClick={() => print("clicked")}
  onMouseEnter={() => print("hover")}
  onInputChanged={(rbx) => print(rbx.Text)}
/>
```

This becomes a Roblox event table structurally equivalent to:

```tsx
<Event={{
  Activated: () => print("clicked"),
  MouseEnter: () => print("hover"),
  InputChanged: rbx => print(rbx.Text),
}} />
```

### Event translation map

```ts
onClick                -> Activated
onMouseEnter           -> MouseEnter
onMouseLeave           -> MouseLeave
onMouseButton1Down     -> MouseButton1Down
onMouseButton1Up       -> MouseButton1Up
onMouseButton2Down     -> MouseButton2Down
onMouseButton2Up       -> MouseButton2Up
onMouseMoved           -> MouseMoved
onMouseWheelForward    -> MouseWheelForward
onMouseWheelBackward   -> MouseWheelBackward
onInputBegan           -> InputBegan
onInputEnded           -> InputEnded
onInputChanged         -> InputChanged
onTouchTap             -> TouchTap
onTouchLongPress       -> TouchLongPress
onDragBegin            -> DragBegin
onDragMoved            -> DragMoved
onDragEnded            -> DragEnded
onSelectionGained      -> SelectionGained
onSelectionLost        -> SelectionLost
onFocused              -> Focused
onFocusLost            -> FocusLost
onDoubleClick          -> MouseButton1Click
onContextAction        -> ContextAction
```

## Forms API

`@nrbx/react` supports web-style form APIs, adapted to Roblox GUI worlds.

```tsx
<form className="flex flex-col gap-2">
  <label>Display name</label>
  <input type="text" value={name} onChange={setName} />

  <button type="submit">Submit</button>
</form>
```

### Form elements

- `<form>`
- `<input>`
- `<select>`
- `<option>`
- `<textarea>`
- `<label>`
- `<fieldset>`
- `<legend>`
- `<button type="submit">`

### `useFormStatus()`

```tsx
const status = useFormStatus();
// { pending, data, method, action }
```

Returns:

```ts
{
  pending: boolean;
  data: FormData | null;
  method: "get" | "post" | string;
  action: string | null;
}
```

### `useActionState(action, initialState, permalink?)`

```tsx
const [state, dispatch, isPending] = useActionState(
  async (prevState, payload: { username: string }) => {
    return { ok: true, username: payload.username };
  },
  { ok: false, username: "" }
);
```

Signature:

```ts
useActionState<S, P>(
  action: (prevState: S, payload: P) => S | Promise<S>,
  initialState: S,
  permalink?: string,
): [state: S, dispatch: (payload: P) => void, isPending: boolean]
```

## Error Boundary API

### `ErrorBoundary`

```tsx
<ErrorBoundary
  fallback={(error) => <textlabel Text={error.message} />}
  onError={(error, info) => print(error, info)}
  onReset={() => print("reset")}
  resetKeys={[value]}
>
  <App />
</ErrorBoundary>
```

Props:

```ts
interface ErrorBoundaryProps {
  children?: React.ReactNode;
  fallback?: React.ReactNode | ((error: ReactErrorInfo) => React.ReactNode);
  onError?: (error: unknown, info: ReactErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: unknown[];
}
```

### `parseErrorSource(message)`

Parses an error message to extract a source file and line number.

```ts
parseErrorSource(message: string): { file?: string; line?: number } | undefined
```

### `formatReactError(error)`

Formats a thrown value into a developer-friendly error object.

```ts
formatReactError(error: unknown): {
  message: string;
  err: unknown;
  stack?: string;
  sourceFile?: string;
  lineNumber?: number;
  componentStack?: string;
  timestamp: number;
}
```

## `react-roblox` API

`@nrbx/react-roblox` is the renderer for the Roblox runtime.

```tsx
import React from "@nrbx/react";
import { createRoot, createPortal, flushSync } from "@nrbx/react-roblox";

const root = createRoot(new Instance("ScreenGui"));
root.render(<frame />);

const portal = createPortal(<textlabel Text="Overlay" />, new Instance("ScreenGui"));
flushSync(() => {
  setState(123);
});
```

### `createRoot(container)`

```ts
createRoot(container: Instance): {
  render(element: React.ReactElement): void;
  unmount(): void;
}
```

### `createPortal(children, container)`

```ts
createPortal(children: React.ReactNode, container: Instance): React.ReactNode
```

### `flushSync(callback)`

```ts
flushSync(callback: () => void): void
```

### `createBlockingRoot(container)`

```ts
createBlockingRoot(container: Instance): { render(...): void; unmount(): void }
```

### `createLegacyRoot(container)`

```ts
createLegacyRoot(container: Instance): { render(...): void; unmount(): void }
```

## Scheduler API

`@nrbx/react` exposes a cooperative scheduling layer for transitions and deferred work.

```ts
unstable_scheduleCallback(priority: SchedulerPriority, callback: () => void): Task
unstable_cancelCallback(task: Task): void
unstable_shouldYield(): boolean
unstable_now(): number
```

### Priority levels

```ts
Immediate
UserBlocking
Normal
Low
Idle
```

These map to the scheduler's cooperative work priorities in the Roblox runtime.

## Notes

- `@nrbx/react` is intentionally React-like, not a 1:1 browser DOM clone.
- HTML aliases are convenience shims for common Roblox GUI instances.
- Tailwind utility parsing is deliberately lightweight and designed for Roblox property sets.
- `React.StrictMode` is a compatibility surface; it does not enable browser-style concurrency checks on Roblox.

For more examples, see the wiki pages for Getting Started, HTML Elements, Tailwind Class Names, Forms, Error Boundaries, and Hooks.
