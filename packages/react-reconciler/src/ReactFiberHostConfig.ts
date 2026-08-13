/**
 * Host-config contract for the fiber reconciler.
 *
 * The reconciler is renderer-agnostic. At runtime a renderer (for us,
 * `@nrbx/react-roblox`) supplies the concrete implementations of these
 * functions through `initialize(config)`, which splices them into
 * {@link HostConfig}.
 *
 * **Why every access must be lazy.** roblox-ts hoists static imports to the top
 * of the emitted Lua, so the whole reconciler module graph is `require`d before
 * `initialize()` ever runs. Any module that snapshots a host-config function
 * into a `const` at load time would capture `undefined` and keep it forever.
 * For that reason every consumer reads {@link HostConfig} at call time — either
 * through a small forwarding function or an inline lookup — never at module
 * scope. Disabled codepaths (hydration, persistence, fundamental components,
 * test selectors) are simply never populated and are guarded by feature flags.
 *
 * Upstream: `packages/react-reconciler/src/ReactFiberHostConfig.js`
 *
 * @module ReactFiberHostConfig
 * @internal
 * @packageDocumentation
 */

export type Object = { [key: string]: defined };

export type Instance = Object;
export type HostInstance = Instance;
export type TextInstance = Instance;
export type Container = Object;
export type HostContext = Object;
export type SuspenseInstance = Object;
export type HydratableInstance = Instance | SuspenseInstance;
export type PublicInstance = HostInstance;

export type Type = string;
export type Props = Object;
export type ChildSet = {}; // void, unused
export type RendererInspectionConfig = Object;

import type { Fiber } from './types';

/** Opaque handle the renderer stashes on a fiber while mounting (the fiber itself). */
export type InternalInstanceHandle = Fiber;

/**
 * The complete set of host-config entries the reconciler may reach for.
 *
 * Entries marked optional cover feature-gated codepaths that the Roblox
 * renderer does not implement (hydration, persistence, fundamental
 * components, test selectors). They are never called because the matching
 * feature flag is off, but they must exist on the type so the reconciler can
 * reference them without casting.
 */
export interface HostConfigAPI {
	getRootHostContext(rootContainer: Container): HostContext;
	getChildHostContext(parentHostContext: HostContext, type: Type, rootContainerInstance: Container): HostContext;
	getPublicInstance(instance: Instance): PublicInstance;

	prepareForCommit(containerInfo: Container): unknown;
	resetAfterCommit(containerInfo: Container): void;
	beforeActiveInstanceBlur?(): void;
	afterActiveInstanceBlur?(): void;

	createInstance(
		type: Type,
		props: Props,
		rootContainerInstance: Container,
		hostContext: HostContext,
		internalInstanceHandle: InternalInstanceHandle
	): Instance;
	appendInitialChild(parent: Instance, child: Instance): void;
	finalizeInitialChildren(
		instance: Instance,
		type: Type,
		props: Props,
		rootContainer: Container,
		hostContext: HostContext
	): boolean;

	prepareUpdate(
		instance: Instance,
		type: Type,
		oldProps: Props,
		newProps: Props,
		rootContainer: Container,
		hostContext: HostContext
	): defined;
	shouldSetTextContent(type: Type, props: Props): boolean;
	createTextInstance(
		text: string,
		rootContainer: Container,
		hostContext: HostContext,
		internalInstanceHandle: InternalInstanceHandle
	): TextInstance;

	scheduleTimeout(fn: () => void, delay: number): defined;
	cancelTimeout(id: defined): void;

	commitMount(instance: Instance, type: Type, newProps: Props, internalInstanceHandle: InternalInstanceHandle): void;
	commitUpdate(
		instance: Instance,
		updatePayload: defined[],
		type: Type,
		oldProps: Props,
		newProps: Props,
		internalInstanceHandle: InternalInstanceHandle
	): void;
	appendChild(parent: Instance, child: Instance | TextInstance): void;
	appendChildToContainer(container: Container, child: Instance | TextInstance): void;
	insertBefore(parent: Instance, child: Instance | TextInstance, beforeChild: Instance | TextInstance): void;
	insertInContainerBefore(
		container: Container,
		child: Instance | TextInstance,
		beforeChild: Instance | TextInstance
	): void;
	removeChild(parent: Instance, child: Instance | TextInstance): void;
	removeChildFromContainer(container: Container, child: Instance | TextInstance): void;
	clearContainer(container: Container): void;
	preparePortalMount(containerInfo: Container): void;

	resetTextContent?(instance: Instance | Container): void;
	commitTextUpdate?(textInstance: TextInstance, oldText: string, newText: string): void;

	hideInstance?(instance: Instance): void;
	hideTextInstance?(textInstance: TextInstance): void;
	unhideInstance?(instance: Instance, props: Props): void;
	unhideTextInstance?(textInstance: TextInstance, text: string): void;

	createContainerChildSet?(container: Container): ChildSet;
	finalizeContainerChildren?(container: Container, newChildren: ChildSet): void;

	canHydrateInstance?(instance: Instance, type: Type, props: Props): Instance | undefined;
	canHydrateTextInstance?(instance: Instance, text: string): TextInstance | undefined;
	canHydrateSuspenseInstance?(instance: SuspenseInstance): SuspenseInstance | undefined;
	getFirstHydratableChild?(parentInstance: Container): HydratableInstance | undefined;
	getNextHydratableSibling?(instance: HydratableInstance): HydratableInstance | undefined;
	getNextHydratableInstanceAfterSuspenseInstance?(suspenseInstance: SuspenseInstance): HydratableInstance | undefined;
	hydrateInstance?(
		instance: Instance,
		type: Type,
		props: Props,
		rootContainerInstance: Container,
		hostContext: HostContext,
		internalInstanceHandle: InternalInstanceHandle
	): defined;
	hydrateTextInstance?(
		textInstance: TextInstance,
		text: string,
		internalInstanceHandle: InternalInstanceHandle
	): boolean;
	hydrateSuspenseInstance?(suspenseInstance: SuspenseInstance, internalInstanceHandle: InternalInstanceHandle): void;
	didNotMatchHydratedContainerTextInstance?(
		parentContainer: Container,
		textInstance: TextInstance,
		text: string
	): void;
	didNotMatchHydratedTextInstance?(
		parentType: Type,
		parentProps: Props,
		parentInstance: Instance,
		textInstance: TextInstance,
		text: string
	): void;
	isSuspenseInstancePending?(instance: SuspenseInstance): boolean;
	isSuspenseInstanceFallback?(instance: SuspenseInstance): boolean;
	registerSuspenseInstanceRetry?(instance: SuspenseInstance, callback: () => void): void;
	commitHydratedSuspenseInstance?(suspenseInstance: SuspenseInstance): void;
	clearSuspenseBoundary?(parentInstance: Instance, suspenseInstance: SuspenseInstance): void;
	clearSuspenseBoundaryFromContainer?(container: Container, suspenseInstance: SuspenseInstance): void;

	makeClientId?: () => unknown;

	noTimeout: defined;
	supportsMutation: boolean;
	supportsPersistence?: boolean;
	supportsHydration?: boolean;
	// Test selectors are disabled on Roblox; a renderer may opt in by setting
	// this to true (see ReactTestSelectors).
	supportsTestSelectors?: boolean;
	isPrimaryRenderer: boolean;
	warnsIfNotActing: boolean;
}

/**
 * The runtime table the renderer splices its host-config functions into via
 * `initialize()`. Typed as {@link HostConfigAPI}; read lazily (at call time)
 * only — see the module docs above for why.
 *
 * @internal
 */
const HostConfig = {} as HostConfigAPI;

export default HostConfig;
