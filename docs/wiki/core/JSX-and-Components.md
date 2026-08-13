# JSX & Components

`@nrbx/react` gives you React-style components for Roblox UI. You write TSX, the compiler turns it into Lua calls, and the runtime resolves those calls into Roblox instances.

The core idea is simple:

- Lowercase tags like `<frame>` and `<textlabel>` become Roblox instances.
- Uppercase tags like `<MyPanel />` call a component function.
- The JSX runtime wraps the underlying React element creation process with Roblox-specific behavior.
- You can mix native Roblox props, HTML-style tags, events, and Tailwind-like class names in the same component tree.

---

## 1. JSX in roblox-ts

`roblox-ts` compiles TSX into Lua by transforming JSX into calls to a JSX factory. In `@nrbx/react`, that factory is `React.createElement`.

This means a component like this:

```tsx
import React from "@nrbx/react";

function Greeting({ name }: { name: string }) {
  return (
    <frame BackgroundTransparency={1}>
      <textlabel Text={"Hello, " + name} />
    </frame>
  );
}
```

is effectively compiled to a call roughly like this:

```tsx
const Greeting = ({ name }: { name: string }) => {
  return React.createElement(
    "frame",
    { BackgroundTransparency: 1 },
    React.createElement("textlabel", { Text: "Hello, " + name }),
  );
};
```

The wrapper around React's runtime does a few extra things that regular JSX does not:

- resolves HTML-like tags like `<div>` or `<button>` to Roblox GUI classes
- wraps plain string/number children into text elements when needed
- translates web-like event props like `onClick` into Roblox `Event={{ Activated: ... }}`
- resolves Tailwind-style `className` values into underlying Roblox props

To enable TSX in a roblox-ts project, set the JSX compiler options:

```tsx
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "React.createElement",
    "jsxFragmentFactory": "React.createFragment"
  }
}
```

If you use a custom transform or a non-default setup, make sure it points at `React.createElement` and `React.createFragment` instead of a different runtime.

---

## 2. createElement

The JSX factory is the wrapper around React's element creation. Its runtime signature is:

```tsx
createElement(type, config, ...children)
```

In `@nrbx/react`, the implementation still behaves like React, but it adds Roblox-specific behavior before creating the instance.

```tsx
export function createElement(
  type: string | Function,
  config?: Record<string, unknown>,
  ...children: unknown[]
): unknown;
```

This wrapper does three important things for everyday UI work:

- converts text-as-children into Roblox text elements
- translates event props such as `onClick` into `Event={{ Activated: fn }}`
- parses `className` into actual Roblox property values

Example:

```tsx
const button = React.createElement(
  "textbutton",
  {
    onClick: () => print("clicked"),
    className: "rounded-lg bg-blue-500 px-4 py-2 text-white",
  },
  "Save",
);
```

Under the hood, that is roughly equivalent to:

```tsx
const button = React.createElement(
  "TextButton",
  {
    Event: {
      Activated: () => print("clicked"),
    },
    BackgroundColor3: Color3.fromRGB(...),
    Text: "Save",
  },
);
```

The point is that you do not need to hand-write this conversion logic every time. The wrapper handles it for you.

---

## 3. Component types

`@nrbx/react` supports the normal React-style component forms.

### Function components

```tsx
import React from "@nrbx/react";

type Props = {
  title: string;
  onClick?: () => void;
};

function MyComp(props: Props): React.ReactElement {
  return <textbutton Text={props.title} onClick={props.onClick} />;
}
```

### Arrow function components

```tsx
import React from "@nrbx/react";

const MyComp: React.FC<Props> = (props) => {
  return <textbutton Text={props.title} onClick={props.onClick} />;
};
```

A lot of projects use this form for small UI pieces.

### Class components

```tsx
import React from "@nrbx/react";

type Props = { title: string };
type State = { count: number };

class MyComp extends React.Component<Props, State> {
  state: State = { count: 0 };

  render() {
    return (
      <frame>
        <textlabel Text={this.props.title} />
        <textbutton
          Text={`Count: ${this.state.count}`}
          onClick={() => this.setState({ count: this.state.count + 1 })}
        />
      </frame>
    );
  }
}
```

### Children

Children are available through `props.children` in function components and `this.props.children` in class components.

```tsx
type PanelProps = {
  title: string;
  children?: React.ReactNode;
};

function Panel({ title, children }: PanelProps) {
  return (
    <frame>
      <textlabel Text={title} />
      {children}
    </frame>
  );
}
```

---

## 4. JSX rules

There are a few rules worth keeping in mind when writing JSX in `@nrbx/react`.

### Tags must be closed

```tsx
<frame></frame>
<frame />
```

Both are valid. Use the self-closing form for empty elements.

### One root element per render

A component should return one root element, or a Fragment if you need multiple siblings.

```tsx
function Example() {
  return (
    <frame>
      <textlabel Text="One" />
      <textlabel Text="Two" />
    </frame>
  );
}
```

If you need multiple top-level nodes, wrap them in a Fragment:

```tsx
function Example() {
  return (
    <>
      <textlabel Text="One" />
      <textlabel Text="Two" />
    </>
  );
}
```

### Expressions use `{}`

```tsx
function Greeting({ name, show }: { name: string; show: boolean }) {
  return (
    <textlabel
      Text={"Hello " + name}
      Visible={show}
    />
  );
}
```

### Conditional rendering

```tsx
function Banner({ show }: { show: boolean }) {
  return <frame>{show && <textlabel Text="Visible" />}</frame>;
}

function Status({ show }: { show: boolean }) {
  return (
    <frame>
      {show ? <A /> : <B />}
    </frame>
  );
}
```

### Lists and keys

```tsx
function ItemList({ items }: { items: Array<{ id: string; label: string }> }) {
  return (
    <frame>
      {items.map((item) => (
        <textlabel key={item.id} Text={item.label} />
      ))}
    </frame>
  );
}
```

`key` is important when rendering repeated children. It helps the reconciler keep list items stable during updates.

---

## 5. Fragments

Fragments let you return multiple sibling elements without adding an extra wrapper.

### Shorthand fragment

```tsx
function Pair() {
  return (
    <>
      <textlabel Text="A" />
      <textlabel Text="B" />
    </>
  );
}
```

### Explicit `React.Fragment`

```tsx
function Pair() {
  return (
    <React.Fragment>
      <textlabel Text="A" />
      <textlabel Text="B" />
    </React.Fragment>
  );
}
```

### Keyed fragments

```tsx
function RowList({ rows }: { rows: Array<{ id: string; label: string }> }) {
  return (
    <>
      {rows.map((row) => (
        <React.Fragment key={row.id}>
          <textlabel Text={row.label} />
        </React.Fragment>
      ))}
    </>
  );
}
```

Keyed Fragments are especially useful when you need to preserve identity while still returning multiple nodes in a mapped list.

---

## 6. Built-in tags vs custom components

The JSX runtime uses the tag name to decide what to render.

### Lowercase tags: Roblox instances

```tsx
<frame />
<textlabel />
<textbutton />
```

These are resolved as Roblox instance classes, usually through `Instance.new(...)` semantics.

### Uppercase tags: custom components

```tsx
<MyComponent />
<ProfileCard />
```

Uppercase names are treated as user-defined component functions or classes. The runtime calls the component and passes the props object.

### HTML element aliases

```tsx
<div />
<span />
<button />
<h1 />
```

These map through the HTML element resolver to the closest Roblox equivalent (`Frame`, `TextLabel`, `TextButton`, etc.). This makes the API familiar for developers coming from React or HTML.

`@nrbx/react` intentionally supports both native Roblox-style and HTML-like tags so you can write what feels natural for the component.

---

## 7. Props patterns

Props are just a plain object passed into your component. You can use them in the same ways you expect from React.

### Destructuring props

```tsx
type CardProps = {
  title: string;
  onClick?: () => void;
};

function Card({ title, onClick }: CardProps) {
  return <textbutton Text={title} onClick={onClick} />;
}
```

### Default props

```tsx
type BadgeProps = { size?: "sm" | "md" | "lg" };

function Badge({ size = "md" }: BadgeProps) {
  return <textlabel Text={size} />;
}
```

### Spreading props

```tsx
const baseProps = {
  title: "Save",
  onClick: () => print("Saved"),
};

function Example() {
  return <MyButton {...baseProps} extra="value" />;
}
```

### `children` prop

```tsx
function Container({ children }: { children?: React.ReactNode }) {
  return <frame>{children}</frame>;
}
```

### `key` prop for reconciliation

```tsx
items.map((item) => <row key={item.id} item={item} />);
```

`key` is used by the reconciler, not as a regular DOM-like prop. It is mainly for list stability and minimal re-creation of UI elements.

---

## 8. Forwarding refs

Refs are forwarded with `React.forwardRef`.

```tsx
const MyInput = React.forwardRef<TextBox, { placeholder?: string }>(
  (props, ref) => <textbox ref={ref} PlaceholderText={props.placeholder} />,
);
```

This pattern is useful for components that wrap a Roblox instance and want to expose the instance reference to the parent.

Use it for input components, custom controls, and any component where the parent needs direct access to the underlying instance.

---

## 9. Higher-order components

A higher-order component (HOC) takes a component and returns a new component with additional behavior.

```tsx
function withLogger<P>(Component: React.ComponentType<P>) {
  return (props: P) => {
    print("Rendering", Component.displayName);
    return <Component {...props} />;
  };
}
```

This is a common pattern for:

- logging and analytics
- injecting props or feature flags
- wrapping a component with behavior or tracking

---

## 10. Render props

Render props let a component control the rendering logic while the parent provides a render function.

```tsx
function MouseTracker({ render }: { render: (pos: Vector2) => React.ReactElement }) {
  const [pos, setPos] = React.useState(new Vector2(0, 0));

  // ...track mouse

  return render(pos);
}
```

Usage:

```tsx
function Example() {
  return (
    <MouseTracker
      render={(pos) => (
        <textlabel
          Text={`Mouse: ${pos.X}, ${pos.Y}`}
          Position={new UDim2(0, 0, 0, 0)}
        />
      )}
    />
  );
}
```

This pattern is useful when the child wants to decide how the result should be displayed while the parent owns the state or lifecycle.

---

## Practical patterns

Here is the short version to keep in mind:

```tsx
function Example() {
  return (
    <frame className="flex flex-col gap-2 p-4">
      <textlabel Text="Hello" />
      <textbutton onClick={() => print("Clicked")} className="bg-blue-500">
        Press me
      </textbutton>
    </frame>
  );
}
```

Use this as your mental model:

- lowercase tag = Roblox instance
- uppercase tag = component call
- `{}` = expression evaluation
- `key` = stable identity for lists
- fragments = multi-root UI without wrapper elements
- `className` and `onClick` are handled by the `createElement` wrapper

If you can write React components in a browser, the same structure works in Roblox with `@nrbx/react` — you are just targeting Roblox Instances instead of the DOM.
