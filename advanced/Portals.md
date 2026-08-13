# Portal Rendering

Portals render into a different Roblox `Instance` than the component's normal parent tree. This is how you handle floating overlays such as modals, tooltips, dropdowns, and HUD layers.

The portal pattern is:

```tsx
createPortal(children, container)
```

The most important part is the target instance. For screen-space overlays, use `ScreenGui`. For world-space UI, use `BillboardGui` or `SurfaceGui` depending on the interaction model.

### Modal overlay example

```tsx
import React, { useEffect, useMemo } from "@nrbx/react";
import { createPortal } from "@nrbx/react";

function Modal({ open, onClose, children }) {
  const overlay = useMemo(() => {
    const gui = new Instance("ScreenGui");
    gui.ResetOnSpawn = false;
    gui.IgnoreGuiInset = true;
    gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
    gui.Parent = game.GetService("Players").LocalPlayer.WaitForChild("PlayerGui");
    return gui;
  }, []);

  useEffect(() => {
    if (!open) {
      overlay.Enabled = false;
    } else {
      overlay.Enabled = true;
    }
  }, [open, overlay]);

  if (!open) return null;

  return createPortal(
    <frame
      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60"
      Size={new UDim2(1, 0, 1, 0)}
      BackgroundColor3={Color3.fromRGB(0, 0, 0)}
      BackgroundTransparency={0.45}
    >
      <frame className="rounded-xl bg-slate-900 p-6" Size={new UDim2(0, 420, 0, 220)}>
        {children}
      </frame>
    </frame>,
    overlay,
  );
}
```

Good targets to remember:

- `ScreenGui` for HUD, pause menus, overlays, and map UIs
- `BillboardGui` for world-space labels and floating tooltips
- `Folder` or `Frame` for nested component trees that need a different local hierarchy
- `SurfaceGui` for object-attached UI like decals or 3D panels

Use portals when the UI should visually float over the rest of the screen, but you do not want the markup nested inside a specific parent component.

---

[← Overview](Overview) · [Performance →](Performance)
