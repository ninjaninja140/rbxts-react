/**
 * `react-roblox` component tree bookkeeping.
 *
 * This module mirrors the React DOM and React Native component-tree helpers and
 * tracks the relationship between fibers and Roblox instances without mutating
 * the instances themselves.
 *
 * In the original Luau implementation, the tree is tracked with tables because
 * Roblox can’t attach arbitrary fields to `Instance` objects. In roblox-ts we
 * use `Map` objects instead, which provide the same bookkeeping semantics while
 * remaining compatible with the runtime constraints.
 *
 * @module ReactRobloxComponentTree
 */

import { Reconciler } from './ReactRobloxReconciler';

/**
 * Minimal Roblox host typings used by the component tree bookkeeping logic.
 */
type Container = Instance;
type HostInstance = Instance;
type TextInstance = Instance;
type SuspenseInstance = Instance;
type Props = Record<string, unknown>;

/**
 * React fiber representation used by the reconciler.
 *
 * This is intentionally minimal: only the fields touched by the component tree
 * bookkeeping logic are required here.
 */
export interface Fiber {
	tag: number;
	alternate?: Fiber;
	child?: Fiber;
	stateNode?: unknown;
	memoizedProps?: Props;
}

/**
 * A host node that can be mapped to a fiber.
 */
type FiberLookupTarget = HostInstance | SuspenseInstance | ReactScopeInstance;

/**
 * Runtime scope instance used by the renderer.
 */
type ReactScopeInstance = Record<string, unknown>;

type SuspenseLookup = (targetNode: Instance) => SuspenseInstance | undefined;

const containerToRoot = new Map<Container, Fiber>();
const instanceToFiber = new Map<FiberLookupTarget, Fiber>();
const instanceToProps = new Map<HostInstance | SuspenseInstance, Props>();

/**
 * Work-tag constants from the configured reconciler. These identify the type
 * of a fiber node (host component, text, root, suspense boundary, …).
 */
const ReactWorkTags = Reconciler.default.ReactWorkTags as Record<string, number>;

const HostComponent = ReactWorkTags.HostComponent;
const HostText = ReactWorkTags.HostText;
const HostRoot = ReactWorkTags.HostRoot;
const SuspenseComponent = ReactWorkTags.SuspenseComponent;

// Suspense-boundary *instance* tracking is a no-op in Roblox. The upstream DOM
// implementation walks comment nodes to find a suspense boundary's sentinel;
// Roblox has no equivalent, so this is intentionally left undefined. The
// closest-instance walk below handles that gracefully.
const getParentSuspenseInstance: SuspenseLookup | undefined = undefined;

const invariant = (condition: boolean, message: string): void => {
	if (!condition) {
		error(message);
	}
};

/**
 * Returns `true` if the fiber represents a host instance or suspense boundary.
 */
function isHostFiber(fiber: Fiber): boolean {
	return (
		fiber.tag === HostComponent ||
		fiber.tag === HostText ||
		fiber.tag === SuspenseComponent ||
		fiber.tag === HostRoot
	);
}

/**
 * Adds a mapping from a host instance to the fiber that owns it.
 *
 * The original Lua implementation stores this in a table keyed by the Roblox
 * instance.  We keep the same semantics with a `Map`, and rely on callers to
 * clear the entries when a host subtree unmounts.
 *
 * @param hostInst - The fiber that owns the host instance.
 * @param node - The Roblox instance that should map back to that fiber.
 */
export function precacheFiberNode(hostInst: Fiber, node: HostInstance | SuspenseInstance | ReactScopeInstance): void {
	instanceToFiber.set(node, hostInst);
}

/**
 * Removes the fiber mapping for a node and clears any cached props for it.
 *
 * @param node - The node whose fiber mapping is being invalidated.
 */
export function uncacheFiberNode(node: HostInstance | SuspenseInstance | ReactScopeInstance): void {
	instanceToFiber.delete(node);
	instanceToProps.delete(node as HostInstance | SuspenseInstance);
}

/**
 * Marks a Roblox container as the root of a React tree.
 *
 * This is similar to the DOM implementation's "is container root" bookkeeping.
 * In the original code this is tracked with a table keyed by the container.
 *
 * @param hostRoot - The fiber root for the container.
 * @param node - The root container instance.
 */
export function markContainerAsRoot(hostRoot: Fiber, node: Container): void {
	containerToRoot.set(node, hostRoot);
}

/**
 * Clears the root marker for a container.
 *
 * @param node - The root container instance to unmark.
 */
export function unmarkContainerAsRoot(node: Container): void {
	containerToRoot.delete(node);
}

/**
 * Returns `true` if the container has been marked as a React root.
 *
 * @param node - The container instance to inspect.
 * @returns `true` when the container is a root mount.
 */
export function isContainerMarkedAsRoot(node: Container): boolean {
	return containerToRoot.has(node);
}

/**
 * Given a Roblox node, return the closest host fiber ancestor.
 *
 * If the target node is part of a hydrated or not-yet-rendered subtree, this can
 * also return a Suspense or HostRoot fiber.  The implementation walks the parent
 * chain and tracks the cached instance lookups previously registered with
 * `precacheFiberNode()`.
 *
 * @param targetNode - The Roblox node to inspect.
 * @returns The closest known fiber instance, or `undefined` if no React fiber is
 *          associated with the node or its ancestors.
 */
export function getClosestInstanceFromNode(targetNode: Instance): Fiber | undefined {
	let currentTarget = targetNode;
	const directFiber = instanceToFiber.get(currentTarget as FiberLookupTarget);
	if (directFiber !== undefined) {
		return directFiber;
	}

	let parentNode = currentTarget.Parent;
	while (parentNode !== undefined) {
		const candidateFiber = instanceToFiber.get(parentNode as FiberLookupTarget);
		if (candidateFiber !== undefined) {
			const alternate = candidateFiber.alternate;
			if (candidateFiber.child !== undefined || (alternate !== undefined && alternate.child !== undefined)) {
				let suspenseInstance = getParentSuspenseInstance?.(currentTarget);
				while (suspenseInstance !== undefined) {
					const targetSuspenseInst = instanceToFiber.get(suspenseInstance as FiberLookupTarget);
					if (targetSuspenseInst !== undefined) {
						return targetSuspenseInst;
					}
					suspenseInstance = getParentSuspenseInstance?.(suspenseInstance as Instance);
				}
			}
			return candidateFiber;
		}

		currentTarget = parentNode;
		parentNode = currentTarget.Parent;
	}

	return undefined;
}

/**
 * Given a Roblox node, return the associated React fiber if one is cached.
 *
 * @param node - The Roblox instance whose fiber should be resolved.
 * @returns The fiber if it is a react-managed host/root/suspense node.
 */
export function getInstanceFromNode(node: Instance): Fiber | undefined {
	const containerFiber = containerToRoot.get(node as Container);
	if (containerFiber !== undefined) {
		return containerFiber;
	}

	const fiber = instanceToFiber.get(node as FiberLookupTarget);
	if (fiber === undefined) {
		return undefined;
	}

	if (isHostFiber(fiber)) {
		return fiber;
	}

	return undefined;
}

/**
 * Given a host fiber, return the corresponding Roblox instance.
 *
 * @param inst - The fiber to resolve to a host node.
 * @returns The corresponding instance.
 */
export function getNodeFromInstance(inst: Fiber): Instance | TextInstance {
	if (inst.tag === HostComponent || inst.tag === HostText) {
		const stateNode = inst.stateNode;
		if (stateNode !== undefined && typeIs(stateNode, 'Instance')) {
			return stateNode as Instance | TextInstance;
		}
	}

	invariant(false, 'getNodeFromInstance: Invalid argument.');
	error('getNodeFromInstance: Invalid argument.');
}

/**
 * Returns the current props associated with a node.
 *
 * @param node - The host or suspense instance whose props are tracked.
 * @returns The cached props object, or `undefined` if not found.
 */
export function getFiberCurrentPropsFromNode(node: Instance | TextInstance | SuspenseInstance): Props | undefined {
	return instanceToProps.get(node as HostInstance | SuspenseInstance);
}

/**
 * Updates the current props associated with a node.
 *
 * @param node - The host or suspense instance whose props should be updated.
 * @param props - The new props object.
 */
export function updateFiberProps(node: Instance | SuspenseInstance, props: Props): void {
	instanceToProps.set(node as HostInstance | SuspenseInstance, props);
}
