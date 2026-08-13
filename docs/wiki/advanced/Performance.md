# Performance

## Context Performance

React context is extremely useful, but the cost of context updates can be high if you store large objects or unstable values in a single provider.

### Avoiding unnecessary re-renders

The biggest anti-pattern is creating a new object or array in a provider on every render.

```tsx
import React, { useMemo, createContext, useContext } from "@nrbx/react";

const ThemeContext = createContext({});

function ThemeProvider({ theme, children }) {
  const value = useMemo(
    () => ({
      primary: theme.primary,
      accent: theme.accent,
      spacing: theme.spacing,
    }),
    [theme.primary, theme.accent, theme.spacing],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

If you pass `{ theme: {...} }` inline every render, every consumer will re-render even if it does not use that data.

### Splitting contexts

If a provider holds unrelated state, split it into multiple contexts instead of one large object.

```tsx
const ThemeContext = createContext(null);
const InventoryContext = createContext(null);

function AppShell() {
  return (
    <ThemeContext.Provider value={themeValue}>
      <InventoryContext.Provider value={inventoryValue}>
        <Hud />
      </InventoryContext.Provider>
    </ThemeContext.Provider>
  );
}
```

This lets unrelated parts of the tree update independently.

### Context + `useMemo` pattern

When context holds derived data, memoize it at the boundary where the value is created.

```tsx
function DashboardProvider({ player, inventory, children }) {
  const value = useMemo(
    () => ({
      playerName: player.Name,
      inventoryCount: inventory.length,
      isLoaded: inventory !== undefined,
    }),
    [player.Name, inventory],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
```

This keeps context consumers stable and prevents avoidable work deeper in the tree.


## Performance Optimization

Roblox UI is not as forgiving as the browser if you create too many objects or update too many properties too often. The goal is to keep the tree stable and avoid work on every frame.

### `React.memo` for preventing re-renders

Use `React.memo` for expensive, repeated child views such as inventory rows, lists, or menu entries.

```tsx
import React from "@nrbx/react";

const InventoryRow = React.memo(function InventoryRow({ item, onSelect }) {
  return (
    <button
      className="flex items-center justify-between rounded-lg bg-slate-800 p-3"
      Event={{ Activated: () => onSelect(item.id) }}
    >
      <textlabel Text={item.name} />
      <textlabel Text={`${item.count}`} />
    </button>
  );
});
```

This prevents re-rendering a row if its props have not changed.

### `useMemo` and `useCallback` usage

Use these when you create derivations or callbacks that would otherwise be recreated on every render.

```tsx
import React, { useCallback, useMemo, useState } from "@nrbx/react";

function ItemList({ items }) {
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const rows = useMemo(
    () => items.map((item) => ({ ...item, selected: item.id === selectedId })),
    [items, selectedId],
  );

  const onSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  return (
    <frame>
      {rows.map((item) => (
        <InventoryRow key={item.id} item={item} onSelect={onSelect} />
      ))}
    </frame>
  );
}
```

The same principles apply to UI lists, computed style objects, and stable event handlers.

### `PureComponent` for class components

If you still use class components, `PureComponent` helps you drop unnecessary updates by shallow comparison.

```tsx
import React from "@nrbx/react";

class StatBar extends React.PureComponent<{ value: number; label: string }> {
  render() {
    return (
      <frame>
        <textlabel Text={`${this.props.label}: ${this.props.value}`} />
      </frame>
    );
  }
}
```

This is useful for chart-like metrics, HUD values, and simple stat widgets.

### Avoiding inline objects/arrays in props

A subtle source of re-renders is passing inline props objects or arrays.

```tsx
function Bad() {
  return <InventoryRow style={{ padding: 8, borderRadius: 8 }} />;
}

function Good() {
  const style = useMemo(
    () => ({
      padding: 8,
      borderRadius: 8,
    }),
    [],
  );

  return <InventoryRow style={style} />;
}
```

This matters more in large Roblox UIs because a single re-render can cascade across several nested components.

### Batch updates with `flushSync`

For urgent updates, such as a menu opening immediately after a click, use `flushSync` to force a synchronous render.

```tsx
import React, { flushSync, useState } from "@nrbx/react";

function Menu() {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    flushSync(() => {
      setOpen(true);
    });
  };

  return <button Event={{ Activated: handleOpen }} />;
}
```

This is appropriate for user interaction that must be visible immediately.

### `startTransition` for non-urgent updates

Use transitions for less essential updates, like search results or filtered lists.

```tsx
import React, { startTransition, useState } from "@nrbx/react";

function SearchResults() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);

  const onInput = (text: string) => {
    setQuery(text);

    startTransition(() => {
      setResults(text === "" ? [] : ["sword", "shield", "bow"].filter((item) => item.includes(text)));
    });
  };

  return <textbox Event={{ FocusLost: (instance) => onInput(instance.Text) }} />;
}
```

The result is responsive UI, without blocking the user on every filter change.

---

[← Portals](Portals) · [Custom-Hooks →](Custom-Hooks)
