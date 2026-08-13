/**
 * Configured reconciler for `@nrbx/react-roblox`.
 *
 * The reconciler is renderer-agnostic: it ships with a host-config table full
 * of no-op defaults. A renderer calls {@link initialize} once with its own host
 * config implementations, which get spliced into that shared table and turn the
 * no-ops into real Roblox instance operations.
 *
 * This module exists so the initialization happens exactly once, at module-load
 * time, and every other module in this package can import the same configured
 * reconciler without worrying about load order.
 *
 * Ported from `react-lua/modules/react-roblox/src/client/init.lua`, where the
 * equivalent was the `ReactReconciler.roblox` config-injecting entry point.
 *
 * @module ReactRobloxReconciler
 * @internal
 * @packageDocumentation
 */

import { initialize } from '@nrbx/react-reconciler';
import * as HostConfig from './ReactRobloxHostConfig';

/**
 * The reconciler module with the Roblox host config installed.
 *
 * Named exports (`createContainer`, `updateContainer`, `flushSync`, …) sit
 * directly on this namespace. Constants such as `ReactWorkTags`,
 * `ReactTypeOfMode` and `ReactRootTags` live on the `default` export, matching
 * the shape returned by `initialize`.
 */
export const Reconciler = initialize(HostConfig as unknown as { [key: string]: defined });
