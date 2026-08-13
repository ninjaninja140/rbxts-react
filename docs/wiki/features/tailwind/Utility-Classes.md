# Supported utility groups

The utility resolver includes a broad set of Tailwind-style classes for Roblox GUI work.

### Layout

```tsx
<frame className="flex flex-col flex-row hidden" />
```

Common layout classes:

- `flex`
- `flex-col`
- `flex-row`
- `hidden`

### Alignment

```tsx
<frame className="flex items-center items-start items-end justify-center justify-start justify-end justify-between" />
```

Common alignment classes:

- `items-center`, `items-start`, `items-end`
- `justify-center`, `justify-start`, `justify-end`, `justify-between`

### Spacing

```tsx
<frame className="p-4 px-6 py-3 pt-2 pr-4 pb-6 pl-5 m-4 mx-2 my-3 gap-3" />
```

Common spacing classes:

- `p-{n}`
- `px-{n}`, `py-{n}`
- `pt-{n}`, `pr-{n}`, `pb-{n}`, `pl-{n}`
- `m-{n}`, `mx-{n}`, `my-{n}`
- `gap-{n}`

### Sizing

```tsx
<frame className="w-32 h-16 w-full h-full w-screen h-screen" />
```

Common sizing classes:

- `w-{n}` and `h-{n}`
- `w-full`, `h-full`
- `w-screen`, `h-screen`

### Colors

```tsx
<textlabel className="bg-blue-500 text-red-400 text-white bg-gray-100" />
```

Common color classes:

- `bg-{color}-{shade}`
- `text-{color}-{shade}`
- Example: `bg-blue-500`, `text-gray-700`, `bg-red-100`

### Typography

```tsx
<textlabel className="text-sm text-lg text-xl font-bold font-normal italic text-left text-center text-right" />
```

Common typography classes:

- `text-{size}`
- `font-bold`, `font-normal`
- `italic`
- `text-left`, `text-center`, `text-right`

### Borders and corners

```tsx
<frame className="border border-2 border-blue-500 rounded rounded-lg rounded-full" />
```

Common border classes:

- `border`
- `border-{n}`
- `border-{color}-{shade}`
- `rounded`
- `rounded-{size}`

### Effects

```tsx
<frame className="opacity-50 z-10 shadow shadow-sm shadow-md shadow-lg" />
```

Common effect classes:

- `opacity-{n}`
- `z-{n}`
- `shadow`, `shadow-sm`, `shadow-md`, `shadow-lg`

### Transform and motion

```tsx
<frame className="scale-110 rotate-12 translate-x-4 translate-y-2 skew-x-6 skew-y-4 animate-pulse animate-spin animate-bounce motion-preset-slide-up motion-duration-500" />
```

Common transform and animation classes:

- `scale-{n}`
- `rotate-{n}`
- `translate-x-{n}`
- `translate-y-{n}`
- `skew-x-{n}`
- `skew-y-{n}`
- `animate-pulse`
- `animate-spin`
- `animate-bounce`
- `motion-preset-slide-up`
- `motion-duration-500`

Motion utilities are designed to be picked up by motion hooks and animation metadata; they are not traditional CSS animation declarations.

### Gradients

```tsx
<frame className="bg-gradient-to-r from-blue-500 via-cyan-400 to-green-500" />
```

Supported gradient patterns include:

- `bg-gradient-to-r`, `bg-gradient-to-l`, `bg-gradient-to-t`, `bg-gradient-to-b`
- `from-{color}`
- `via-{color}`
- `to-{color}`
- `gradient-direction` styles such as `bg-gradient-to-tr`

---

[← Overview](Overview) · [Hover-Variants →](Hover-Variants)
