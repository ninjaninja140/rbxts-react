# Suspense-like Patterns

Roblox does not have a browser-like Suspense engine, so the pattern is to manage loading state and error fallbacks explicitly.

### Loading states while data is preparing

```tsx
import React, { useEffect, useState } from "@nrbx/react";

function InventoryScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    task.delay(0.5, () => {
      setItems([
        { id: "sword", name: "Sword" },
        { id: "shield", name: "Shield" },
      ]);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <textlabel Text="Loading inventory..." />;
  }

  return (
    <frame>
      {items.map((item) => (
        <textlabel key={item.id} Text={item.name} />
      ))}
    </frame>
  );
}
```

This is the Roblox equivalent of Suspense-driven placeholder UI: render a fallback while the data is not ready.

### Error boundaries as fallback state

Error boundaries are your best recovery path when a subtree fails to render or a data provider is invalid.

```tsx
import React from "@nrbx/react";

class InventoryErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <textlabel Text="Inventory failed to load." />;
    }

    return this.props.children;
  }
}
```

This creates a safe fallback when a deeply nested screen fails unexpectedly.

---

[← Custom-JSX-Pragma](Custom-JSX-Pragma) · [DevTools →](DevTools)
