# Advanced Topics

`@nrbx/react` is not just a JSX layer for Roblox UI — it gives you a practical React workflow for large, stateful apps. Once your UI grows beyond a few screens, patterns like scoped styling, render portals, hook composition, and performance-aware state become the difference between a smooth game UI and a laggy, hard-to-debug one.

This section is split into focused pages:

- [Portals](Portals) — render UI into a different Roblox instance target
- [Performance](Performance) — context splitting, memoization, and avoiding redraw churn
- [Custom Hooks](Custom-Hooks) — composing game lifecycle logic into reusable hooks
- [Roblox Patterns](Roblox-Patterns) — instance-first patterns for real Roblox projects
- [Testing](Testing) — testing instance behavior and hook output
- [Custom JSX Pragma](Custom-JSX-Pragma) — using your own element factory
- [Suspense Patterns](Suspense-Patterns) — data loading patterns with Suspense-like APIs
- [DevTools](DevTools) — inspecting and debugging your component tree

## Putting it together

The most effective Roblox React apps combine all of these ideas:

- design tokens via `defineConfig` and `configureStyles`
- scoped themes via `createStyleSystem`
- direct render targets with portals for overlays
- memoization and context splitting to prevent redraw churn
- small hooks for game lifecycle logic and repeated behaviors
- explicit cleanup to avoid leaked connections
- deliberate testing of instance behavior and hook output

If you keep those patterns in mind, your UI can remain fast, readable, and stable even as the game becomes more complex.

---

[Portals →](Portals)
