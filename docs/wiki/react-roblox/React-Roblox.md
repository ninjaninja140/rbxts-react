# @nrbx/react-roblox

`@nrbx/react-roblox` is the Roblox renderer for `@nrbx/react`. It is the equivalent of `react-dom` for the web: it mounts React trees into Roblox `Instance` objects, reconciles updates, and manages cleanup for the UI you render.

At a high level, it gives you:

- `createRoot(container)` to attach a React tree to a Roblox container
- `createPortal(children, container)` to render outside the normal parent tree
- `flushSync(callback)` to force immediate synchronous updates
- `createBlockingRoot()` and `createLegacyRoot()` for compatibility with older rendering modes

## Installation and setup

Install the core React package and the Roblox renderer:

```bash
npm install @nrbx/react @nrbx/react-roblox
```

With Yarn or pnpm:

```bash
yarn add @nrbx/react @nrbx/react-roblox
pnpm add @nrbx/react @nrbx/react-roblox
```

You can then render into any Roblox `Instance` that makes sense for the UI you are building:

- `ScreenGui` for HUD, menus, and full-screen overlays
- `Frame` / `Folder` for nested UI trees
- `BillboardGui` for world-space avatar/world UI
- `SurfaceGui` for placing UI on a Part surface

## Quick start

```tsx
import React from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

function App() {
  return (
    <frame className="p-8">
      <textlabel Text="Hello, Roblox!" className="text-2xl font-bold" />
    </frame>
  );
}

const container = script.Parent!.WaitForChild("ScreenGui") as ScreenGui;
const root = createRoot(container);
root.render(<App />);
```

This creates a root for the target `Instance` and renders your app tree underneath it.

## API overview

### `createRoot(container: Instance): ReactRobloxRoot`

Creates a root for a Roblox `Instance` and returns an object with:

- `render(element)` — render or re-render the React tree
- `unmount()` — remove the tree and clean up React-managed instances

```tsx
import React from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

const root = createRoot(new Instance("ScreenGui"));

root.render(
  <frame Size={new UDim2(1, 0, 1, 0)} BackgroundColor3={Color3.fromRGB(15, 23, 42)}>
    <textlabel
      Size={new UDim2(1, 0, 0, 40)}
      Position={new UDim2(0, 0, 0, 10)}
      Text="Mounted via createRoot"
      TextColor3={Color3.fromRGB(255, 255, 255)}
      BackgroundTransparency={1}
    />
  </frame>,
);
```

Use one root per container. A root owns the subtree under that `Instance` and is the intended place to call `render` and `unmount`.

### `createBlockingRoot(container: Instance): ReactRobloxRoot`

This is the legacy blocking root mode. It is useful for compatibility with older patterns and React 17-style behavior. Prefer `createRoot` for new code unless you specifically need the older semantics.

### `createLegacyRoot(container: Instance): ReactRobloxRoot`

This is the legacy root mode that includes older behavior such as string refs support. It is mainly for compatibility with older React patterns and is not the default choice for most new Roblox apps.

## createRoot in detail

The root is the entry point for a React-managed UI subtree.

This example renders a counter:

```tsx
import React, { useState } from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <frame Size={new UDim2(0, 220, 0, 100)} BackgroundColor3={Color3.fromRGB(15, 23, 42)}>
      <textlabel
        Size={new UDim2(1, 0, 0, 40)}
        Position={new UDim2(0, 0, 0, 0)}
        Text={`${count}`}
        TextColor3={Color3.fromRGB(255, 255, 255)}
        BackgroundTransparency={1}
      />
      <textbutton
        Size={new UDim2(0, 120, 0, 32)}
        Position={new UDim2(0.5, -60, 1, -40)}
        AnchorPoint={new Vector2(0.5, 1)}
        Text="Increment"
        Event={{
          Activated: () => setCount((value) => value + 1),
        }}
      />
    </frame>
  );
}

const gui = new Instance("ScreenGui");
gui.Parent = game.GetService("Players").LocalPlayer!.WaitForChild("PlayerGui");

const root = createRoot(gui);
root.render(<Counter />);
```

### Rendering updates

After the initial render, call `root.render()` again with a new element tree whenever you want to update the UI. React will reconcile changes against the existing Roblox tree.

```tsx
root.render(<Counter />);
```

This is the equivalent of a `render` call in React DOM, except the target is a Roblox `Instance` instead of a browser DOM element.

## Portal usage patterns

Portals let you render children into a different Roblox instance, which is useful for overlays such as:

- modals
- dropdown menus
- tooltips
- floating notifications
- custom context overlays

The API is:

```tsx
createPortal(children, container)
```

Example:

```tsx
import React, { useMemo } from "@nrbx/react";
import { createPortal } from "@nrbx/react-roblox";

function Modal({ children }: { children: React.ReactNode }) {
  const gui = useMemo(() => {
    const sg = new Instance("ScreenGui");
    sg.Parent = game.GetService("Players").LocalPlayer!.WaitForChild("PlayerGui");
    return sg;
  }, []);

  return createPortal(
    <frame className="bg-black/50 w-screen h-screen flex items-center justify-center">
      <frame className="bg-white p-6 rounded-lg shadow-lg">
        {children}
      </frame>
    </frame>,
    gui,
  );
}
```

Portal tips:

- Use a dedicated `ScreenGui` for overlays so they are not constrained by the parent layout tree.
- For world-space elements, a `BillboardGui` or `SurfaceGui` is often a better target than a `ScreenGui`.
- Keep the portal container alive for as long as the overlay is visible.

## `flushSync` use cases

`flushSync(callback)` forces React to flush pending state updates synchronously.

```tsx
import { flushSync } from "@nrbx/react-roblox";

function openPanel() {
  flushSync(() => {
    setOpen(true);
  });

  // UI is already committed and measurements can be read immediately
  print(panel.AbsoluteSize);
}
```

Use it for cases where timing matters, such as:

- animations that need a committed frame before measuring
- immediate layout reads after state changes
- synchronizing UI before a physics or camera update
- imperative work that must happen right after render

Be careful: `flushSync` can hurt performance if used too aggressively. Prefer it only when you truly need immediate synchronization.

## Comparison to `react-dom`

`@nrbx/react-roblox` is conceptually the Roblox equivalent of `react-dom`.

The differences are mainly in the host environment:

| Web (`react-dom`) | Roblox (`@nrbx/react-roblox`) |
| --- | --- |
| Mounts into DOM `Element` nodes | Mounts into Roblox `Instance` objects |
| `document.body` or a DOM container | `ScreenGui`, `Frame`, `BillboardGui`, `SurfaceGui`, etc. |
| Portal container is a DOM node | Portal container is a Roblox `Instance` |
| Browser event model | Roblox `Event` and `Change` handlers |
| Layout is CSS-driven | Layout and Roblox GUI properties are expressed through instance props and class names |

The mental model is still the same: component trees, props, state updates, effects, portals, and error boundaries, but the host target is Roblox UI instead of the browser DOM.

## Roblox-specific container considerations

Choosing the right container matters a lot in Roblox UI.

### `ScreenGui`

Best for HUD, menus, loading screens, and full-screen overlays.

```tsx
const playerGui = game.GetService("Players").LocalPlayer!.WaitForChild("PlayerGui");
const root = createRoot(playerGui);
root.render(<App />);
```

Use `ScreenGui` when the UI should follow screen space and not world space.

### `BillboardGui`

Best for labels or floating UI that should appear attached to a part or character in 3D space.

```tsx
const billboard = new Instance("BillboardGui");
billboard.Adornee = workspace.Part;

const root = createRoot(billboard);
root.render(<textlabel Text="Player HP" />);
```

### `SurfaceGui`

Best for UI displayed on the surface of a part.

```tsx
const surface = new Instance("SurfaceGui");
surface.Face = Enum.NormalId.Front;
surface.Adornee = workspace.Part;

const root = createRoot(surface);
root.render(<frame Size={new UDim2(1, 0, 1, 0)} />);
```

### `Frame` and nested containers

Use `Frame`, `Folder`, or other GUI containers when you want to render a subtree inside a larger UI tree. This is useful when building reusable panels or nested app sections.

## Multiple root management

You can create multiple roots on different containers and manage them independently.

```tsx
import React from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

const hudGui = new Instance("ScreenGui");
hudGui.Parent = game.GetService("Players").LocalPlayer!.WaitForChild("PlayerGui");

const panelGui = new Instance("Frame");
panelGui.Parent = hudGui;

const hudRoot = createRoot(hudGui);
const panelRoot = createRoot(panelGui);

hudRoot.render(<hud />);
panelRoot.render(<panel />);
```

This is useful when you have:

- separate HUD layers
- multiple modals or menus
- independent sub-apps within the same screen
- partial tree re-renders without destroying unrelated UI

Every root is isolated and can be unmounted independently.

## Unmounting and cleanup

`unmount()` removes the entire React-managed subtree for that root and cleans up any React-owned Roblox instances it created.

```tsx
const root = createRoot(container);
root.render(<App />);

root.unmount();
```

When you are done with a root, call `unmount()` before destroying the container instance itself. This ensures event listeners and managed descendants are properly cleaned up.

For example:

```tsx
const gui = new Instance("ScreenGui");
const root = createRoot(gui);
root.render(<App />);

root.unmount();
gui:Destroy();
```

This workflow avoids leaving behind stale UI or detached event handlers.

## Error handling

`@nrbx/react-roblox` supports React-style error boundaries. If a render error occurs in a subtree, a boundary can catch it and render a fallback instead of crashing the rest of the tree.

```tsx
import React from "@nrbx/react";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <textlabel Text="Something went wrong" />;
    }

    return this.props.children;
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

This prevents a single component failure from taking down the entire UI tree, which is especially helpful in game UIs that need to degrade gracefully under unexpected runtime errors.

## Best practices

- Use `createRoot` for most cases; prefer `createBlockingRoot` and `createLegacyRoot` only when compatibility is required.
- Keep root containers focused: use a `ScreenGui` for main HUD, a `BillboardGui` for 3D overlays, and a `SurfaceGui` for part surfaces.
- Use portals for overlays that should not be constrained by local layout.
- Call `unmount()` when a root is no longer needed.
- Keep `flushSync` narrow and deliberate; avoid using it everywhere.

## Summary

`@nrbx/react-roblox` provides the Roblox host layer for React-style UI development. It is the runtime that:

- mounts component trees into Roblox `Instance`s
- manages updates and lifecycle
- supports portals, multiple roots, and cleanup
- works with Roblox GUI APIs and game UI patterns

If you are familiar with `react-dom`, the transition to `@nrbx/react-roblox` is straightforward: the same React concepts, but rendered into Roblox instances instead of browser DOM nodes.
