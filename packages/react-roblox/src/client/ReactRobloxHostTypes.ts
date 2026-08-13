/**
 * `react-roblox` host types — Type definitions for the Roblox host environment.
 *
 * These types mirror the React DOM / React Native host config types but are
 * specialised for the Roblox instance model:
 *
 * - `Container` is any Roblox `Instance` (e.g. a `ScreenGui`, `Frame`, etc.)
 * - `HostInstance` is a Roblox `Instance` used as a React host node
 * - `TextInstance` is a Roblox `Instance` representing a text node
 * - `RootType` is the object returned by `createRoot()`
 *
 * @see ReactDOMHostConfig.js (upstream)
 * @see ReactNativeHostConfig.js (upstream)
 *
 * @module ReactRobloxHostTypes
 */

type MutableSource<_T> = any;

/** List of React child nodes (shared with the reconciler). */
import type { ReactNodeList } from '@nrbx/react-shared';

export type { ReactNodeList };

/**
 * A Roblox instance that can serve as a React container (mount point).
 * In Roblox this is any `Instance` — `ScreenGui`, `Frame`, etc.
 */
export type Container = Instance;

/**
 * A Roblox instance that serves as a host node (element in the tree).
 */
export type HostInstance = Instance;

/**
 * A Roblox instance representing a text node in React's tree.
 */
export type TextInstance = Instance;

/**
 * Suspense boundary placeholder instance.
 *
 * @todo Revisit when Suspense is fully supported on Roblox.
 */
export type SuspenseInstance = any;

/** The Roblox class name string used to create an element (e.g. `"Frame"`, `"TextLabel"`). */
export type Type = string;

/** Props that the host config may receive. */
export type Props = Record<string, unknown>;

/**
 * Instance that supports hydration.
 *
 * @todo Revisit when hydration is supported.
 */
export type HydratableInstance = Instance | SuspenseInstance;

/** Public instance exposed to user code. */
export type PublicInstance = HostInstance;

/** Internal host context (passed through the reconciler). */
export type HostContext = Record<string, unknown>;

/**
 * Object returned by `createRoot()`. Provides `render()` and `unmount()`.
 */
export type RootType = {
	render: (children: ReactNodeList) => void;
	unmount: () => void;
	_internalRoot: unknown;
};

/** Options passed to `createRoot()`. */
export type RootOptions = {
	hydrate?: boolean;
	hydrationOptions?: {
		onHydrated?: (suspenseNode: unknown) => (() => void) | undefined;
		onDeleted?: (suspenseNode: unknown) => (() => void) | undefined;
		mutableSources?: MutableSource<unknown>[];
	};
};
