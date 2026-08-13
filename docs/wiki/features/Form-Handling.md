# Form Handling

`@nrbx/react` includes a custom form system for Roblox UI that mirrors React 19's form actions and form state APIs. It is designed to feel familiar to web React developers, while adapting to Roblox primitives such as `TextBox`, `TextButton`, `ScrollingFrame`, and `UIListLayout`.

Form handling in `@nrbx/react` is intentionally lightweight and explicit:

- `<form>` manages submission and form state
- Inputs collect values into a `FormData` object
- `action` drives React 19-style submit behavior
- `useFormStatus()` exposes pending state and submit metadata
- `useActionState()` manages server-like action state without a browser server
- `form.reset()` resets all fields in a form

This page documents the supported form primitives and the expected usage patterns.

---

## Form element

The `<form>` component wraps form controls and handles submission. It can receive either a React 19-style `action` prop or a classic `onSubmit` handler.

```tsx
function SearchForm() {
  return (
    <form
      action={async (formData: FormData) => {
        const query = formData.get("query");
        print("searching for:", query);
      }}
      onSubmit={(event) => {
        print("traditional submit handler");
      }}
    >
      <input name="query" type="search" placeholder="Search items" />
      <button type="submit">Search</button>
    </form>
  );
}
```

Supported form props:

- `action?: (formData: FormData) => void | Promise<void>`
- `onSubmit?: (event: FormEvent) => void`
- `method?: "get" | "post"`
- `name?: string`
- `className?: string`
- `children?: ReactNode`

When `action` is present, it is treated as the primary form action. `onSubmit` is still available for traditional event-driven logic.

Forms also support:

- `form.reset()` to clear field values
- submission state tracking via `useFormStatus()`
- synchronous read access to values through `FormData`

---

## Supported form components

### `<input>`

`<input>` maps to a Roblox `TextBox` for text-like values and supports the common web input types you would expect in a form.

Supported input types:

- `type="text"` (default)
- `type="number"`
- `type="password"`
- `type="search"`
- `type="checkbox"`
- `type="radio"`
- `type="color"`
- `type="date"`
- `type="range"`

```tsx
function ProfileForm() {
  return (
    <form>
      <input name="displayName" type="text" placeholder="Display name" />
      <input name="age" type="number" min={0} max={120} />
      <input name="password" type="password" placeholder="Password" />
      <input name="newsletter" type="checkbox" defaultChecked />
      <input name="theme" type="radio" value="dark" defaultChecked />
      <input name="accent" type="color" defaultValue="#3b82f6" />
      <input name="birthday" type="date" />
      <input name="volume" type="range" min={0} max={100} defaultValue={60} />
    </form>
  );
}
```

### `<textarea>`

`<textarea>` creates a multi-line text field and is useful for comments, bios, and longer payloads.

```tsx
function FeedbackForm() {
  return (
    <form>
      <textarea
        name="message"
        placeholder="Tell us what you think"
        defaultValue=""
      />
    </form>
  );
}
```

### `<select>` and `<option>`

`<select>` is a dropdown field and `<option>` renders as selectable entries in the underlying UI list. This is especially useful for enums, filters, and preference selectors.

```tsx
function TeamSelect() {
  return (
    <form>
      <label htmlFor="team">Team</label>
      <select name="team" defaultValue="blue">
        <option value="red">Red</option>
        <option value="blue">Blue</option>
        <option value="green">Green</option>
      </select>
    </form>
  );
}
```

Under the hood, the options map to Roblox UI items in the form's layout. The selected value is still read via `formData.get("team")`.

### `<label>`

`<label>` associates visible text with a specific input, making forms easier to understand and easier to use.

```tsx
function EmailField() {
  return (
    <label>
      <span>Email</span>
      <input name="email" type="text" placeholder="name@example.com" />
    </label>
  );
}
```

### `<fieldset>` and `<legend>`

`<fieldset>` groups related fields and `<legend>` provides a caption for the group.

```tsx
<form>
  <fieldset>
    <legend>Account</legend>
    <label>
      <span>Username</span>
      <input name="username" />
    </label>
    <label>
      <span>Password</span>
      <input name="password" type="password" />
    </label>
  </fieldset>
</form>
```

### `<button>`

Buttons are the main submission triggers. Use `type="submit"` for form submission and `type="reset"` for clearing the form.

```tsx
<form>
  <button type="reset">Clear</button>
  <button type="submit">Save</button>
</form>
```

---

## Controlled vs uncontrolled inputs

`@nrbx/react` supports both web-style patterns: controlled inputs with `value` + `onChange`, and uncontrolled inputs with `defaultValue`.

### Controlled inputs

Use controlled inputs when the value is derived from component state.

```tsx
function ControlledName() {
  const [name, setName] = useState("");

  return (
    <input
      name="name"
      value={name}
      onChange={(event) => {
        setName(event.target.value);
      }}
    />
  );
}
```

### Uncontrolled inputs

Use uncontrolled inputs when you want the Roblox form to manage its own value state until submission.

```tsx
function UncontrolledName() {
  return (
    <input
      name="name"
      defaultValue="Guest"
    />
  );
}
```

In practice, controlled inputs are best when you need validation or display while the user types. Uncontrolled inputs are simpler when you only need the final value on submit.

---

## Form actions (React 19 pattern)

The `action` prop accepts a function that receives a `FormData` instance. This mirrors the React 19 form action model and is the recommended pattern for complex submissions.

```tsx
function LoginForm() {
  const [state, submitAction, isPending] = useActionState(
    async (prevState, formData: FormData) => {
      const username = formData.get("username") as string;
      const password = formData.get("password") as string;

      if (!username || !password) {
        return { error: "All fields required" };
      }

      await Promise.delay(1);
      return { success: `Welcome, ${username}!` };
    },
    { error: undefined, success: undefined }
  );

  return (
    <form action={submitAction} className="flex flex-col gap-4 p-4">
      <label>
        <span className="text-sm">Username</span>
        <input name="username" placeholder="Enter username" />
      </label>
      <label>
        <span className="text-sm">Password</span>
        <input name="password" type="password" placeholder="Enter password" />
      </label>

      {state.error && <span className="text-red-500">{state.error}</span>}
      {state.success && <span className="text-green-500">{state.success}</span>}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={cn("bg-blue-500 text-white p-2 rounded", pending && "opacity-50")}
    >
      {pending ? "Submitting..." : "Login"}
    </button>
  );
}
```

This is the preferred pattern when you want to centralize validation, async processing, and completion state.

You can also use a plain `onSubmit` event handler for a more traditional imperative flow:

```tsx
function BasicForm() {
  return (
    <form
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        const email = formData.get("email");
        print("login request for:", email);
      }}
    >
      <input name="email" type="text" />
      <button type="submit">Continue</button>
    </form>
  );
}
```

---

## `useFormStatus()`

`useFormStatus()` reads the status of the nearest parent form and returns a small status object.

```tsx
const status = useFormStatus();
// {
//   pending: boolean,
//   data: FormData | null,
//   method: string,
//   action: string,
// }
```

Typical usage:

```tsx
function SaveButton() {
  const { pending, data } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}
```

This is useful for:

- disabling submit buttons while work is in progress
- showing loading indicators
- reading the last submitted `FormData`
- inspecting the `method` or action target associated with the form

---

## `useActionState()`

`useActionState(action, initialState)` is the recommended hook for stateful form submissions. It gives you a tuple similar to React 19's action state API:

```tsx
const [state, submitAction, isPending] = useActionState(
  async (previousState, formData) => {
    // validate and process
    return { ... }
  },
  initialState
);
```

The returned tuple is:

- `state`: the current action result
- `submitAction`: the function passed to the form `action` prop
- `isPending`: whether the current action is still running

Example:

```tsx
function SignupForm() {
  const [state, submitAction, isPending] = useActionState(
    async (prevState, formData: FormData) => {
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");

      if (!email || !password) {
        return { errors: ["Email and password are required."] };
      }

      await Promise.delay(0.5);
      return { success: `Signed up as ${email}` };
    },
    { errors: [], success: "" }
  );

  return (
    <form action={submitAction}>
      <input name="email" type="text" />
      <input name="password" type="password" />
      <button type="submit" disabled={isPending}>
        {isPending ? "Signing up..." : "Sign up"}
      </button>

      {state.errors?.length > 0 && (
        <ul>
          {state.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {state.success && <p>{state.success}</p>}
    </form>
  );
}
```

This is especially useful for forms that need structured success or error state after a submit.

---

## Form validation

Validation is implemented by your component logic. `@nrbx/react` does not enforce browser-style validation rules automatically; instead, you validate the values you receive in `FormData`.

```tsx
async function handleSubmit(formData: FormData) {
  const username = formData.get("username");
  const email = formData.get("email");

  if (typeof username !== "string" || username.trim().length < 3) {
    throw "Username must be at least 3 characters.";
  }

  if (typeof email !== "string" || !email.includes("@")) {
    throw "Please enter a valid email.";
  }

  print("validated:", username, email);
}
```

Common validation approaches:

- validate inside the `action` function
- validate in `onSubmit` before network work begins
- validate as the user types with controlled `value` + `onChange`
- display validation results using local component state

A typical pattern is to keep validation close to the action and render inline errors based on the returned state.

---

## `FormData` API

`FormData` is the main way to read values out of a form. The custom runtime supports the same core patterns you expect from web form handling.

```tsx
function handleLogin(formData: FormData) {
  const username = formData.get("username");
  const password = formData.get("password");
  const tags = formData.getAll("tag");

  for (const [key, value] of formData.entries()) {
    print(key, value);
  }

  if (typeof username !== "string") {
    return;
  }

  if (typeof password !== "string") {
    return;
  }

  print("username:", username);
  print("password length:", password.length);
  print("tags:", tags);
}
```

Common methods:

- `formData.get(key)` — returns the first matching value
- `formData.getAll(key)` — returns every value for a repeated key
- `formData.entries()` — iterates key/value pairs
- `formData.has(key)` — checks for a key
- `formData.set(key, value)` — updates a field value
- `formData.append(key, value)` — adds another value for a key

This is especially useful when working with checkboxes, radios, multi-selects, and repeated fields.

---

## Reset behavior

`form.reset()` clears the form's current values and restores default states.

```tsx
function ResettableForm() {
  const formRef = useRef<any>(null);

  return (
    <form ref={formRef}>
      <input name="username" defaultValue="Guest" />
      <textarea name="notes" defaultValue="Draft" />
      <button type="button" onClick={() => formRef.current?.reset()}>
        Reset form
      </button>
    </form>
  );
}
```

This is useful for forms where the user wants to discard edits or revert a draft after validation failure.

---

## Roblox-specific limitations

`@nrbx/react` aims to mirror the React 19 form model, but Roblox UI does not have a perfect browser DOM equivalent. Some browser-only capabilities are intentionally unavailable or only partially supported.

Current limitations and caveats:

- no file input support (`<input type="file">`)
- no `datetime-local` input
- no browser-native HTML validation engine
- no automatic network submission to a server
- no built-in browser form encoding beyond the custom `FormData` implementation
- `color`, `date`, and `range` inputs map to Roblox UI capabilities and may vary by runtime behavior
- unsupported HTML form semantics should be replaced with explicit component logic

In other words, the API is intentionally ergonomic, but validation, serialization, and submission behavior still live in your app code.

---

## Custom form field components

For larger UI systems, you will often want to build reusable form field wrappers.

```tsx
interface TextFieldProps {
  label: string;
  name: string;
  type?: "text" | "number" | "password" | "search";
  placeholder?: string;
  defaultValue?: string;
}

function TextField({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
}: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </label>
  );
}
```

Then use it like this:

```tsx
function AccountForm() {
  return (
    <form action={async (formData: FormData) => {
      print("account form submit:", formData.get("username"));
    }}>
      <TextField label="Username" name="username" placeholder="Choose a username" />
      <TextField label="Password" name="password" type="password" placeholder="••••••••" />
      <button type="submit">Create account</button>
    </form>
  );
}
```

This pattern is useful for building consistent, typed, reusable form libraries inside your Roblox UI app.

---

## Best practices

- Prefer `action` for React 19-style form submission flows
- Use `useActionState()` when you need a server-like success/error state
- Use `useFormStatus()` to disable or label the submit button while pending
- Validate in a single place, usually near the action or submit handler
- Use controlled inputs for validation-heavy or dynamic UI
- Use uncontrolled inputs for simpler forms or default-specified values
- Cast values from `FormData` carefully, especially for numbers and booleans

`@nrbx/react` keeps the mental model close to React 19 while adapting to Roblox's UI system, making it a natural fit for game UIs, admin panels, settings screens, and in-game forms.
