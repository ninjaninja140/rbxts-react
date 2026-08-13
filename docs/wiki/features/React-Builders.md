# React Builders

`@nrbx/react-builders` is a fluent, chainable API for building Roblox UI
trees without writing JSX. It is modeled on Discord.js's component builders:
you construct a builder object, call setter methods to populate its
properties, nest children, and then either render the result as a React
element or serialize it to a plain table for transport.

It is useful when you want to:

- Build UI trees from data, without a JSX file per layout
- Generate a UI on the server and send it to clients over a network boundary
- Store component layouts as data (for example, in a DataStore or config file)
- Compose a UI programmatically where method chaining reads better than nested JSX

## Installation

```bash
npm install @nrbx/react-builders
yarn add @nrbx/react-builders
pnpm add @nrbx/react-builders
```

The package depends on `@nrbx/react` as a peer dependency, so make sure both
are installed.

## Quick start

```ts
import { Frame, TextLabel, Builders } from "@nrbx/react-builders";

const panel = new Frame()
	.setBackground(Color3.fromRGB(255, 255, 255))
	.setSize(new UDim2(0, 200, 0, 100))
	.addChildComponent((child) =>
		child.setType("TextLabel").setText("Hello world").setTextSize(24),
	);

// Render it
const element = Builders.constructElement(panel);
root.render(element);
```

Every setter returns the builder itself, so calls chain in any order.

## Core concepts

### Builders are property tables

A builder is just a Roblox class name plus a map of property values and a
list of child builders. It holds no Roblox Instances and performs no work
until you call `constructElement` (or `toTable`). This is what makes the
tree serializable.

### Two ways to set properties

**Typed `.set()`** — accepts any writable property of the pinned class:

```ts
new Frame().set("Size", new UDim2(0, 200, 0, 100));
new Frame().set("BackgroundColor3", new Color3(1, 0, 0));
```

The first argument is narrowed to the properties that exist on the builder's
class, and the second argument is checked against that property's type.

**Shorthand setters** — ergonomic methods for the most common properties:

```ts
new Frame()
	.setBackground("white")
	.setSize(new UDim2(0, 200, 0, 100))
	.setPosition(new UDim2(0, 10, 0, 10))
	.setVisible(true)
	.setZIndex(5);
```

Shorthand setters exist on every builder regardless of class. The
class-specific builders add more (for example, `ScrollingFrame` adds
`setCanvasSize`, `CanvasGroup` adds `setGroupColor`).

### Colors

The color setters (`setBackground`, `setTextColor`, `setBorderColor`,
`setImageColor`, and `setGroupColor`) accept either a `Color3` or a string,
and the string forms are resolved at build time:

| Form | Example |
|---|---|
| Named CSS color | `"white"`, `"rebeccapurple"`, `"tomato"` |
| Hex | `"#fff"`, `"#ff0000"`, `"ff0000"` |
| `rgb()` / `rgba()` | `"rgb(255, 0, 0)"`, `"rgba(255, 0, 0, 1)"` |

Alpha values in `rgba()` are ignored; Roblox transparency is set separately
with `setBackgroundTransparency`.

### Children

Nest builders with `addChild`, `addChildComponent` (an alias), or
`addChildren` for several at once:

```ts
new Frame().addChild(
	new TextLabel().setText("Direct instance"),
);

new Frame().addChildComponent((child) =>
	child.setType("TextButton").setText("Callback style"),
);

new Frame().addChildren(
	new TextLabel().setText("A"),
	new TextLabel().setText("B"),
);
```

The callback form receives a fresh `Frame` builder; call `setType` on it to
change the class. Callbacks are the idiomatic style because they keep the
parent chain readable.

### React keys

Set a key for list reconciliation; it becomes the `key` prop on the generated
element:

```ts
list.addChild(new TextLabel().setText("Item").setKey("item-1"));
```

## Rendering to React

`Builders.constructElement` walks the tree depth-first and produces a React
element via `React.createElement`:

```ts
const element = Builders.constructElement(panel);
root.render(element);
```

Any builder class name is passed through as a Roblox class tag (for example
`"Frame"`, `"TextLabel"`), so it renders exactly like the equivalent JSX.

You can also deserialize and render in one call:

```ts
const element = Builders.createElementFromTable(node);
root.render(element);
```

## Embedding existing React components

If you already have a JSX component and want it inside a builder tree, use
`wrapElement`:

```ts
const button = <MyFancyButton label="OK" />;

const panel = new Frame().addChild((child) =>
	Builders.wrapElement(button, child),
);
```

The wrapped element is appended to that builder's children at render time.

## Custom components

Register a React component so builders can reference it by string key:

```ts
import { Builders } from "@nrbx/react-builders";
import { MyCard } from "./components/MyCard";

Builders.registerComponent("MyCard", MyCard);

const card = new Builders.Builder("MyCard")
	.set("title", "Hello world")
	.set("subtitle", "A card built from data");
```

When `constructElement` encounters a registered key, it calls the registered
component with the stored properties instead of instantiating a Roblox class.
Unregister with `unregisterComponent` and list keys with
`getRegisteredComponents`.

## Serialization and the server → client pattern

The whole point of a table-based builder is that the tree is data. Use
`toTable` to get a JSON-safe structure, send it over the network, and
rebuild it on the other side:

```ts
// Server
const tree = new Frame()
	.setSize(new UDim2(1, 0, 1, 0))
	.setBackground("#0f172a")
	.addChildComponent((child) =>
		child.setType("TextLabel").setText("From the server").setTextColor("white"),
	);

remote.FireClient(player, tree.toTable());
```

```ts
// Client
remote.OnClientEvent.Connect((node) => {
	const builder = Builders.fromTable(node);
	const element = Builders.constructElement(builder);
	root.render(element);
});
```

`toTable` converts every Roblox value to a JSON-safe representation:

| Roblox type | Serialized shape |
|---|---|
| `Color3` | `{ type: "Color3", r, g, b }` |
| `UDim2` | `{ type: "UDim2", xScale, xOffset, yScale, yOffset }` |
| `UDim` | `{ type: "UDim", scale, offset }` |
| `Vector2` | `{ type: "Vector2", x, y }` |
| `Rect` | `{ type: "Rect", min, max }` |
| `EnumItem` | `{ type: "Enum", enumName, value }` |
| `string`, `number`, `boolean` | passed through unchanged |

`fromTable` reverses this, reconstructing real `Color3`, `UDim2`, and
`EnumItem` values. A `BuilderNode` looks like:

```ts
{
	type: "Frame",
	properties: {
		Size: { type: "UDim2", xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 },
		BackgroundColor3: { type: "Color3", r: 0.058, g: 0.09, b: 0.164 },
	},
	children: [
		{
			type: "TextLabel",
			properties: { Text: "From the server" },
			children: [],
		},
	],
}
```

## Concrete builder classes

These classes pin the builder type to a specific Roblox class so `.set()` is
fully type-checked, and add class-specific shorthand methods.

| Class | Roblox class |
|---|---|
| `Frame` | `Frame` |
| `TextLabel` | `TextLabel` |
| `TextButton` | `TextButton` |
| `TextBox` | `TextBox` |
| `ImageLabel` | `ImageLabel` |
| `ImageButton` | `ImageButton` |
| `ScrollingFrame` | `ScrollingFrame` |
| `CanvasGroup` | `CanvasGroup` |
| `ViewportFrame` | `ViewportFrame` |
| `UIListLayout` | `UIListLayout` |
| `UIGridLayout` | `UIGridLayout` |
| `UIPageLayout` | `UIPageLayout` |
| `UITableLayout` | `UITableLayout` |
| `UIPadding` | `UIPadding` |
| `UICorner` | `UICorner` |
| `UIStroke` | `UIStroke` |
| `UIGradient` | `UIGradient` |
| `UIAspectRatioConstraint` | `UIAspectRatioConstraint` |
| `UISizeConstraint` | `UISizeConstraint` |
| `UITextSizeConstraint` | `UITextSizeConstraint` |

For anything else, use the generic builder with a class name string:

```ts
new Builders.Builder("UIListLayout").set("FillDirection", Enum.FillDirection.Vertical);
```

## The `Builders` namespace

The namespace is the one-stop import for the whole API:

```ts
import { Builders } from "@nrbx/react-builders";

const frame = new Builders.Frame();
const label = new Builders.TextLabel().setText("Hi");
const generic = new Builders.Builder("Frame");
```

Full contents:

| Member | Purpose |
|---|---|
| `Builder` | Generic builder for any class name |
| `Frame`, `TextLabel`, ... | Concrete builder classes |
| `constructElement` | Builder tree → React element |
| `createElementFromTable` | `fromTable` + `constructElement` in one call |
| `fromTable` | Reconstruct a builder from a `BuilderNode` |
| `wrapElement` | Embed an existing React element as a child |
| `registerComponent` | Register a custom component by key |
| `unregisterComponent` | Remove a registered component |
| `getRegisteredComponents` | List registered component keys |

## API reference

### `BaseBuilder<T>`

| Method | Description |
|---|---|
| `set(key, value)` | Typed property setter |
| `setProperty(key, value)` | Untyped property setter (internal) |
| `setType(name)` | Change the Roblox class name |
| `setBackground(value)` | `BackgroundColor3`, accepts color string |
| `setBackgroundTransparency(value)` | `BackgroundTransparency` |
| `setSize(value)` | `Size` (`UDim2`) |
| `setPosition(value)` | `Position` (`UDim2`) |
| `setAnchorPoint(value)` | `AnchorPoint` (`Vector2`) |
| `setVisible(value)` | `Visible` |
| `setZIndex(value)` | `ZIndex` |
| `setLayoutOrder(value)` | `LayoutOrder` |
| `setRotation(value)` | `Rotation` |
| `setTransparency(value)` | `Transparency` |
| `setClipsDescendants(value)` | `ClipsDescendants` |
| `setAutomaticSize(value)` | `AutomaticSize` |
| `setText(value)` | `Text` |
| `setTextColor(value)` | `TextColor3`, accepts color string |
| `setTextSize(value)` | `TextSize` |
| `setTextTransparency(value)` | `TextTransparency` |
| `setFont(value)` | `Font` |
| `setTextWrapped(value)` | `TextWrapped` |
| `setTextXAlignment(value)` | `TextXAlignment` |
| `setTextYAlignment(value)` | `TextYAlignment` |
| `setTextTruncate(value)` | `TextTruncate` |
| `setRichText(value)` | `RichText` |
| `setTextScaled(value)` | `TextScaled` |
| `setBorderSizePixel(value)` | `BorderSizePixel` |
| `setBorderColor(value)` | `BorderColor3`, accepts color string |
| `setImage(value)` | `Image` |
| `setImageColor(value)` | `ImageColor3`, accepts color string |
| `setImageTransparency(value)` | `ImageTransparency` |
| `setScaleType(value)` | `ScaleType` |
| `setSliceCenter(value)` | `SliceCenter` (`Rect`) |
| `setSliceScale(value)` | `SliceScale` |
| `setActive(value)` | `Active` |
| `setSelectable(value)` | `Selectable` |
| `setAutoButtonColor(value)` | `AutoButtonColor` |
| `setModal(value)` | `Modal` |
| `addChild(child)` | Append a builder or callback |
| `addChildComponent(child)` | Alias of `addChild` |
| `addChildren(...children)` | Append several builders |
| `setKey(key)` | Set the React key |
| `get(key)` | Read a stored property |
| `has(key)` | Whether a property is set |
| `clone()` | Deep copy the tree |
| `merge(source)` | Bulk-set properties from a plain object |
| `toTable()` | Serialize to a `BuilderNode` |

### Colors module

`setBackground` and friends route through `resolveColorValue`, which handles
the color strings shown in the table above.

## Caveats

- **No events in serialized trees.** Event handlers are functions, and
  functions cannot be JSON-encoded. Build the tree on the client (or
  reattach events after `fromTable`) when you need interactive behavior.
  You can still set events on client-built trees by using `.set()` with an
  event callback value before rendering.
- **Properties are applied verbatim.** `constructElement` passes stored
  properties straight into `React.createElement`; it does not validate that
  a property exists on the Roblox class at runtime. The TypeScript layer
  catches mistakes for known classes, but the generic `Builder` is untyped
  by design.
- **Registered components must be registered before render.** If you
  serialize a tree that references a custom component key and send it to
  another machine, that machine must register the same key before calling
  `fromTable` + `constructElement`.
- **Unsupported value types are dropped.** `toTable` returns `undefined`
  for value types it does not recognize, which JSON then omits. Stick to
  the supported Roblox value types listed above.
