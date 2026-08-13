# Roblox-Specific Patterns

The biggest differences between browser React and Roblox UI are lifecycle, instance ownership, and the event model. These patterns make handheld UI development easier.

### Using `RunService.Heartbeat` with `useEffect`

```tsx
import React, { useEffect, useState } from "@nrbx/react";

function useHeartbeatDelta() {
  const [dt, setDt] = useState(0);

  useEffect(() => {
    const connection = game.GetService("RunService").Heartbeat.Connect((deltaTime) => {
      setDt(deltaTime);
    });

    return () => connection.Disconnect();
  }, []);

  return dt;
}
```

This is useful for smooth animation, motion, or a game HUD that tracks real time.

### Maids and cleanup patterns

Roblox apps often have many event connections. Use a cleanup pattern to disconnect them before unmounting.

```tsx
import React, { useEffect } from "@nrbx/react";

function useButtonListener(button: TextButton) {
  useEffect(() => {
    const connection = button.Activated.Connect(() => {
      print("clicked");
    });

    return () => {
      connection.Disconnect();
    };
  }, [button]);
}
```

If you already use a `Maid` pattern in your project, the same idea applies: track event connections and instance cleanup inside the same lifecycle.

### Working with Roblox instances in React

Roblox instance references are a first-class concern in React UI code. The most common pattern is using a ref-like callback or an effect to attach logic to a specific instance.

```tsx
import React, { useEffect, useRef } from "@nrbx/react";

function HoverCard() {
  const cardRef = useRef<Frame>(undefined as never);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const connection = card.MouseEnter.Connect(() => {
      card.BackgroundTransparency = 0.1;
    });

    return () => connection.Disconnect();
  }, []);

  return <frame ref={cardRef} className="rounded-lg bg-slate-800 p-3" />;
}
```

Keep the instance lifecycle explicit; the React tree does not replace the need to clean up Roblox events and connections.

### Using CollectionService tags

CollectionService is great for global UI or gameplay markers. Use it when you need to find UI or world objects without hard-coding every reference.

```tsx
import React, { useEffect, useState } from "@nrbx/react";

function TaggedHUD() {
  const [widgets, setWidgets] = useState<Instance[]>([]);

  useEffect(() => {
    const update = () => {
      const tagged = game.GetService("CollectionService").GetTagged("HUDWidget");
      setWidgets(tagged);
    };

    update();
    const connection = game.GetService("CollectionService").GetInstanceAddedSignal("HUDWidget").Connect(update);
    const removed = game.GetService("CollectionService").GetInstanceRemovedSignal("HUDWidget").Connect(update);

    return () => {
      connection.Disconnect();
      removed.Disconnect();
    };
  }, []);

  return (
    <frame>
      {widgets.map((widget) => (
        <textlabel key={widget.Name} Text={widget.Name} />
      ))}
    </frame>
  );
}
```

This pattern is very useful in dynamic gameplay worlds or modular UIs.

### Player-specific UI (LocalScript vs Script)

Do not mount player HUD on the server. Most player UI belongs in a `LocalScript` and should render into a `PlayerGui` or `ScreenGui` that is local to the client.

```tsx
import React from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

const playerGui = game.GetService("Players").LocalPlayer.WaitForChild("PlayerGui");
const root = createRoot(playerGui);

root.render(<hud />);
```

By contrast, server-authoritative logic such as inventory state or match state should be managed in `Script` code and sent to the client through remote events.

### Data-driven UI from remote events

A typical pattern is to subscribe to a remote event, update component state, and then render a list from that state.

```tsx
import React, { useEffect, useState } from "@nrbx/react";

function InventoryList() {
  const [items, setItems] = useState<Array<{ id: string; name: string; count: number }>>([]);

  useEffect(() => {
    const remote = game.GetService("ReplicatedStorage").WaitForChild("InventoryUpdate");
    const handler = (payload: { items: Array<{ id: string; name: string; count: number }> }) => {
      setItems(payload.items);
    };

    remote.OnClientEvent.Connect(handler);

    return () => {
      remote.OnClientEvent.Disconnect(handler);
    };
  }, []);

  return (
    <frame>
      {items.map((item) => (
        <textlabel key={item.id} Text={`${item.name} x ${item.count}`} />
      ))}
    </frame>
  );
}
```

This keeps your UI reactive without tightly coupling it to server-side logic.

---

[← Custom-Hooks](Custom-Hooks) · [Testing →](Testing)
