# Arbitrary values

The resolver also supports bracket-style arbitrary values for more direct, one-off styling.

### Hex colors

```tsx
<frame className="bg-[#FF0000] border-[#00FF00] text-[#0000FF]" />
```

### RGB and RGBA colors

```tsx
<textlabel className="text-[rgb(255,0,0)]" />
<textlabel className="text-[rgba(255,255,255,0.5)]" />
```

The `rgba(...)` case is especially useful for transparency. The parser maps it to a Roblox `TextTransparency` value:

```tsx
<textlabel className="text-[rgba(255,255,255,0.5)]" Text="semi-transparent white" />
```

This effectively behaves like:

```tsx
{
  TextColor3: Color3.fromRGB(255, 255, 255),
  TextTransparency: 0.5,
}
```

### Pixel lengths

```tsx
<frame className="w-[150px] h-[42px] p-[12px] rounded-[12px] gap-[10px]" />
```

You can also use arbitrary values for more specific sizing and spacing:

```tsx
<frame className="w-[320px] h-[200px] px-[24px] py-[16px]" />
```

### Gradients with arbitrary values

```tsx
<frame className="bg-gradient-to-r from-[#FF0000] via-[#00FF00] to-[#0000FF]" />
<frame className="bg-gradient-[linear-gradient(90deg,#FF0000,#00FF00,#0000FF)]" />
```

This is resolved into a Roblox `UIGradient` child, with the direction chosen from the gradient utility you used.

---

[← Hover-Variants](Hover-Variants) · [Configuration →](Configuration)
