# DevTools Integration

`@nrbx/react` ships a DevTools backend that connects to the standalone React DevTools server, letting you inspect component trees, props, hooks, and state from your desktop.

### Import the DevTools integration

```tsx
import "@nrbx/react-devtools";
import React from "@nrbx/react";
import { createRoot } from "@nrbx/react-roblox";

const root = createRoot(new Instance("ScreenGui"));
root.render(<App />);
```

With the standalone DevTools server running, the game connects to it on import and exposes the component tree for inspection while your UI runs in Studio or in a live session. The backend speaks the React 17-era wire protocol, so very new DevTools frontends may not support every panel. See the caveats page for details.

### What to debug

Use DevTools for:

- component tree validation
- prop inspection
- hook state debugging
- render timings and re-render loops
- context value problems
- unstable callback dependencies

This is especially helpful when a menu or HUD starts re-rendering too often or when a context object changes unexpectedly across the app.

A common workflow is:

1. Launch the game with the DevTools package imported
2. Open React DevTools
3. Inspect the component tree and selected branch
4. Check whether state changes are propagating to the correct nodes
5. Use the tree to identify hidden render loops or duplicate providers

---

[← Suspense-Patterns](Suspense-Patterns)
