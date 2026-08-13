/**
 * `@nrbx/react-reconciler` entry point.
 *
 * The reconciler is renderer-agnostic. Rather than importing a concrete host
 * config, a renderer calls {@link initialize} with its host-config
 * implementations; those get spliced into the shared host-config table and the
 * configured reconciler module is returned.
 *
 * Ported from `react-lua/modules/react-reconciler/src/init.lua`.
 *
 * @module index
 * @internal
 * @packageDocumentation
 */

import HostConfig from './ReactFiberHostConfig';
import * as ReactFiberReconciler from './ReactFiberReconciler';

export type { Dispatcher, Fiber, FiberRoot, SuspenseHydrationCallbacks, UpdateQueue } from './types';
export type { RootTag } from './ReactRootTags';
export type { Instance, TextInstance, Container, HostContext } from './ReactFiberHostConfig';

/**
 * Splices the renderer's host-config implementations into the reconciler and
 * returns the configured reconciler API.
 *
 * @param config - Key/value table of host-config functions, as produced by the
 *   host renderer (e.g. `@nrbx/react-roblox`).
 * @returns The reconciler module with the host config installed.
 * @internal
 */
export function initialize(config: { [key: string]: defined }): typeof ReactFiberReconciler {
	for (const [name, implementation] of pairs(config as Record<string, defined>)) {
		(HostConfig as unknown as Record<string, defined>)[name] = implementation;
	}

	return ReactFiberReconciler;
}

export default initialize;
