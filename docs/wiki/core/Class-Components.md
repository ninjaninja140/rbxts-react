# Class Components

`@nrbx/react` supports both functional components and class-based components. Class components are useful when you want explicit lifecycle hooks, stateful logic, error boundaries, or a more object-oriented pattern that matches React 16+ conventions.

Unlike function components, a class component is declared with `React.Component` or `React.PureComponent` and owns its own state.

## Basic class component with props and state

```tsx
import React from "@nrbx/react";

class Counter extends React.Component<
  { initialCount?: number },
  { count: number }
> {
  constructor(props: { initialCount?: number }) {
    super(props);
    this.state = {
      count: props.initialCount ?? 0,
    };
  }

  componentDidMount() {
    print("Counter mounted!");
  }

  componentDidUpdate(prevProps: { initialCount?: number }, prevState: { count: number }) {
    if (prevState.count !== this.state.count) {
      print(`Count changed from ${prevState.count} to ${this.state.count}`);
    }
  }

  componentWillUnmount() {
    print("Counter is unmounting");
  }

  render() {
    return (
      <textbutton
        Text={`Count: ${this.state.count}`}
        onClick={() => this.setState({ count: this.state.count + 1 })}
      />
    );
  }
}
```

A class component typically includes:

- `constructor(props)` to initialize state and bind methods
- `state` as an object that is managed internally
- `render()` to return JSX
- lifecycle methods for setup, updates, and cleanup

Important rules:

- `this.state` should be treated as read-only from outside the component.
- Update state with `this.setState(...)` instead of mutating `this.state` directly.
- `render()` must return a `ReactElement | null`.

## Component API

The class component model in `@nrbx/react` follows the React 16+ lifecycle shape:

```tsx
class MyComponent extends React.Component<Props, State> {
  static contextType?: React.Context<any>;

  state: State = { ... };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return null;
  }

  shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
    return true;
  }

  getSnapshotBeforeUpdate(prevProps: Props, prevState: State): any {
    return null;
  }

  componentDidMount() {}

  componentDidUpdate(prevProps: Props, prevState: State) {}

  componentWillUnmount() {}

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {}

  render(): React.ReactElement | null {
    return <frame />;
  }
}
```

### Core methods

- `constructor(props: P)` initializes state and binds any custom handlers.
- `setState<K extends keyof S>(state: Pick<S, K> | S | null, callback?: () => void)` updates the component and triggers a re-render.
- `render()` is required and returns JSX.
- `componentDidMount()` runs once after the component first renders.
- `componentDidUpdate(prevProps, prevState)` runs after updates.
- `componentWillUnmount()` runs just before removal.
- `shouldComponentUpdate(nextProps, nextState)` lets you skip unnecessary renders.
- `componentDidCatch(error, errorInfo)` supports error boundary behavior.
- `getDerivedStateFromProps(props, state)` derives state from incoming props during updates.
- `getSnapshotBeforeUpdate(prevProps, prevState)` is used for values captured right before the DOM commit.

`props.children` is available exactly as in normal React:

```tsx
class Card extends React.Component<{ children?: React.ReactNode }, {}> {
  render() {
    return <frame>{this.props.children}</frame>;
  }
}
```

## Lifecycle diagram

```text
Mount phase:
  constructor() -> render() -> componentDidMount()

Update phase:
  setState() / props change -> shouldComponentUpdate() -> render() -> getSnapshotBeforeUpdate() -> componentDidUpdate()

Unmount phase:
  componentWillUnmount()
```

This is the same lifecycle shape used by React 16+ class components, adapted to the Roblox runtime.

## Error boundary implementation

Error boundaries catch rendering errors in children components and let you show a fallback UI.

```tsx
import React from "@nrbx/react";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    print("Caught error:", error.message);
    print("Stack:", errorInfo.componentStack);
    this.setState({ hasError: true });
  }

  render() {
    if (this.state.hasError) {
      return (
        <textlabel
          Text="Something went wrong"
          TextColor3={Color3.fromRGB(255, 80, 80)}
          TextSize={22}
        />
      );
    }

    return this.props.children as any;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrokenWidget />
    </ErrorBoundary>
  );
}
```

Use an error boundary to isolate failures from the rest of the UI without crashing the whole screen.

## PureComponent usage

`React.PureComponent` automatically implements a shallow `shouldComponentUpdate` check for you.

```tsx
class UserBadge extends React.PureComponent<{ name: string; level: number }, {}> {
  render() {
    return (
      <textlabel
        Text={`${this.props.name} • Lv ${this.props.level}`}
        TextSize={18}
      />
    );
  }
}
```

Use `PureComponent` when your props/state are mostly primitive values or shallowly immutable objects. It is a simple optimization, but it is not a replacement for careful state design.

## Context consumption in class components

Class components can consume context with `static contextType`.

```tsx
import React from "@nrbx/react";

const ThemeContext = React.createContext({
  accent: Color3.fromRGB(59, 130, 246),
  text: Color3.fromRGB(255, 255, 255),
});

class ThemeAwareButton extends React.Component<{}, {}> {
  static contextType = ThemeContext;

  render() {
    const theme = this.context;

    return (
      <textbutton
        Text="Theme aware"
        TextColor3={theme.text}
        BackgroundColor3={theme.accent}
      />
    );
  }
}
```

This is a convenient way to consume a single context value without wrapping the component in a function component.

## refs in class components

In class components, refs are usually created with `React.createRef()` and attached to Roblox instances using the `ref` prop.

```tsx
import React from "@nrbx/react";

class TextInput extends React.Component<{}, {}> {
  private inputRef = React.createRef<Instance>();

  focus() {
    const instance = this.inputRef.current;
    if (instance && "CaptureFocus" in instance) {
      (instance as any).CaptureFocus();
    }
  }

  render() {
    return (
      <textbox
        ref={this.inputRef}
        Size={new UDim2(1, 0, 0, 32)}
        PlaceholderText="Type here"
      />
    );
  }
}
```

This pattern is useful when you need direct access to a Roblox Instance for focusing, reading values, or triggering imperative behavior.

## Caveats and differences from React web

`@nrbx/react` matches the React class model closely, but there are a few runtime-specific differences to keep in mind:

- There is no `forceUpdate()` method. If you need a rerender, use `this.setState({})` or `this.setState(null)` with an empty update.
- Functional state updates like `this.setState((prevState) => ...)` may not be supported in the Lua runtime. In those cases, prefer using refs or computing the next state from the current value in the event callback.
- Lifecycle method names match the React 16+ spec (`componentDidMount`, `componentDidUpdate`, `componentWillUnmount`, etc.).
- Class components are still fully supported, but function components and hooks are often simpler for UI logic in Roblox.
- `this.state` should be treated as immutable from the outside; do not mutate it directly.

## When to use class components

Class components are a good fit when:

- you need lifecycle behavior
- you use large stateful UI widgets
- you want `PureComponent` optimization
- you need an error boundary
- you already have a React class-oriented codebase

For many modern Roblox UIs, function components with hooks are more concise and often easier to maintain, but class components still work well for existing React patterns and lifecycle-heavy logic.

## Summary

`@nrbx/react` class components give you the familiar React class model with lifecycle hooks, state management, refs, context consumption, and error boundaries. They are a first-class part of the runtime and behave much like React web class components, with a few Lua-specific caveats around `setState` and imperative updates.
