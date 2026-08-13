# Error Boundaries

Error boundaries let you isolate failures in a subtree of your Roblox UI. When a render, lifecycle, or constructor error occurs inside a boundary, the boundary can render a safe fallback instead of crashing the rest of the app.

`@nrbx/react` includes built-in error boundary support for the Roblox runtime, plus utilities to parse Roblox error strings and format them into readable messages.

## What error boundaries catch

An error boundary catches errors that happen while React is trying to render or commit a child tree, including:

- rendering errors in descendant components
- lifecycle method failures such as `componentDidCatch`
- constructor-time errors in child components
- errors caused while mounting or updating a portion of the UI

This is the same idea as React error boundaries in the browser: a boundary keeps a failing section of the UI from taking down the whole app.

### What they do not catch

Error boundaries do not catch:

- event handler errors, such as click or activation handlers
- async code errors, like promises or `task.spawn` failures that are not part of the render tree
- errors thrown outside the boundary subtree
- errors thrown in the boundary itself while trying to render its fallback

If an error occurs in a click handler, it is usually handled by the local function or logged with `onError`—it does not automatically trigger the boundary.

## Using the `ErrorBoundary` component

The simplest pattern is to wrap a risky section with `ErrorBoundary` and provide a fallback UI.

```tsx
import React from "@nrbx/react";
import { ErrorBoundary } from "@nrbx/react";

function App() {
  return (
    <ErrorBoundary
      fallback={
        <frame Size={new UDim2(1, 0, 0, 80)} BackgroundColor3={Color3.fromRGB(58, 12, 12)}>
          <textlabel
            Size={new UDim2(1, 0, 0, 40)}
            Text="Something went wrong"
            TextColor3={Color3.fromRGB(255, 255, 255)}
            BackgroundTransparency={1}
          />
        </frame>
      }
      onError={(error, info) => warn("Caught error:", error, info)}
    >
      <YourComponent />
    </ErrorBoundary>
  );
}
```

This keeps the failing view isolated. The rest of the Roblox UI can continue to render normally.

## The `fallback` prop

The `fallback` prop renders a replacement UI when an error reaches the boundary.

This is usually the best place to show:

- a friendly error message
- a retry button
- a placeholder section instead of a broken panel
- a simple state indicator for a non-critical UI block

```tsx
<ErrorBoundary
  fallback={
    <frame Size={new UDim2(0, 220, 0, 120)} BackgroundColor3={Color3.fromRGB(30, 30, 30)}>
      <textlabel
        Size={new UDim2(1, 0, 0, 28)}
        Position={new UDim2(0, 0, 0, 12)}
        Text="Unable to load data"
        TextColor3={Color3.fromRGB(255, 255, 255)}
        BackgroundTransparency={1}
      />
    </frame>
  }
>
  <InventoryPanel />
</ErrorBoundary>
```

Use a fallback that matches the app's style and does not itself depend on the failed subtree.

## Error recovery with `onReset` and `resetKeys`

Error boundaries can recover after a failure. When a boundary resets, it can re-render the previous content and try again.

Use:

- `onReset`: called when the boundary is reset
- `resetKeys`: an array of values that trigger an automatic reset when they change

```tsx
function UserProfile({ userId }: { userId: string }) {
  return (
    <ErrorBoundary
      resetKeys={[userId]}
      onReset={() => {
        warn("Retrying user profile");
      }}
      fallback={<frame><textlabel Text="Profile failed to load" /></frame>}
    >
      <ProfileDetails userId={userId} />
    </ErrorBoundary>
  );
}
```

When `userId` changes, the boundary can drop its error state and render again. This is useful for route transitions, tab changes, and re-fetching data after a user action.

You can also use `onReset` to clear caches or reset local state before retrying.

## Custom error boundaries

In Roblox, you usually create a custom boundary by extending `Component` and implementing `componentDidCatch`.

```tsx
import React, { Component } from "@nrbx/react";

type Props = {
  children?: unknown;
  fallback?: unknown;
};

type State = {
  hasError: boolean;
};

class SafeSection extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    warn("Section failed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <frame><textlabel Text="Section unavailable" /></frame>;
    }

    return this.props.children;
  }
}
```

This pattern makes it easy to preserve app logic while isolating a segment of the UI.

## `onError` callback

Use the `onError` callback to log or report failures while still showing a fallback.

```tsx
<ErrorBoundary
  onError={(error, info) => {
    warn("Render failure:", error);
    warn("Component stack:", info.componentStack);
  }}
  fallback={<frame><textlabel Text="Something went wrong" /></frame>}
>
  <InventoryView />
</ErrorBoundary>
```

This is a good place to capture telemetry, warn in dev mode, or trigger analytics when a boundary catches an error.

## Roblox error parsing and message formatting

Roblox errors usually include script paths and line numbers. For example:

```txt
[Script "Workspace/App.server.lua"]:42: attempt to index nil with 'Text'
```

`parseErrorSource` helps extract the relevant source details from that message.

```tsx
import { parseErrorSource } from "@nrbx/react";

const source = parseErrorSource(
  '[Script "Workspace/App.server.lua"]:42: attempt to index nil with \'Text\'',
);

if (source) {
  warn(source.file, source.line, source.function);
}
```

The parser is designed for Roblox error strings and can recover file and line information from script paths, stack traces, and similar runtime output.

`formatReactError` turns an error into a readable human-friendly message for logging, dev tooling, or custom UI output.

```tsx
import { formatReactError } from "@nrbx/react";

try {
  throw new Error("Failed to create inventory widget");
} catch (error) {
  const formatted = formatReactError(error);
  warn(formatted);
}
```

This is especially useful when you want a single safe string to show in a dev panel or to log to a remote error collector.

## Dev mode vs production behavior

In development, error boundaries usually surface more detail:

- stack traces are more visible
- source file and line numbers are parsed and displayed
- component stack information is easier to inspect
- warnings are more explicit to help debugging

In production, the boundary is still active, but the UI should usually shift to a controlled fallback with minimal noise. The app stays working while preserving the user experience.

A good production strategy is:

- keep a clear fallback for broken sections
- log errors only once with `onError`
- avoid leaking raw stack traces into user-facing UI

## Nesting boundaries

You can nest error boundaries to localize failures.

```tsx
<ErrorBoundary fallback={<frame><textlabel Text="App failed" /></frame>}>
  <MainShell>
    <ErrorBoundary fallback={<frame><textlabel Text="Sidebar failed" /></frame>}>
      <Sidebar />
    </ErrorBoundary>

    <ErrorBoundary fallback={<frame><textlabel Text="Content failed" /></frame>}>
      <MainContent />
    </ErrorBoundary>
  </MainShell>
</ErrorBoundary>
```

If only the sidebar fails, your content can continue to render. If the whole app fails, the outer boundary prevents the whole UI from going dark.

## Common patterns

### Wrapping routes

Use an error boundary around an entire route or screen so navigation remains usable even if a single route crashes.

```tsx
<ErrorBoundary
  fallback={<frame><textlabel Text="Route failed to load" /></frame>}
  resetKeys={[currentRoute]}
>
  <RouteView route={currentRoute} />
</ErrorBoundary>
```

### Wrapping sections

Use boundaries around panels, lists, or data-heavy widgets instead of the entire game UI.

```tsx
<ErrorBoundary
  onError={(error) => warn("Inventory panel error:", error)}
  fallback={<frame><textlabel Text="Inventory unavailable" /></frame>}
>
  <InventoryPanel />
</ErrorBoundary>
```

### Recovering after refetch or state change

A reset is useful when the user changes context or loads a new record.

```tsx
<ErrorBoundary
  resetKeys={[selectedCharacterId]}
  onReset={() => setIsRefreshing(false)}
  fallback={<frame><textlabel Text="Character data failed" /></frame>}
>
  <CharacterDetails characterId={selectedCharacterId} />
</ErrorBoundary>
```

## Best practices

- Put boundaries around the smallest possible failing area.
- Keep the fallback UI simple and consistent with the rest of the app.
- Log valuable error details with `onError`.
- Use `resetKeys` when a new data source or route should retry cleanly.
- Avoid placing a boundary around code that is expected to throw frequently in normal operation.

Error boundaries are a great way to keep Roblox UIs resilient. They help you separate "the component failed" from "the entire experience is broken."
