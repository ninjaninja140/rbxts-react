# Hover variants

Hover utilities are another major part of the Tailwind-style API. When the parsed class includes a `hover:` prefix, the runtime installs `MouseEnter` and `MouseLeave` handlers and swaps the hover props while the cursor is inside the instance.

```tsx
import React from "@nrbx/react";

function HoverCard() {
  return (
    <frame className="flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 hover:bg-blue-50 hover:border-blue-300 hover:scale-110">
      <textlabel className="text-gray-900 text-sm font-bold">Hover me</textlabel>
    </frame>
  );
}
```

You can also combine hover and color utilities:

```tsx
import React from "@nrbx/react";

function ActionButton() {
  return (
    <textbutton className="bg-blue-500 hover:bg-red-500 text-white px-4 py-2 rounded font-bold">
      Delete
    </textbutton>
  );
}
```

A few notes:

- `hover:*` is runtime-driven, not a CSS pseudo selector.
- It applies via Roblox mouse events on the instance.
- It can be used for colors, transforms, spacing, and other generated props.

---

[← Utility-Classes](Utility-Classes) · [Arbitrary-Values →](Arbitrary-Values)
