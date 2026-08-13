/**
 * `react-roblox` root container management.
 *
 * This module mirrors the upstream React DOM `ReactDOMRoot.js` implementation:
 * it creates, renders, and unmounts React roots that own Roblox instance
 * subtrees.
 *
 * A **root** is the top-level mount point for a React tree.  Once you create a
 * root with `createRoot(container)`, you can call `root.render(<App />)` to
 * render your component tree into the target Roblox `Instance`.
 *
 * ## Quick Start
 *
 * ```ts
 * import { createRoot } from "@nrbx/react-roblox";
 *
 * const root = createRoot(screenGui);
 * root.render(<App />);
 * // Later, to tear everything down:
 * root.unmount();
 * ```
 *
 * @see https://github.com/facebook/react/blob/main/packages/react-dom/src/client/ReactDOMRoot.js
 *
 * @module ReactRobloxRoot
 * @packageDocumentation
 */

import type { Container, RootType, RootOptions } from './ReactRobloxHostTypes';
import { markContainerAsRoot, unmarkContainerAsRoot } from './ReactRobloxComponentTree';
import type { Fiber } from './ReactRobloxComponentTree';
import type { FiberRoot, Container as ReconcilerContainer, SuspenseHydrationCallbacks } from '@nrbx/react-reconciler';
import type { ReactNodeList } from '@nrbx/react-shared';

// Runtime dependencies — resolved via require() in the compiled Lua output

/**
 * The reconciler that creates and schedules work on the fiber tree.
 *
 * This is the configured `@nrbx/react-reconciler` namespace — see
 * {@link ./ReactRobloxReconciler}. Named exports (like `createContainer`) sit
 * directly on the namespace, while constants such as `ReactRootTags` live on
 * its `default` export.
 */
import { Reconciler as ReactFiberReconciler } from './ReactRobloxReconciler';

// Root creation internals

const { createContainer } = ReactFiberReconciler;
const ReactRootTags = ReactFiberReconciler.default.ReactRootTags;
const { BlockingRoot, ConcurrentRoot, LegacyRoot } = ReactRootTags;

/**
 * Internal factory that wires up the reconciler container and bookkeeping.
 *
 * @param container - The Roblox instance to own.
 * @param tag - The reconciler root tag (ConcurrentRoot, BlockingRoot, LegacyRoot).
 * @param options - Optional hydration config.
 * @returns The reconciler's internal root object.
 */
function createRootImpl(container: Container, tag: number, options?: RootOptions): FiberRoot {
	const hydrate = options?.hydrate === true;
	const hydrationCallbacks = options?.hydrationOptions as SuspenseHydrationCallbacks | undefined;
	const mutableSources = options?.hydrationOptions?.mutableSources as Array<unknown> | undefined;

	const root = createContainer(container as unknown as ReconcilerContainer, tag, hydrate, hydrationCallbacks);

	markContainerAsRoot(root.current as unknown as Fiber, container);

	// Hydration not yet implemented — mutableSources are a no-op for now
	// The runtime check below is intentionally elided until hydration support is added.
	void mutableSources;

	return root;
}

// Root factory — returns an object implementing RootType

/**
 * Returns `true` if the value can serve as a React root container.
 *
 * In Roblox this means any `Instance` — ScreenGui, Frame, etc.
 *
 * @param node - The value to inspect.
 */
export function isValidContainer(node: unknown): node is Container {
	return typeIs(node, 'Instance');
}

/**
 * Creates a new React root mounted on the given Roblox instance.
 *
 * The returned root object provides `.render()` and `.unmount()` methods.
 *
 * @param container - The Roblox instance to render into.
 * @param options - Optional root configuration.
 * @returns A React root with `.render()` and `.unmount()` methods.
 */
export function createRoot(container: Container, options?: RootOptions): RootType {
	assert(isValidContainer(container), 'createRoot(...): Target container is not a Roblox Instance.');
	return makeReactRobloxRoot(createRootImpl(container, ConcurrentRoot, options));
}

/**
 * Creates a blocking root — a legacy compatibility mode.
 *
 * In modern React (18+), blocking roots behave the same as concurrent roots
 * but disable some concurrent features. Prefer {@link createRoot} for new code.
 *
 * @param container - The Roblox instance to render into.
 * @param options - Optional root configuration.
 */
export function createBlockingRoot(container: Container, options?: RootOptions): RootType {
	assert(isValidContainer(container), 'createRoot(...): Target container is not a Roblox Instance.');
	return makeReactRobloxRoot(createRootImpl(container, BlockingRoot, options));
}

/**
 * Creates a legacy root — the pre-React 18 rendering mode.
 *
 * Legacy roots do not support concurrent features. Prefer {@link createRoot}
 * for new code unless you specifically need legacy behaviour.
 *
 * @param container - The Roblox instance to render into.
 * @param options - Optional root configuration.
 */
export function createLegacyRoot(container: Container, options?: RootOptions): RootType {
	return makeReactRobloxRoot(createRootImpl(container, LegacyRoot, options));
}

// Root implementation (function-based to avoid class-method restrictions)

/**
 * Factory that returns a RootType-compatible object.
 *
 * @internal
 * @param internalRoot - The reconciler's internal root.
 */
function makeReactRobloxRoot(internalRoot: FiberRoot): RootType {
	const root = {
		_internalRoot: internalRoot,

		render(children: ReactNodeList): void {
			ReactFiberReconciler.updateContainer(children, root._internalRoot, undefined);
		},

		unmount(): void {
			const container = root._internalRoot.containerInfo as Instance;

			ReactFiberReconciler.flushSync(() => {
				ReactFiberReconciler.updateContainer(undefined, root._internalRoot, undefined, () => {
					unmarkContainerAsRoot(container);
				});
			}, undefined);

			ReactFiberReconciler.flushPassiveEffects();
		},
	};

	return root;
}
