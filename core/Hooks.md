# Hooks API

`@nrbx/react` provides the full React 17 hook set, plus a React 19-style polyfill layer for modern hook APIs. It is designed for Roblox TypeScript and follows the same mental model as React, while acknowledging a few runtime caveats specific to the Lua-based Roblox environment.

> Important caveat: functional state updates such as `setState((prev) => prev + 1)` may not be fully supported by the underlying Lua runtime. When necessary, prefer refs or direct values instead of relying on the functional updater form.

## Core Hooks

### `useState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>]`

- Signature: `useState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>]`
- Description: Creates a state value and a setter for that value. The setter can be called with either a direct value or a state updater function when the runtime supports it.
- Example:

```tsx
const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <button
      Event={{ Activated: () => setCount(count + 1) }}
    >
      Count: {count}
    </button>
  );
};
```

- Roblox caveats:
  - Functional form like `setCount((prev) => prev + 1)` may not work reliably in the Lua runtime.
  - Prefer `setCount(count + 1)` or keep the next value in a ref if you need to derive it from stale values.

### `useEffect(effect: () => (void | (() => void)), deps?: Array<any>)`

- Signature: `useEffect(effect: () => (void | (() => void)), deps?: Array<any>)`
- Description: Runs after render and can optionally return a cleanup function for subscriptions, connections, or timers.
- Example:

```tsx
const PlayerStats = () => {
  const [health, setHealth] = useState(100);

  useEffect(() => {
    const connection = Players.LocalPlayer.CharacterAdded.Connect(() => {
      setHealth(100);
    });

    return () => connection.Disconnect();
  }, []);

  return <textlabel Text={`Health: ${health}`} />;
};
```

- Roblox caveats:
  - Use `Disconnect()` when you connect to Roblox events like `RunService.Heartbeat`, `CollectionService`, or `RemoteEvent` callbacks.
  - Keep dependency arrays minimal to avoid reconnecting on every render.

### `useContext<T>(context: Context<T>): T`

- Signature: `useContext<T>(context: Context<T>): T`
- Description: Reads the current value from the closest matching provider in the component tree.
- Example:

```tsx
const ThemeContext = createContext({ accent: Color3.fromRGB(64, 128, 255) });

const ThemedButton = () => {
  const theme = useContext(ThemeContext);

  return <textbutton Text="Click me" BackgroundColor3={theme.accent} />;
};
```

- Roblox caveats:
  - Context is useful for shared configuration, theming, and runtime services.
  - Keep provider trees shallow for easier debugging inside Roblox UI composition.

### `useReducer<R, I>(reducer, initialArg, init?)`

- Signature: `useReducer<R, I>(reducer, initialArg, init?)`
- Description: Manages more complex state transitions using a reducer function, similar to Redux-style updates.
- Example:

```tsx
interface State {
  count: number;
}

interface Action {
  type: "increment" | "decrement";
}

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 };
    case "decrement":
      return { count: state.count - 1 };
    default:
      return state;
  }
};

const Counter = () => {
  const [state, dispatch] = useReducer(reducer, { count: 0 });

  return (
    <>
      <textlabel Text={`Count: ${state.count}`} />
      <button Event={{ Activated: () => dispatch({ type: "increment" }) }}>+1</button>
    </>
  );
};
```

- Roblox caveats:
  - Reducers are ideal for typed game state that changes in response to discrete actions.
  - If your reducer logic depends on prior state in a callback, keep the action payload explicit and avoid hidden mutation.

### `useCallback<T>(fn: T, deps?: Array<any>): T`

- Signature: `useCallback<T>(fn: T, deps?: Array<any>): T`
- Description: Returns a memoized callback whose identity stays stable until the dependency list changes.
- Example:

```tsx
const ButtonRow = () => {
  const onPress = useCallback(() => {
    print("Pressed");
  }, []);

  return <button Event={{ Activated: onPress }}>Press</button>;
};
```

- Roblox caveats:
  - Use this for Roblox event handlers passed into UI elements to avoid unnecessary re-renders.
  - Keep deps accurate; stale closures are common in imperative game code.

### `useMemo<T>(factory: () => T, deps?: Array<any>): T`

- Signature: `useMemo<T>(factory: () => T, deps?: Array<any>): T`
- Description: Memoizes the result of a computed value and recomputes only when dependencies change.
- Example:

```tsx
const itemSummary = useMemo(() => {
  return `${count} items ready`;
}, [count]);
```

- Roblox caveats:
  - Useful for expensive derived values, but do not use it as a substitute for state.
  - If the derived result is small and cheap, plain expressions are usually clearer.

### `useRef<T>(initial?: T): MutableRefObject<T>`

- Signature: `useRef<T>(initial?: T): MutableRefObject<T>`
- Description: Creates a persistent ref that survives across renders without triggering re-renders when its `.current` value changes.
- Example:

```tsx
const textBoxRef = useRef<TextBox>();

const FocusInput = () => {
  useEffect(() => {
    textBoxRef.current?.CaptureFocus();
  }, []);

  return <textbox Ref={textBoxRef} />;
};
```

- Roblox caveats:
  - This is the standard way to access Roblox instances and persistent values from event handlers.
  - Use it when you need mutable state that should not trigger rendering.

### `useImperativeHandle(ref, createHandle, deps?)`

- Signature: `useImperativeHandle(ref, createHandle, deps?)`
- Description: Customizes the instance value exposed to a parent via a ref. Useful for forwarding a more ergonomic API.
- Example:

```tsx
interface InputHandle {
  focus: () => void;
}

const Input = forwardRef<InputHandle>((props, ref) => {
  const innerRef = useRef<TextBox>();

  useImperativeHandle(ref, () => ({
    focus: () => innerRef.current?.CaptureFocus(),
  }), []);

  return <textbox Ref={innerRef} />;
});
```

- Roblox caveats:
  - Roblox UI refs are often instance refs, so this hook is useful when constructing a cleaner public API around nested components.
  - Keep the handle object stable and avoid returning new objects on every render unless dependencies change.

### `useLayoutEffect(effect, deps?)`

- Signature: `useLayoutEffect(effect, deps?)`
- Description: Runs synchronously after Roblox mutations and before the browser/graphics paint cycle completes. It behaves like `useEffect`, but with synchronous timing.
- Example:

```tsx
const Panel = () => {
  const ref = useRef<Frame>();

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.Size = UDim2.fromScale(0.5, 0.5);
    }
  }, []);

  return <frame Ref={ref} />;
};
```

- Roblox caveats:
  - Use this when measuring or mutating GUI layout immediately after a render.
  - Overusing it can lead to layout thrash; prefer `useEffect` for side effects that do not require synchronous DOM/GUI mutation timing.

### `useDebugValue(value, format?)`

- Signature: `useDebugValue(value, format?)`
- Description: Labels values in React DevTools for easier inspection during debugging.
- Example:

```tsx
const usePlayerState = (player: Player) => {
  const [ready, setReady] = useState(false);

  useDebugValue(ready ? "ready" : "waiting");

  return { ready, setReady };
};
```

- Roblox caveats:
  - This is mainly a debugging tool; it does not affect runtime behavior.
  - In Roblox tools or custom dev environments, use concise labels to keep logs readable.

## React 19 Polyfilled Hooks

### `useId(): string`

- Signature: `useId(): string`
- Description: Generates a stable, unique ID for a given component instance. Useful for ARIA-like attributes and form associations.
- Example:

```tsx
const fieldId = useId();

return <textbox Key={fieldId} />;
```

- Roblox caveats:
  - The ID is stable across re-renders, but not globally unique beyond the component instance.
  - Good for linking labels, inputs, and debug metadata in UI components.

### `useTransition(): [boolean, (callback: () => void) => void]`

- Signature: `useTransition(): [boolean, (callback: () => void) => void]`
- Description: Marks updates as low-priority transitions and provides a pending flag while the transition is in flight.
- Example:

```tsx
const [isPending, startTransition] = useTransition();

const onFilterChange = (nextQuery: string) => {
  startTransition(() => {
    setQuery(nextQuery);
  });
};
```

- Roblox caveats:
  - In Roblox, transition scheduling can be less meaningful than in web DOM, but it is still useful for deferring expensive UI updates.
  - Do not assume the callback runs synchronously; treat it as deferred work.

### `useDeferredValue<T>(value: T): T`

- Signature: `useDeferredValue<T>(value: T): T`
- Description: Returns a deferred version of a value that updates more slowly than the source value to keep the UI responsive.
- Example:

```tsx
const search = useDeferredValue(query);
```

- Roblox caveats:
  - Useful for large list filtering or expensive derived UI updates.
  - This should be considered a responsiveness aid, not a data store or game state synchronization tool.

### `useSyncExternalStore<T>(subscribe, getSnapshot, getServerSnapshot?): T`

- Signature: `useSyncExternalStore<T>(subscribe, getSnapshot, getServerSnapshot?): T`
- Description: Subscribes to an external data source and returns the current snapshot while keeping it in sync.
- Example:

```tsx
const health = useSyncExternalStore(
  (callback) => {
    const conn = RunService.Heartbeat.Connect(callback);
    return () => conn.Disconnect();
  },
  () => Players.LocalPlayer.Character?.PrimaryPart?.Position ?? Vector3.zero,
);
```

- Roblox caveats:
  - This is particularly useful for data that exists outside React state, such as Roblox services, player state, or custom store objects.
  - Always return a stable snapshot and clean up subscriptions.

### `useInsertionEffect(effect, deps?)`

- Signature: `useInsertionEffect(effect, deps?)`
- Description: Runs before layout effects and is intended for CSS-in-JS insertion timing.
- Example:

```tsx
useInsertionEffect(() => {
  print("Insert before layout work");
}, []);
```

- Roblox caveats:
  - In Roblox, there is no browser-style CSS insertion pipeline, so this hook is primarily a compatibility hook and may be equivalent to `useLayoutEffect` in practice.
  - Use it only when you specifically need the insertion phase semantics.

### `useOptimistic<T>(state: T, updateFn: (state: T, value: any) => T): [T, (value: any) => void]`

- Signature: `useOptimistic<T>(state: T, updateFn: (state: T, value: any) => T): [T, (value: any) => void]`
- Description: Lets a component optimistically update local UI before server confirmation arrives.
- Example:

```tsx
const [optimisticMessages, setOptimisticMessage] = useOptimistic(
  messages,
  (current, value) => [...current, value],
);

const onSend = () => {
  setOptimisticMessage({ id: "new", text: "Sending..." });
};
```

- Roblox caveats:
  - Useful for client-side responsiveness in UIs that communicate with remote services or datastore writes.
  - The optimistic state should be reconciled with the server result once the real data returns.

### `useActionState<S, P>(fn: (prevState: S, payload: P) => Promise<S>, initialState: S, permalink?: string): [S, (payload: P) => void, boolean]`

- Signature: `useActionState<S, P>(fn: (prevState: S, payload: P) => Promise<S>, initialState: S, permalink?: string): [S, (payload: P) => void, boolean]`
- Description: Tracks async state for form- or command-like actions, including a pending flag.
- Example:

```tsx
const [status, submit, isPending] = useActionState(
  async (prevState, payload: { message: string }) => {
    const result = await SendChatMessage(payload.message);
    return { ...prevState, lastMessage: result };
  },
  { lastMessage: "" },
);

const onSubmit = () => submit({ message: "Hello" });
```

- Roblox caveats:
  - This is most useful for async mutation workflows like chat, profile updates, or remote commands.
  - `isPending` is helpful for disabling buttons or showing loading state in the UI.

## Motion Hooks

### `useSpring(target, config?): Motion<number>`

- Signature: `useSpring(target, config?): Motion<number>`
- Description: Creates a spring-driven animation value that smoothly animates to the target value.
- Example:

```tsx
const x = useSpring(0, { type: "spring", tension: 180, friction: 12 });

useEffect(() => {
  x.set(100);
}, []);
```

- Roblox caveats:
  - This is useful for smooth UI interpolation, such as tweening a `Frame` position or a value used in layout calculations.
  - Use the motion object’s `set()` method to drive the value updates.

### `useMotion(target, config?): Motion<MotionValue>`

- Signature: `useMotion(target, config?): Motion<MotionValue>`
- Description: Animates multi-value objects, such as position, scale, or combined physical motion values.
- Example:

```tsx
const motion = useMotion({ x: 0, y: 0 }, {
  type: "spring",
  mass: 1,
  tension: 200,
  friction: 20,
});

useEffect(() => {
  motion.set({ x: 200, y: 120 });
}, []);
```

- Roblox caveats:
  - Use this for complex motion state, especially when working with multiple values in parallel.
  - Keep config values conservative if you are animating many objects simultaneously on low-end Roblox devices.

### `Motion`

- Signature: `Motion<T>`
- Description: A motion object that wraps a value and exposes methods for reading and updating it over time.
- Members:
  - `.current(alpha?)`: Reads the current motion value, optionally with interpolation alpha.
  - `.set(value)`: Sets the target value for the motion.
- Example:

```tsx
const value = useSpring(0);

const current = value.current();
value.set(50);
```

- Roblox caveats:
  - The `.current()` method is often used to read the current animation value for GUI layout or rendering.
  - Prefer `set()` over direct mutation for animation-driven values.

### `SpringConfig`

- Signature: `type SpringConfig = { type?: "spring"; mass?: number; tension?: number; friction?: number; velocity?: number; }`
- Description: Configuration used by spring-based motion. These values adjust stiffness, damping, and inertia.
- Example:

```tsx
const config: SpringConfig = {
  type: "spring",
  mass: 1,
  tension: 170,
  friction: 26,
  velocity: 0,
};
```

- Roblox caveats:
  - Tension and friction are the most important tuning knobs for smooth Roblox UI animation.
  - Avoid very high tension or very low friction when animating many GUI elements at once.

## Compiler Hook

### `useMemoCache(size: number): Array<any>`

- Signature: `useMemoCache(size: number): Array<any>`
- Description: Provides a fixed-size memory cache array for React Compiler (Forget) compatibility. It is primarily used by compiler-generated code paths.
- Example:

```tsx
const memoCache = useMemoCache(8);

memoCache[0] = expensiveComputation();
```

- Roblox caveats:
  - This hook is mainly for compiler integration and should not usually be used directly in handwritten component code.
  - If you are not targeting compiler-generated code, regular `useMemo` is the more idiomatic option.

## Notes for Roblox Development

- Prefer `useRef` for instance access and mutable values that should not trigger a render.
- Use `useEffect` and `useLayoutEffect` carefully for event connections and GUI layout updates.
- Be aware that the underlying runtime may not support every React 19 edge case exactly as the browser implementation does.
- Functional updates in `setState` are a known caveat; if the runtime does not support them consistently, store the next value explicitly or use refs.
- For animations, `useSpring` and `useMotion` are designed to keep Roblox UI motion smooth while minimizing manual tween boilerplate.

This page covers the primary hooks available in `@nrbx/react`. For more details about provider patterns, lifecycle behavior, and Roblox UI composition, see the rest of the package documentation.
