# State & Props

In `@nrbx/react`, a Roblox UI is still a tree of components. The component tree has a very important rule:

- Props move from parent to child.
- State lives inside a component and can change over time.
- When state or props change, React re-renders the relevant parts of the tree.

This is the mental model behind almost every Roblox UI you build: data flows downward, user interaction updates state, and the UI reflects those changes.

## Props (Properties)

Props are read-only values passed into a component from its parent. They are like configuration data for the child component.

```tsx
import React, { useState } from "@nrbx/react";

interface PlayerCardProps {
  playerName: string;
  level: number;
  children?: React.ReactNode;
}

function PlayerCard({ playerName, level, children }: PlayerCardProps) {
  return (
    <frame
      Size={new UDim2(0, 260, 0, 100)}
      Position={new UDim2(0, 20, 0, 20)}
      BackgroundColor3={Color3.fromRGB(32, 38, 48)}
      BorderSizePixel={0}
    >
      <textlabel
        Text={`${playerName} • Lv. ${level}`}
        Position={new UDim2(0, 12, 0, 12)}
        Size={new UDim2(1, -24, 0, 24)}
        TextColor3={Color3.fromRGB(255, 255, 255)}
      />
      {children}
    </frame>
  );
}

function LobbyScreen() {
  return (
    <PlayerCard playerName="Ari" level={18}>
      <textlabel Text="Ready to play" Position={new UDim2(0, 12, 0, 48)} />
    </PlayerCard>
  );
}
```

Props are intentionally read-only. A child component should never try to mutate the props object it receives — it should either use the values directly or emit an event back to the parent.

### TypeScript interfaces for type safety

Props are often modeled with TypeScript interfaces. This gives you autocomplete, safer refactors, and clearer component contracts.

```tsx
interface StatBarProps {
  label: string;
  current: number;
  max: number;
  color?: Color3;
}

function StatBar({ label, current, max, color = Color3.fromRGB(75, 213, 109) }: StatBarProps) {
  const percent = Math.min((current / max) * 100, 100);

  return (
    <frame Size={new UDim2(0, 220, 0, 18)} BackgroundColor3={Color3.fromRGB(30, 30, 30)}>
      <frame
        Size={new UDim2(percent / 100, 0, 1, 0)}
        BackgroundColor3={color}
      />
      <textlabel
        Text={`${label}: ${current}/${max}`}
        Position={new UDim2(0, 8, 0, -2)}
        Size={new UDim2(1, -16, 1, 0)}
      />
    </frame>
  );
}
```

### Children prop

The `children` prop is a special prop passed between opening and closing tags.

```tsx
interface ModalProps {
  title: string;
  children?: React.ReactNode;
}

function Modal({ title, children }: ModalProps) {
  return (
    <frame Size={new UDim2(0, 320, 0, 220)}>
      <textlabel Text={title} />
      {children}
    </frame>
  );
}
```

This is useful for UI composition like dialogs, cards, and wrappers that include nested content.

### Default values via destructuring

You can give a prop a default value when you destructure it:

```tsx
interface WeaponSlotProps {
  name: string;
  ammo?: number;
  rarity?: "Common" | "Rare" | "Epic";
}

function WeaponSlot({ name, ammo = 0, rarity = "Common" }: WeaponSlotProps) {
  return (
    <textlabel Text={`${name} • ${rarity} • Ammo: ${ammo}`} />
  );
}
```

This is a clean way to handle optional props without writing repetitive checks.

### Spreading props

You can pass many props at once with object spreading. This is useful when a parent wants to reuse a common configuration for several child elements.

```tsx
const commonFrameProps = {
  BackgroundColor3: Color3.fromRGB(28, 30, 35),
  BorderSizePixel: 0,
  Size: new UDim2(0, 180, 0, 50),
};

function Toolbar() {
  return (
    <>
      <frame {...commonFrameProps} Position={new UDim2(0, 20, 0, 20)} />
      <frame {...commonFrameProps} Position={new UDim2(0, 220, 0, 20)} />
    </>
  );
}
```

Be careful: explicit props override spread props when both specify the same field.

### How props trigger re-renders

A child component re-renders when its parent re-renders and passes different values to it.

```tsx
function ScoreBoard({ score }: { score: number }) {
  return <textlabel Text={`Score: ${score}`} />;
}

function Leaderboard() {
  const [score, setScore] = useState(0);

  return (
    <>
      <ScoreBoard score={score} />
      <textbutton Text="+10" onClick={() => setScore(score + 10)} />
    </>
  );
}
```

When the parent updates `score`, the `ScoreBoard` receives a new prop and re-renders with the new text.

## State

State is local data owned by a component. It is mutable from the component's perspective, and when it changes, React schedules a re-render.

### `useState` hook

Use `useState` to store values that change over time, like toggles, counts, filters, and forms.

```tsx
import React, { useState } from "@nrbx/react";

function ToggleButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <textbutton Text={isOpen ? "Close" : "Open"} onClick={() => setIsOpen(!isOpen)} />
      {isOpen ? <frame Size={new UDim2(0, 240, 0, 120)} /> : null}
    </>
  );
}
```

The setter can be called with a new value:

```tsx
const [coins, setCoins] = useState(0);
setCoins(5);
```

### Lazy initializers

If the initial value is expensive to compute, use a function instead of running the calculation every render.

```tsx
const [inventory, setInventory] = useState(() => {
  return loadInventoryFromServer();
});
```

This function runs only on the first render, not on every re-render.

### State updates trigger re-renders

When a state value changes, React schedules a new render for that component.

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <>
      <textlabel Text={`Count: ${count}`} />
      <textbutton Text="Increment" onClick={() => setCount(count + 1)} />
    </>
  );
}
```

### Batching

React batches multiple state updates that happen in the same event or callback. This means several calls to setters can be processed together before the UI is painted.

```tsx
function Rewards() {
  const [coins, setCoins] = useState(0);
  const [gems, setGems] = useState(0);

  const claimReward = () => {
    setCoins(coins + 10);
    setGems(gems + 2);
  };

  return (
    <>
      <textlabel Text={`Coins: ${coins}`} />
      <textlabel Text={`Gems: ${gems}`} />
      <textbutton Text="Claim" onClick={claimReward} />
    </>
  );
}
```

These updates are batched in the same callback, so the component usually renders once.

### Object/array state and immutability

State values that are objects or arrays should be replaced with new references instead of mutated in place.

```tsx
const [profile, setProfile] = useState({ name: "Ari", level: 18 });

setProfile({ ...profile, level: 19 });

const [inventory, setInventory] = useState<string[]>([]);
setInventory([...inventory, "Sword"]);
```

This is important because React determines whether it needs to re-render based on reference changes. If you mutate an array or object in place, React may not notice the change correctly.

### `setState(newValue)` replaces state

Unlike class-based `setState`, the hook setter replaces the old state value rather than shallow-merging it.

```tsx
const [settings, setSettings] = useState({ volume: 50, music: true });

setSettings({ ...settings, music: false });
```

If you want to update only one property, create a new object with the previous values and the changed field.

> Important caveat: The Lua runtime may not support functional state updates such as `setState(prev => prev + 1)`. Prefer direct values or refs instead of relying on the updater form. For example, use `setCount(count + 1)` or keep a `useRef` when you need to track a previous value without triggering a render.

## `useReducer`

`useReducer` is useful when your state logic becomes more complex than a few values. It follows the reducer pattern:

```tsx
(state, action) => nextState
```

This is especially nice for game UI, inventory flows, and input forms with many distinct actions.

```tsx
import React, { useReducer } from "@nrbx/react";

interface GameState {
  health: number;
  shield: number;
}

interface Action {
  type: "damage" | "heal" | "reset";
  amount?: number;
}

function initState(): GameState {
  return { health: 100, shield: 25 };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "damage":
      return {
        ...state,
        health: Math.max(0, state.health - (action.amount ?? 0)),
      };
    case "heal":
      return {
        ...state,
        health: Math.min(100, state.health + (action.amount ?? 0)),
      };
    case "reset":
      return initState();
    default:
      return state;
  }
}

function PlayerHud() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  return (
    <>
      <textlabel Text={`Health: ${state.health}`} />
      <textlabel Text={`Shield: ${state.shield}`} />
      <textbutton Text="Take Damage" onClick={() => dispatch({ type: "damage", amount: 10 })} />
      <textbutton Text="Heal" onClick={() => dispatch({ type: "heal", amount: 15 })} />
    </>
  );
}
```

Reducer patterns keep state transitions predictable and easy to test. They are especially helpful when multiple state values need to change together.

### Lazy initialization with `init`

The third argument to `useReducer` is a lazy initializer. It lets you derive the initial state without doing extra work each render.

```tsx
const [state, dispatch] = useReducer(reducer, initialArg, init);
```

This is useful for loading saved progress or generating default values based on some outside source.

## `useRef`

`useRef` creates a mutable object whose `.current` property persists across renders without causing a re-render when it changes.

```tsx
import React, { useEffect, useRef } from "@nrbx/react";

function FocusField() {
  const inputRef = useRef<TextBox>();

  useEffect(() => {
    inputRef.current?.CaptureFocus();
  }, []);

  return <textbox Ref={inputRef} PlaceholderText="Type here" />;
}
```

A `ref` is ideal for:

- Roblox instance references (`TextBox`, `Frame`, `ImageButton`)
- Timers
- Previous values
- Imperative calls that should not trigger re-renders

The hook's signature is:

```tsx
const value = useRef<T>(initialValue);
// value.current
```

Example with previous value tracking:

```tsx
function HealthBar() {
  const [health, setHealth] = useState(100);
  const previousHealth = useRef(health);

  useEffect(() => {
    if (health !== previousHealth.current) {
      print(`Health changed from ${previousHealth.current} to ${health}`);
      previousHealth.current = health;
    }
  }, [health]);

  return <textbutton Text="Damage" onClick={() => setHealth(health - 10)} />;
}
```

This pattern is useful when you need to compare the current value to the previous render without storing it in normal state.

## Data Flow

React follows a single direction of data flow: parent to child via props.

### Unidirectional flow

A child component receives data from the parent, renders based on it, and communicates back through callbacks.

```tsx
interface ItemRowProps {
  item: string;
  onRemove: (item: string) => void;
}

function ItemRow({ item, onRemove }: ItemRowProps) {
  return (
    <frame>
      <textlabel Text={item} />
      <textbutton Text="Remove" onClick={() => onRemove(item)} />
    </frame>
  );
}

function InventoryList() {
  const [items, setItems] = useState(["Sword", "Pickaxe", "Potion"]);

  const removeItem = (item: string) => {
    setItems(items.filter((current) => current !== item));
  };

  return (
    <>
      {items.map((item) => (
        <ItemRow key={item} item={item} onRemove={removeItem} />
      ))}
    </>
  );
}
```

This pattern is the heart of React: props for input, callbacks for output.

### Lift state up

If two sibling components need to share the same data, the state should live in their closest common parent.

```tsx
function TeamPanel() {
  const [selectedPlayer, setSelectedPlayer] = useState("Ari");

  return (
    <>
      <PlayerList selectedPlayer={selectedPlayer} onSelect={setSelectedPlayer} />
      <PlayerDetails selectedPlayer={selectedPlayer} />
    </>
  );
}
```

This keeps the data source consistent instead of duplicating state in multiple places.

### Context for deep prop drilling

When props have to pass through many layers, use context instead.

```tsx
import React, { createContext, useContext } from "@nrbx/react";

const ThemeContext = createContext({ accent: Color3.fromRGB(70, 130, 255) });

function ThemedButton() {
  const theme = useContext(ThemeContext);
  return <textbutton Text="Play" BackgroundColor3={theme.accent} />;
}
```

Context is helpful for shared app state such as theme, localization, or a Roblox service locator.

## Immutability

React depends on immutable updates. Never mutate state directly.

### Objects

```tsx
const [options, setOptions] = useState({ sound: true, music: true });

setOptions({ ...options, sound: false });
```

### Arrays

Use non-mutating operations instead of `push`, `splice`, or direct mutation.

```tsx
const [items, setItems] = useState<string[]>(["A", "B"]);

setItems(items.concat("C"));
setItems(items.filter((item) => item !== "A"));
setItems(items.map((item) => (item === "B" ? "C" : item)));
```

This matters because React compares references. New objects and arrays signal that an update happened; mutated ones can confuse reconciliation and stale rendering logic.

## Performance

React performance is about avoiding unnecessary work while keeping code easy to understand.

### `React.memo`

`React.memo` prevents a component from re-rendering when its props have not changed.

```tsx
const PlayerStat = React.memo(function PlayerStat({ name, score }: { name: string; score: number }) {
  return <textlabel Text={`${name}: ${score}`} />;
});
```

This is useful for static or mostly-static UI rows, especially inside large lists.

### `useMemo`

`useMemo` memoizes expensive derived values.

```tsx
const sortedScores = useMemo(() => {
  return [...scores].sort((a, b) => b - a);
}, [scores]);
```

Use it for expensive calculations, but do not overuse it for tiny values or anything that is simpler to compute inline.

### `useCallback`

`useCallback` keeps a function reference stable when its dependencies do not change.

```tsx
const handleSelect = useCallback((playerId: string) => {
  setSelectedPlayer(playerId);
}, [setSelectedPlayer]);
```

This helps when passing handlers into memoized child components.

### `PureComponent`

Class components can extend `PureComponent` to avoid re-rendering when props and state are shallow-equal.

```tsx
class InventoryCard extends React.PureComponent<{
  itemName: string;
  quantity: number;
}> {
  render() {
    return <textlabel Text={`${this.props.itemName}: ${this.props.quantity}`} />;
  }
}
```

This is the class-based equivalent of memoization.

## Common Patterns

### Controlled vs uncontrolled components

A controlled component stores its value in state. An uncontrolled component stores it in a ref or in the Roblox instance itself.

```tsx
function SearchBox() {
  const [query, setQuery] = useState("");

  return (
    <textbox
      Text={query}
      PlaceholderText="Search players"
      onTextChanged={(text) => setQuery(text)}
    />
  );
}
```

For uncontrolled inputs, read the value directly from a ref when needed:

```tsx
function UncontrolledSearchBox() {
  const inputRef = useRef<TextBox>();

  const submit = () => {
    print(inputRef.current?.Text);
  };

  return <textbox Ref={inputRef} />;
}
```

### Derived state

Do not duplicate state if it can be derived from props or other data.

```tsx
const visiblePlayers = useMemo(() => {
  return players.filter((player) => player.name.includes(search));
}, [players, search]);
```

Instead of keeping a separate `visiblePlayers` state that you manually sync, compute it from the source data.

### Resetting state with `key`

When you want a component to reset its local state, change its `key` prop. This remounts the component and reinitializes state.

```tsx
function CharacterScreen({ selectedCharacterId }: { selectedCharacterId: string }) {
  return (
    <CharacterEditor key={selectedCharacterId} characterId={selectedCharacterId} />
  );
}
```

This is useful for forms, wizard steps, and game screens that should start fresh when the user switches context.

### Previous value tracking with `useRef`

Sometimes you need to know what a value was before the latest render without storing it in state.

```tsx
function ScoreTicker() {
  const [score, setScore] = useState(0);
  const prevScore = useRef(0);

  useEffect(() => {
    if (score !== prevScore.current) {
      print(`Score changed from ${prevScore.current} to ${score}`);
      prevScore.current = score;
    }
  }, [score]);

  return <textbutton Text="+1" onClick={() => setScore(score + 1)} />;
}
```

This pattern is common for analytics, animation triggers, and UI transitions.

## Summary

Props and state are the foundation of component-driven UI in `@nrbx/react`:

- Props are read-only values flowing down from parents.
- State is local mutable data owned by a component.
- State changes trigger re-renders.
- Reducers help when state becomes complex.
- Refs are for mutable values that should not trigger re-renders.
- Immutability keeps updates predictable and React-friendly.
- Memoization helps performance when props or computations are expensive.

In Roblox development, these patterns map naturally to UI composition: player data as props, inventory or form state as state, refs for instance access, and callbacks for child-to-parent communication.

Once you understand this flow, building complex Roblox interfaces with `@nrbx/react` becomes much more predictable and easier to maintain.
