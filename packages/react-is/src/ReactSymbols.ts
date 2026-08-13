/**
 * React symbol constants used by `react-is` for element type checking.
 *
 * These are the internal `$$typeof` values that React assigns to elements,
 * contexts, portals, fragments, and other special types.
 *
 * @module ReactSymbols
 */

/** Symbol for React elements (`<div />`, `<Component />`, etc.). */
export const REACT_ELEMENT_TYPE = 0xead4 as number;

/** Symbol for React context consumers (`<Context.Consumer />`). */
export const REACT_CONTEXT_TYPE = 0xead5 as number;

/** Symbol for React context providers (`<Context.Provider />`). */
export const REACT_PROVIDER_TYPE = 0xead6 as number;

/** Symbol for `React.forwardRef()` wrappers. */
export const REACT_FORWARD_REF_TYPE = 0xead7 as number;

/** Symbol for React fragments (`<>...</>` or `<Fragment />`). */
export const REACT_FRAGMENT_TYPE = 0xead8 as number;

/** Symbol for `React.lazy()` wrappers. */
export const REACT_LAZY_TYPE = 0xead9 as number;

/** Symbol for `React.memo()` wrappers. */
export const REACT_MEMO_TYPE = 0xeada as number;

/** Symbol for React portals (`React.createPortal()`). */
export const REACT_PORTAL_TYPE = 0xeadb as number;

/** Symbol for `<React.Profiler />`. */
export const REACT_PROFILER_TYPE = 0xeadc as number;

/** Symbol for `<React.StrictMode />`. */
export const REACT_STRICT_MODE_TYPE = 0xeadd as number;

/** Symbol for `<React.Suspense />`. */
export const REACT_SUSPENSE_TYPE = 0xeade as number;

/** Symbol for `<React.SuspenseList />`. */
export const REACT_SUSPENSE_LIST_TYPE = 0xeadf as number;

/** Symbol for React Bindings (Roblox-specific, from Roact). */
export const REACT_BINDING_TYPE = 0xeae0 as number;
