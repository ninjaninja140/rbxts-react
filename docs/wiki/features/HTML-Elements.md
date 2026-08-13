# HTML Elements

`@nrbx/react` gives you browser-like JSX tags that map to Roblox GUI instances. Instead of writing raw `Frame`, `TextLabel`, `TextButton`, and `ImageLabel` calls all day, you can use semantic HTML tags such as `<div>`, `<button>`, `<h1>`, and `<form>` to build Roblox UI with a familiar web mental model.

This is useful when you want:

- Familiar JSX for developers coming from React/HTML
- More semantic, readable UI code
- Easier portability from web UI to Roblox UI
- A simpler component API for common interface patterns

The alias layer is intentionally semantic: it focuses on mapping HTML tags to the nearest Roblox GUI equivalent, while still letting you override defaults with props and `className`.

## Why use HTML elements?

Using HTML-like tags in `@nrbx/react` gives you a friendly and portable abstraction.

- Familiarity: developers know tags like `<div>`, `<button>`, `<img>`, and `<label>`
- Portability: layouts are easier to move between HTML and Roblox-friendly UI patterns
- Readability: semantic tags communicate intent better than raw GUI instance names
- Consistency: shared primitives help create reusable component libraries

In other words, the goal is not to reproduce a browser DOM exactly. The goal is to give you a familiar, component-friendly way to build Roblox UI.

## Element mapping

The default HTML → Roblox mapping is intentionally straightforward:

| HTML tag | Roblox equivalent | Notes |
| --- | --- | --- |
| `<div>` | `Frame` | Generic container |
| `<span>` | `TextLabel` | Inline text |
| `<p>` | `Frame` with nested `TextLabel` | Paragraph container |
| `<h1>` to `<h6>` | `TextLabel` | Headings with semantic sizing |
| `<button>` | `TextButton` | Clickable action |
| `<img>` | `ImageLabel` | Image display |
| `<a>` | `TextButton` | Hyperlink style |
| `<ul>` / `<ol>` | `ScrollingFrame` + `UIListLayout` | List containers |
| `<li>` | `Frame` with bullet + `TextLabel` | List item container |
| `<section>` | `Frame` | Section container |
| `<header>` | `Frame` | Top-of-page or top-of-card container |
| `<footer>` | `Frame` | Footer container |
| `<main>` | `Frame` | Main content area |
| `<nav>` | `Frame` | Navigation container |
| `<form>` | `Frame` | Custom form wrapper |
| `<label>` | `TextLabel` | Form field label |
| `<input>` | `TextBox` or custom field | Text, number, checkbox, radio, color |
| `<select>` | Custom dropdown container | Usually built from list items and selection logic |
| `<textarea>` | `TextBox` with multiline support | Multi-line input |

The mapping is designed to align with the closest Roblox primitive while keeping the API recognizable to web developers.

## Default styles applied to HTML elements

`@nrbx/react` applies sensible defaults when an element is used without custom props. These defaults can be overridden at any time.

### Headsings

Headings are styled semantically:

- `h1` → `TextSize = 32`, `Font = Enum.Font.GothamBold`
- `h2` → `TextSize = 28`, `Font = Enum.Font.GothamBold`
- `h3` → `TextSize = 24`, `Font = Enum.Font.GothamBold`
- `h4` → `TextSize = 20`, `Font = Enum.Font.GothamBold`
- `h5` → `TextSize = 18`, `Font = Enum.Font.GothamBold`
- `h6` → `TextSize = 16`, `Font = Enum.Font.GothamBold`

The default style is meant to mimic a clean, readable UI and gives you a strong foundation for headings without extra boilerplate.

### Paragraphs and text-like elements

- `<p>` gets a readable body text style, typically `Gotham`, 14px, and transparent background
- `<span>` is a simple text element with a transparent background
- `<a>` is styled as a hyperlink: blue text, underlined, clickable
- `<button>` is a `TextButton` with button-like semantics and obvious text behavior
- `<img>` uses `ImageLabel`, which expects a Roblox asset ID or URL in its `Image` property

### Containers and semantic layout elements

- `<div>`, `<section>`, `<header>`, `<footer>`, `<main>`, `<nav>` render as `Frame`s with no opinionated styling unless you add one
- `<ul>` and `<ol>` are list containers that commonly use `ScrollingFrame` + `UIListLayout`
- `<li>` is usually built as a row containing a bullet and a text element

## Attribute mapping

The alias layer makes the most common HTML attributes map cleanly to Roblox properties.

| HTML attribute | Element | Roblox equivalent |
| --- | --- | --- |
| `src` | `<img>` | `Image` |
| `href` | `<a>` | Link action or navigation callback |
| `alt` | `<img>` | Usually text fallback or ignored unless custom logic handles it |
| `value` | `<input>`, `<textarea>` | `Text` |
| `placeholder` | `<input>`, `<textarea>` | `PlaceholderText` |
| `checked` | checkbox/radio | Selected state or boolean field |
| `disabled` | form controls | `Active`/`Selectable` state |

### Drag & resize (experimental)

Any GUI element also accepts two experimental, opt-in behavior props:

- `draggable` — lets the element be dragged around, clamped to its parent container.
- `resizable` — lets the element be resized by tugging a corner, clamped to (and never larger than) its parent container.

Both default to off and are considered experimental.

```tsx
<div
  className="w-48 h-24 bg-blue-500"
  draggable
  resizable
/>
```

### `src` on `<img>`

```tsx
<img src="rbxassetid://123456789" />
```

This maps to the Roblox `ImageLabel.Image` property.

### `href` on `<a>`

```tsx
<a href="https://example.com" onClick={() => print("Open docs")}>Docs</a>
```

In Roblox, `href` is usually treated as a link action or route target. In practice, it is commonly consumed by an `Activated` handler or by custom navigation logic.

## How defaults are overridden

You can override defaults with either `className` or direct props.

```tsx
<h1 className="text-4xl font-bold text-white">Welcome</h1>
```

or:

```tsx
<h1
  TextSize={48}
  Font={Enum.Font.GothamBlack}
  TextColor3={Color3.fromRGB(255, 255, 255)}
>
  Welcome
</h1>
```

The same is true for paragraph or link styles:

```tsx
<p className="text-base text-gray-700">A paragraph with custom styling.</p>
<a
  href="https://example.com"
  className="text-blue-500 underline"
  TextColor3={Color3.fromRGB(59, 130, 246)}
>
  Read more
</a>
```

This means the element aliases behave like semantic defaults without preventing custom UI design.

## Form elements and custom form behavior

Roblox does not provide a browser DOM form system, so `@nrbx/react` uses custom, web-like form elements built from Roblox GUI instances.

### Supported form tags

- `<form>` → custom container for a form grouping
- `<label>` → `TextLabel` used for field labels
- `<input>` → text, number, checkbox, radio, and color field implementations
- `<select>` → custom dropdown/list selector with `<option>` children
- `<textarea>` → multi-line `TextBox`

### `input` types

The library supports browser-like input semantics, even when the underlying Roblox implementation is custom:

- `type="text"` → `TextBox`
- `type="number"` → numeric entry field or custom numeric input
- `type="checkbox"` → custom checkbox state control
- `type="radio"` → custom radio selection control
- `type="color"` → `Color3` picker / color chooser UI

Example:

```tsx
<form className="flex flex-col gap-3">
  <label>Display name</label>
  <input type="text" placeholder="Jane Doe" />

  <label>Age</label>
  <input type="number" value={42} />

  <label>Theme color</label>
  <input type="color" value={Color3.fromRGB(59, 130, 246)} />
</form>
```

### `<select>` and `<option>`

`<select>` is implemented as a custom dropdown/list-like control with child `<option>` entries.

```tsx
<select value="pro">
  <option value="free">Free</option>
  <option value="pro">Pro</option>
  <option value="team">Team</option>
</select>
```

In practice, the selection state is usually handled by a custom `onChange` callback or a state variable in your component.

### `<textarea>`

`<textarea>` usually maps to a multiline `TextBox` with a larger height and wrapping behavior.

```tsx
<textarea
  placeholder="Tell us more..."
  className="h-24 w-full rounded-md border border-gray-300 p-2"
/>
```

## Example: simple content card

```tsx
import React from "@nrbx/react";

function FeatureCard() {
  return (
    <div className="flex flex-col rounded-xl bg-white p-4 shadow-lg">
      <header className="mb-2 border-b border-gray-200 pb-2">
        <h2 className="text-xl font-bold text-slate-900">Build faster</h2>
      </header>

      <img src="rbxassetid://123456789" className="h-32 w-full rounded-md object-cover" />

      <p className="mt-3 text-sm text-slate-600">
        Compose UI with familiar React-inspired tags while targeting Roblox GUI primitives.
      </p>

      <a
        href="https://example.com/docs"
        className="mt-3 text-blue-500 underline"
        Event={{
          Activated: () => print("Open docs"),
        }}
      >
        Read the docs
      </a>
    </div>
  );
}
```

## Example: dashboard layout using semantic tags

```tsx
import React from "@nrbx/react";

function Dashboard() {
  return (
    <main className="flex h-full w-full flex-col bg-slate-100">
      <header className="flex items-center justify-between bg-slate-900 p-4 text-white">
        <h1 className="text-2xl font-bold">Studio</h1>
        <nav className="flex gap-4">
          <a href="/home" className="text-white underline">Home</a>
          <a href="/projects" className="text-white underline">Projects</a>
          <a href="/settings" className="text-white underline">Settings</a>
        </nav>
      </header>

      <section className="flex flex-1 gap-4 p-4">
        <aside className="w-64 rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Menu</h2>
          <ul className="mt-2 space-y-2">
            <li>Overview</li>
            <li>Analytics</li>
            <li>Billing</li>
          </ul>
        </aside>

        <div className="flex-1 rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-xl font-bold">Recent activity</h2>
          <p className="mt-2 text-sm text-slate-600">
            New builds are publishing automatically.
          </p>

          <button className="mt-4 rounded-md bg-blue-500 px-4 py-2 text-white">
            Publish
          </button>
        </div>
      </section>
    </main>
  );
}
```

## Accessibility considerations

HTML-like tags are helpful for readability, but they are not a full-browser accessibility layer. Keep these rules in mind when composing UI:

- Use meaningful heading structure: `<h1>` → `<h2>` → `<h3>`
- Pair `<label>` with the relevant form field to keep labels visible and readable
- Provide good contrast with `TextColor3`, `BackgroundColor3`, and high-contrast theme choices
- Use placeholder text and clear button labels when appropriate
- Keep interactive elements large enough to tap or click comfortably
- Prefer semantic grouping for navigation and content regions (`<nav>`, `<main>`, `<section>`)

This helps your UI stay usable even though Roblox does not implement a full HTML accessibility tree.

## Limitations and caveats

Not every HTML tag has a direct Roblox equivalent.

- `<canvas>`, `<svg>`, `<video>`, `<audio>`, `<iframe>`, and similar browser-only elements do not map cleanly to Roblox GUI objects
- Some browser behaviors such as inline layout, CSS pseudo-elements, and DOM events are not fully emulated
- `srcset`, `sizes`, `alt`, and other browser-specific image attributes may not have direct Roblox equivalents
- Form submission behavior is custom; it is not a native browser form submission pipeline
- The alias layer is a development convenience, not a DOM clone

When a tag has no meaningful Roblox equivalent, use a custom component or a Roblox-native GUI instance instead.

## Summary

The HTML element aliases in `@nrbx/react` are a convenience layer that makes Roblox UI code feel familiar and portable. They map common web tags to Roblox GUI primitives, apply sensible defaults for text and headings, and let you override styling with `className` or props.

They are most useful when you want:

- semantic UI structure
- readable JSX code
- fast prototyping with web-like tags
- compatibility with common web patterns

For anything browser-specific or DOM-specific, you still need Roblox-native logic and custom components.
