# Text as Children

Text-as-Children is a convenience feature in `@nrbx/react` that lets you pass plain strings and numbers directly as JSX children without manually creating `TextLabel` instances.

Instead of writing:

```tsx
<textlabel Text="Hello World" />
```

you can write:

```tsx
<frame>Hello World</frame>
<textbutton>Click Me</textbutton>
```

This keeps simple text content readable and reduces repetitive boilerplate for UI labels and button text.

## Why this is useful

Roblox GUI elements often need a label-like child when they are not themselves text-capable. Text-as-Children automatically handles that for you.

```tsx
import React from "@nrbx/react";

function WelcomeCard() {
  return (
    <frame
      Size={new UDim2(0, 280, 0, 120)}
      BackgroundColor3={Color3.fromRGB(20, 20, 30)}
      CornerRadius={new UDim(0, 12)}
    >
      <frame>
        Hello from @nrbx/react
      </frame>
      <textbutton>
        Open Dashboard
      </textbutton>
    </frame>
  );
}
```

The runtime sees the plain text and inserts the appropriate label-like element for you.

## How it works under the hood

The JSX factory wraps the creation path and inspects each child before the element is created.

For each child:

1. If the child is a `string` or `number`, it is recognized as text content.
2. The parent element's Roblox class is checked.
3. If the parent is not already text-capable, the text is wrapped in a generated `TextLabel`.
4. The generated label is configured with transparent background and standard text props.
5. If the parent is already text-capable, the text is assigned directly to the parent's `Text` property instead.

The generated label is effectively the same idea as:

```tsx
<textlabel
  Text="Hello World"
  BackgroundTransparency={1}
  BorderSizePixel={0}
/>
```

That means the library can keep plain JSX text readable without sacrificing the underlying Roblox GUI structure.

A simplified mental model is this:

```tsx
// Input
<frame>Hello World</frame>

// Equivalent behavior
<frame>
  <textlabel Text="Hello World" BackgroundTransparency={1} BorderSizePixel={0} />
</frame>
```

## Supported parent types

Text-as-Children is used for parents that are not already text-native.

Typical supported parents include:

- `Frame`
- `ScrollingFrame`
- `ImageLabel`
- `ImageButton`
- `CanvasGroup`
- other non-text-capable GUI containers

Parents that already accept text natively are left alone:

- `TextLabel`
- `TextButton`
- `TextBox`

When the parent is text-capable, the raw text is passed directly as the `Text` prop instead of creating a child label.

```tsx
function TextCapableParents() {
  return (
    <>
      <textlabel>Direct label text</textlabel>
      <textbutton>Button text</textbutton>
      <textbox>Typed value</textbox>
    </>
  );
}
```

For non-text-capable parents, the wrapper creates a label child automatically:

```tsx
function ContainerText() {
  return (
    <frame>
      This is plain text inside a container.
    </frame>
  );
}
```

This is especially handy for informational labels, headings, captions, and simple inline text blocks in larger UI containers.

## Edge cases

### Empty strings

An empty string is still recognized as text, but it renders as an empty label.

```tsx
<frame>{""}</frame>
```

This is valid, but it creates a label node with no visible text content. If you need a spacer or layout gap, prefer explicit sizing or layout APIs instead of relying on an empty label.

### Zero and negative numbers

Numbers are converted to strings, so `0` and negative numbers are treated as real text content:

```tsx
function NumberExamples() {
  return (
    <frame>
      {0}
      {42}
      {-7}
    </frame>
  );
}
```

This behaves like:

```tsx
<frame>
  <textlabel Text="0" BackgroundTransparency={1} />
  <textlabel Text="42" BackgroundTransparency={1} />
  <textlabel Text="-7" BackgroundTransparency={1} />
</frame>
```

### Mixed children

Text can be mixed with other elements in the same parent:

```tsx
function MixedContent() {
  return (
    <frame>
      <imagebutton Image="rbxassetid://12345" Size={new UDim2(0, 32, 0, 32)} />
      Hello world
      <textlabel Text="Status: Ready" />
    </frame>
  );
}
```

The library processes each child in order, creating text nodes only when the child is a raw `string` or `number` and the parent is a non-text-capable type.

## Nested text

Text-as-Children also works in nested containers. You can think of text like a child flow inside a panel:

```tsx
function NestedText() {
  return (
    <frame Size={new UDim2(0, 320, 0, 180)}>
      <frame>
        <frame>Hello</frame>
        <frame>World</frame>
      </frame>
    </frame>
  );
}
```

This produces multiple text labels that participate in the parent layout. It is especially nice for compact UI blocks where each string is a small text fragment.

## Newlines and paragraph-like content

When a string contains `\n`, the library treats it as line breaks that produce separate text label blocks in the same layout flow. This makes multi-line content easy to express without manually creating a separate `TextLabel` for every line.

```tsx
function MultiLineText() {
  return (
    <frame>
      {"Line 1\nLine 2\nLine 3"}
    </frame>
  );
}
```

This is the same idea as a paragraph broken into separate text lines. Each line becomes a separate text node or label so it can be laid out naturally inside the parent.

## Multiple text children and list layout

If a parent contains several adjacent text children, they are laid out as separate label entries. For example:

```tsx
function StackOfLabels() {
  return (
    <frame>
      Hello
      {" "}
      World
      {"!"}
    </frame>
  );
}
```

The runtime can arrange those text fragments using a `UIListLayout`-style layout flow so they sit next to or below each other depending on the layout rules of the parent.

```tsx
function VerticalTextList() {
  return (
    <scrollingframe Size={new UDim2(0, 220, 0, 180)}>
      First item
      Second item
      Third item
    </scrollingframe>
  );
}
```

This pattern is great for simple lists and small text blocks where creating explicit `TextLabel`s would feel verbose.

## TextButton and ImageButton behavior

When the target is a `TextButton` or similar text-capable control, the string child is usually assigned directly to the instance's `Text` property.

```tsx
function ActionButton() {
  return (
    <textbutton
      Size={new UDim2(0, 180, 0, 44)}
      TextColor3={Color3.fromRGB(255, 255, 255)}
      BackgroundColor3={Color3.fromRGB(59, 130, 246)}
    >
      Save Changes
    </textbutton>
  );
}
```

For buttons that aren't text-native, the generated text label still works as a child. This is useful for `ImageButton`-style controls where you want a visible label on top of an image.

```tsx
function IconButtonWithText() {
  return (
    <imagebutton Image="rbxassetid://456789" Size={new UDim2(0, 120, 0, 120)}>
      Play
    </imagebutton>
  );
}
```

## Performance considerations

This feature is convenient, but it is not free.

Each raw text child that is converted into a label creates an extra GUI object. That is usually fine for small UIs, but it matters if you render a lot of them dynamically.

Examples where extra labels are expected:

```tsx
<frame>
  {"A"}
  {"B"}
  {"C"}
  {"D"}
</frame>
```

This will create multiple `TextLabel` instances internally. If you are rendering a large list or generating lots of text-heavy UI, prefer explicit labels when you need tighter control over layout, pooling, and performance.

When to prefer explicit labels:

- hundreds or thousands of text nodes
- frequently updating text-heavy lists
- custom font, alignment, or layout tuning
- performance-sensitive HUD or menu UI

## Disabling the feature

If you want to opt out of automatic label wrapping, do not pass raw `string` / `number` children to a non-text-capable parent. Instead, either:

1. Wrap the text in a fragment, or
2. Create the `textlabel` explicitly.

```tsx
function ExplicitText() {
  return (
    <frame>
      <textlabel Text="Hello" BackgroundTransparency={1} />
    </frame>
  );
}
```

Using a fragment is a common way to separate text from automatic conversion in more advanced composition patterns:

```tsx
function ManualTextBypass() {
  return (
    <frame>
      <>
        <textlabel Text="Hello" BackgroundTransparency={1} />
      </>
    </frame>
  );
}
```

This keeps the text explicit and avoids the automatic wrapper path.

## Summary

Text-as-Children is a small but powerful ergonomics feature. It lets you write natural JSX text inside Roblox containers while still producing real `TextLabel` instances under the hood. It is ideal for simple UI labels, headings, and short text blocks. For highly dynamic or performance-sensitive interfaces, keep explicit `TextLabel`s when you need the most control.
