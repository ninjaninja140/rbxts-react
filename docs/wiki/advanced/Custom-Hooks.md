# Custom Hooks

Custom hooks are the best way to package Roblox-specific logic into reusable behavior. Do not put RunService or TweenService logic directly in multiple components when a hook can hide that complexity.

### Building reusable logic

```tsx
import React, { useEffect, useState } from "@nrbx/react";

function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => {
      const viewport = game.GetService("Workspace").CurrentCamera.ViewportSize;
      setSize({
        width: viewport.X,
        height: viewport.Y,
      });
    };

    update();
    const connection = game.GetService("Workspace").CurrentCamera.Changed.Connect(update);
    return () => connection.Disconnect();
  }, []);

  return size;
}
```

This kind of hook can be reused across HUD, minimaps, and menus without duplicating event setup.

### Roblox-specific hooks: `useRunService`, `useTween`, `useDebounce`

```tsx
import React, { useEffect, useMemo, useState } from "@nrbx/react";

function useRunService(eventName: "Heartbeat" | "RenderStepped") {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const connection = game.GetService("RunService")[eventName].Connect((dt) => {
      setTime((value) => value + dt);
    });

    return () => connection.Disconnect();
  }, [eventName]);

  return time;
}

function useTween(target: Instance, goal: TweenInfo, properties: Record<string, unknown>) {
  const [tween, setTween] = useState<Instance | null>(null);

  useEffect(() => {
    const t = game.GetService("TweenService").Create(target, goal, properties);
    setTween(t);
    t.Play();

    return () => {
      t.Cancel();
    };
  }, [target, goal, properties]);

  return tween;
}

function useDebounce<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = task.delay(delayMs, () => setDebounced(value));
    return () => task.cancel(handle);
  }, [value, delayMs]);

  return debounced;
}
```

The key is to compose small hooks into bigger behaviors instead of implementing app logic at the component level.

### Composing hooks

```tsx
function SearchBox() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 200);
  const elapsed = useRunService("Heartbeat");

  const filteredResults = useMemo(() => {
    if (debouncedQuery === "") return [];
    return ["sword", "shield", "potion"].filter((item) => item.includes(debouncedQuery));
  }, [debouncedQuery]);

  return (
    <frame>
      <textbox Event={{ FocusLost: (instance) => setQuery(instance.Text) }} />
      <textlabel Text={`${filteredResults.length} matches`} />
      <textlabel Text={`time: ${elapsed.toFixed(2)}`} />
    </frame>
  );
}
```

This is a practical way to build UI that responds to input while staying cheap to compute.

---

[← Performance](Performance) · [Roblox-Patterns →](Roblox-Patterns)
