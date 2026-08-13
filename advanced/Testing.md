# Testing

Testing in `roblox-ts` is usually done with a unit-test runner such as `TestEZ` or a TypeScript test setup that runs against Roblox objects. The goal is to verify the behavior of your UI, not to rely on fragile, hand-written object snapshots.

### Testing React components in roblox-ts

```tsx
import React from "@nrbx/react";
import { describe, it, expect } from "@rbxts/testez";
import { createRoot } from "@nrbx/react-roblox";

describe("InventoryBadge", () => {
  it("renders the correct label", () => {
    const gui = new Instance("ScreenGui");
    const root = createRoot(gui);

    root.render(<textlabel Text="3 items" />);

    const child = gui.FindFirstChildOfClass("TextLabel");
    expect(child).to.be.ok();
    expect(child.Text).to.equal("3 items");

    root.unmount();
  });
});
```

That pattern verifies a real instance tree, which is a good fit for Roblox UI.

### Unit testing hooks

Because hooks are pure logic with lifecycle side effects, a useful approach is to write a tiny render helper around a test component.

```tsx
import React, { useState, useEffect } from "@nrbx/react";

function renderHook<T>(callback: () => T) {
  let result: T;

  function HookProbe() {
    result = callback();
    return null;
  }

  const gui = new Instance("ScreenGui");
  const root = createRoot(gui);
  root.render(<HookProbe />);

  return {
    get current() {
      return result!;
    },
    unmount: () => root.unmount(),
  };
}
```

Then test the hook output directly without mounting the entire app.

### Snapshot testing considerations

Snapshot tests are less valuable for Roblox UI than in a browser DOM because instances are stateful and can be dynamic. Prefer asserting on stable values:

- text content
- visibility state
- count of children
- property values such as `BackgroundColor3`, `Text`, and layout values

This keeps tests meaningful even when internal instance creation details change.

---

[← Roblox-Patterns](Roblox-Patterns) · [Custom-JSX-Pragma →](Custom-JSX-Pragma)
