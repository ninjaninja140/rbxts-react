# Custom JSX Pragma

If you are building a custom runtime, a custom JSX transform, or an integration that needs a different `createElement` factory, you can customize the JSX pragma.

### Using `@jsxImportSource`

```tsx
/** @jsxImportSource @nrbx/react */

const Example = () => {
  return <frame className="p-4 bg-brand-500" />;
};
```

This tells the TypeScript compiler to import the JSX runtime from the package you want.

### Custom `createElement` factories

For special cases, you may want a local helper to normalize or wrap element creation.

```tsx
import React from "@nrbx/react";

function createUiElement(type: unknown, props: Record<string, unknown>, ...children: unknown[]) {
  return React.createElement(type as never, props as never, ...children);
}

const ui = createUiElement("frame", {
  Size: new UDim2(1, 0, 1, 0),
  BackgroundTransparency: 1,
});
```

This is not usually necessary for daily app work, but it can be very useful when building design-system wrappers or custom runtime integrations.

---

[← Testing](Testing) · [Suspense-Patterns →](Suspense-Patterns)
