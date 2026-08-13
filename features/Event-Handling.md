# Event Handling

`@nrbx/react` gives you web-like event props such as `onClick`, `onMouseEnter`, and `onInputChanged`, then translates them to Roblox's `Event={{ Xxx: fn }}` style automatically.

This pattern keeps your code readable while still wiring into the underlying Roblox event system.

## Basic usage

```tsx
<textbutton onClick={() => print("clicked")}>Click</textbutton>
```

This is equivalent to the Roblox pattern:

```tsx
<textbutton Event={{ Activated: () => print("clicked") }}>Click</textbutton>
```

The library handles the prop-to-event mapping for you, so you can write familiar React-style handlers instead of manually building an `Event` table.

## Mouse events

Mouse handlers are excellent for hover states, movement tracking, and quick pointer interaction.

```tsx
function HoverCard() {
  const [hovered, setHovered] = useState(false);

  return (
    <frame
      Size={new UDim2(0, 200, 0, 80)}
      BackgroundColor3={hovered ? Color3.fromRGB(60, 120, 255) : Color3.fromRGB(35, 35, 35)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(rbx, x, y) => {
        // x/y is the mouse position relative to the element or the GUI context,
        // depending on the Roblox event contract for the target instance.
        print("mouse moved", x, y);
      }}
    />
  );
}
```

Common mouse props:

- `onMouseEnter`
- `onMouseLeave`
- `onMouseMove`
- `onMouseButton1Click`
- `onMouseButton2Click`
- `onHover`
- `onUnhover`
- `onDoubleClick`

## Input events

Input handlers are the main mechanism for keyboard, mouse, touch, and gamepad interaction in Roblox UI.

```tsx
<textbox
  onInputBegan={(rbx, input) => {
    if (input.UserInputType === Enum.UserInputType.Keyboard) {
      print("keyboard input began:", input.KeyCode.Name);
    }
  }}
  onInputEnded={(rbx, input) => {
    print("input ended", input.UserInputType.Name);
  }}
  onInputChanged={(rbx, input) => {
    if (input.UserInputType === Enum.UserInputType.Keyboard) {
      print("keyboard changed", input.KeyCode.Name, input.UserInputState);
    }
  }}
/>
```

These events are especially useful when your UI needs to react to typed input, controller buttons, or touch gestures.

## Focus events

Focus handlers are most useful for text inputs and other interactive controls.

```tsx
<textbox
  onFocus={() => print("textbox focused")}
  onBlur={() => print("textbox blurred")}
/>
```

This maps to Roblox focus events such as `Focused` and `FocusLost`.

## Event object shape

Unlike browser React, Roblox events are not a synthetic `SyntheticEvent` system.

The handler usually receives:

- the instance that fired the event (`rbx`)
- followed by event-specific arguments (`input`, `position`, `x`, `y`, etc.)

Example:

```tsx
function handleInput(rbx: TextBox, input: InputObject) {
  // rbx is the instance
  // input is a Roblox InputObject
  // This is not a browser-style SyntheticEvent.
  print(rbx.Name, input.UserInputType.Name, input.KeyCode.Name);
}
```

In practice, the event callback shape is closer to Roblox's native API than to React DOM events:

```tsx
onInputBegan={(rbx, input) => {
  print(input.UserInputType);
  print(input.KeyCode);
}}
```

There is no browser-like `event.target`, `event.preventDefault()`, or `event.currentTarget` contract to rely on unless you build it yourself.

## How the translation works internally

`@nrbx/react` keeps a translation map from React-style props to Roblox event names.

```tsx
const eventMap = {
  onClick: "Activated",
  onMouseEnter: "MouseEnter",
  onMouseLeave: "MouseLeave",
  onMouseMove: "MouseMove",
  onInputBegan: "InputBegan",
  onInputEnded: "InputEnded",
  onInputChanged: "InputChanged",
  onFocus: "Focused",
  onBlur: "FocusLost",
  onDoubleClick: "MouseButton1Click",
  onTouchTap: "TouchTap",
  onLongPress: "TouchLongPress",
};
```

During element creation, the reconciler scans the props object, finds supported `onXxx` props, and moves them into the instance's `Event` table:

```tsx
function translateEventProps(props) {
  const eventTable = {};

  for (const [key, handler] of Object.entries(props)) {
    const robloxEvent = eventMap[key];
    if (robloxEvent) {
      eventTable[robloxEvent] = handler;
      delete props[key];
    }
  }

  props.Event = { ...props.Event, ...eventTable };
  return props;
}
```

This means your component code stays expressive while the runtime still uses the event table Roblox expects.

## Event patterns and argument shapes

Each Roblox event fires with different arguments. The pattern is not uniform across all events.

Common combinations:

- `Activated` → usually just the instance, e.g. `(rbx)`
- `MouseButton1Click` / `MouseButton2Click` → instance and click-related info, depending on the event contract
- `MouseMove` → `(rbx, x, y)` or movement-relative data
- `InputBegan` / `InputEnded` / `InputChanged` → `(rbx, input: InputObject)`
- `TouchTap` / `TouchLongPress` → `(rbx, input: InputObject)`
- `Focus` / `Blur` → mostly instance-focused callbacks
- `SelectionChanged` → selection state information

The main rule is: read the Roblox event signature for the specific event; the prop name only tells you which event is being subscribed to.

## Reference table

| React prop | Roblox event | Typical payload | Notes |
| --- | --- | --- | --- |
| `onClick` | `Activated` | `(rbx)` | Typical button action; common for `TextButton` / `TextButton`-like controls |
| `onMouseButton1Click` | `MouseButton1Click` | `(rbx)` | Direct left-click event |
| `onMouseButton2Click` | `MouseButton2Click` | `(rbx)` | Direct right-click event |
| `onMouseEnter` | `MouseEnter` | `(rbx)` | Pointer enters the instance |
| `onMouseLeave` | `MouseLeave` | `(rbx)` | Pointer leaves the instance |
| `onMouseMove` | `MouseMove` | `(rbx, x, y)` | Pointer movement while hovering |
| `onMouseWheel` | `MouseWheel` | `(rbx, input)` or wheel-related payload | Wheel scrolling on supported elements |
| `onInputBegan` | `InputBegan` | `(rbx, input)` | Input starts |
| `onInputEnded` | `InputEnded` | `(rbx, input)` | Input ends |
| `onInputChanged` | `InputChanged` | `(rbx, input)` | Continuous input state changes |
| `onSelectionChanged` | `SelectionChanged` | `(rbx, selection)` | Selection-related updates |
| `onDragBegin` | `TouchPan` / drag events | `(rbx, position)` | Drag start behavior |
| `onFocus` | `Focused` | `(rbx)` | Element gains focus |
| `onBlur` | `FocusLost` | `(rbx)` | Element loses focus |
| `onHover` | `MouseEnter` | `(rbx)` | Alias-style hover event |
| `onUnhover` | `MouseLeave` | `(rbx)` | Alias-style unhover event |
| `onDoubleClick` | `MouseButton1Click` | `(rbx, clickCount)` | Usually used for double-click detection |
| `onTouchTap` | `TouchTap` | `(rbx, input)` | Mobile tap input |
| `onLongPress` | `TouchLongPress` | `(rbx, input)` | Long press input |

## Common pitfalls

### 1. `Activated` vs `MouseButton1Click`

This is the most common confusion.

- `onClick` is usually mapped to `Activated`
- `onMouseButton1Click` is mapped to `MouseButton1Click`

For a `TextButton`, you normally want `onClick` because it matches the UI action semantics:

```tsx
<textbutton onClick={() => print("button activated")}>Submit</textbutton>
```

If you are specifically trying to detect a raw mouse click event, use the mouse-specific prop instead.

### 2. `InputObject` details matter

`InputObject` is the real Roblox payload for many input events. It carries information like:

- `UserInputType`
- `KeyCode`
- `UserInputState`
- `Delta`
- `Position`

If you ignore the second argument, you may miss the actual keyboard/controller/touch semantics.

```tsx
<frame
  onInputBegan={(rbx, input) => {
    if (input.UserInputType === Enum.UserInputType.Keyboard) {
      print("Key input:", input.KeyCode.Name);
    }
  }}
/>
```

### 3. The event signature changes by event type

Not every event passes the same arguments. A safe pattern is to consistently destructure or branch by event type:

```tsx
onInputChanged={(rbx, input) => {
  if (input.UserInputType === Enum.UserInputType.MouseMovement) {
    print("mouse moved");
  }
}}
```

## Form input handling with `onInputChanged`

For text-entry controls, `onInputChanged` is especially useful for detecting live text modifications and keyboard state transitions.

```tsx
function SearchField() {
  const [query, setQuery] = useState("");

  return (
    <textbox
      Text={query}
      onInputChanged={(rbx, input) => {
        if (input.UserInputType === Enum.UserInputType.Keyboard) {
          setQuery(rbx.Text);
        }
      }}
    />
  );
}
```

This pattern is useful when you need to update state while the user is typing instead of waiting for a dedicated submit action.

## Keyboard input handling

Keyboard input is typically detected through `onInputBegan`, `onInputEnded`, or `onInputChanged`.

```tsx
<frame
  onInputBegan={(rbx, input) => {
    if (input.UserInputType === Enum.UserInputType.Keyboard) {
      switch (input.KeyCode) {
        case Enum.KeyCode.W:
          print("move forward");
          break;
        case Enum.KeyCode.Space:
          print("jump");
          break;
      }
    }
  }}
/>
```

For UI controls, you may also inspect `input.KeyCode` and `input.UserInputState` to differentiate pressed, released, and repeated states.

## Gamepad input handling

Gamepad input uses the same input flow, but you check `UserInputType` and then the controller-specific key code.

```tsx
<frame
  onInputBegan={(rbx, input) => {
    if (input.UserInputType === Enum.UserInputType.Gamepad1) {
      if (input.KeyCode === Enum.KeyCode.ButtonA) {
        print("A pressed on gamepad");
      }

      if (input.KeyCode === Enum.KeyCode.Thumbstick1) {
        print("left stick moved");
      }
    }
  }}
/>
```

This is the recommended pattern for controller-friendly interfaces and games.

## Best practices

- Prefer `onClick` for button actions and user-facing UI activation.
- Use `onInputBegan`/`onInputChanged` for keyboard and controller events.
- Treat Roblox `InputObject` as the source of truth for input metadata.
- Keep event handlers small and stateful logic separate from the UI layer.
- If you need to react to actual mouse click semantics, use the mouse-specific handlers rather than assuming all clicks are the same as button activation.

## Summary

`@nrbx/react` lets you write event code in a React-like way while remaining faithful to Roblox's event model. The translation layer is simple:

- `onXxx` prop
- automatic map to the correct Roblox `Event` key
- callback receives the Roblox event payload

That combination gives you familiar component syntax with the behavior and data Roblox expects.
