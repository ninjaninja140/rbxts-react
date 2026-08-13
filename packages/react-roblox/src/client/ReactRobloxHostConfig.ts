/**
 * `react-roblox` host configuration — the bridge between React's reconciler and
 * the Roblox instance model.
 *
 * Every React renderer needs a host config that tells the reconciler how to:
 *
 * - **Create** host instances (`createInstance` → `Instance.new(...)`)
 * - **Mutate** the tree (`appendChild`, `removeChild`, etc.)
 * - **Read/set** properties (`finalizeInitialChildren`, `commitUpdate`)
 * - **Schedule** work (`scheduleTimeout`, `cancelTimeout`)
 *
 * This is the equivalent of `ReactDOMHostConfig.js` (browser) and
 * `ReactNativeHostConfig.js`, specialised for Roblox.
 *
 * @see https://github.com/facebook/react/blob/main/packages/react-dom/src/client/ReactDOMHostConfig.js
 * @see https://github.com/facebook/react/blob/main/packages/react-native-renderer/src/ReactNativeHostConfig.js
 *
 * @module ReactRobloxHostConfig
 */

// Dependencies (runtime Lua modules — imported like Lua require() paths)

/**
 * The reconciler module that we'll feed this host config into.
 * In roblox-ts this is the compiled `ReactReconciler` Lua package.
 */
declare function require(module: string): Record<string, unknown>;

// Local module imports (same pattern as the Lua source)

// These will be resolved at runtime. In roblox-ts we use the same `require`
// pattern the Lua source uses, but we type them for TypeScript's benefit.
//
// We reference the compiled init.luau files which resolve to the package roots.

/** Callback type for `setTimeout`. */
type TimeoutCallback = () => void;

/**
 * `ReactGlobals` — the runtime global flags (__DEV__, __PROFILE__, etc.).
 */
declare const ReactGlobals: {
	__DEV__: boolean;
	__PROFILE__: boolean;
};

/**
 * Logging utility.
 */
declare const console: {
	error: (message: string, ...args: unknown[]) => void;
	warn: (message: string, ...args: unknown[]) => void;
};

/**
 * Component tree — maps fibers ↔ Roblox instances.
 */
declare const ReactRobloxComponentTree: {
	precacheFiberNode: (fiber: object, instance: Instance) => void;
	uncacheFiberNode: (instance: Instance) => void;
	updateFiberProps: (instance: Instance, props: Record<string, unknown>) => void;
};

/**
 * Component helpers — set initial props, diff props, update props, cleanup.
 */
declare const ReactRobloxComponent: {
	setInitialProperties: (
		domElement: Instance,
		tag: string,
		rawProps: Record<string, unknown>,
		rootContainerElement: Instance
	) => void;
	diffProperties: (
		domElement: Instance,
		type: string,
		oldProps: Record<string, unknown>,
		newProps: Record<string, unknown>,
		rootContainerInstance: Instance
	) => unknown[];
	updateProperties: (domElement: Instance, updatePayload: unknown[], lastProps: Record<string, unknown>) => void;
	cleanupHostComponent: (domElement: Instance) => void;
};

/**
 * Roblox host types (Container, HostInstance, etc.).
 */
declare const ReactRobloxHostTypes: {
	Container: unknown; // Instance
	HostInstance: unknown; // Instance
	SuspenseInstance: unknown;
	TextInstance: unknown;
	Props: unknown;
	Type: unknown;
	HostContext: unknown;
};

/** Access to `game:GetService("CollectionService")`. */
declare const CollectionService: {
	GetTags: (instance: Instance) => string[];
	AddTag: (instance: Instance, tag: string) => void;
	RemoveTag: (instance: Instance, tag: string) => void;
};

/**
 * Luau polyfill for setTimeout / clearTimeout.
 */
declare const setTimeout: (callback: () => void, ms: number) => number;
declare const clearTimeout: (id: number) => void;

// Unimplemented helper

const UNIMPLEMENTED_PREFIX = '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!';

function unimplemented(message: string): void {
	print(UNIMPLEMENTED_PREFIX);
	print(UNIMPLEMENTED_PREFIX);
	print(`UNIMPLEMENTED ERROR: ${message}`);
	throw `FIXME (roblox): ${message} is unimplemented`;
}

// React feature flags (from Shared)

const _enableCreateEventHandleAPI = false;

// Fiber → Instance cache maintenance

/**
 * Recursively uncache all fiber nodes under a given instance.
 * Uses `GetDescendants()` to walk the Roblox tree.
 */
function recursivelyUncacheFiberNode(node: Instance): void {
	// Guard against non-instance values (Luau type quirk)
	if (typeIs(node, 'Instance')) {
		ReactRobloxComponentTree.uncacheFiberNode(node);

		for (const child of node.GetDescendants()) {
			ReactRobloxComponentTree.uncacheFiberNode(child);
		}
	}
}

//  HOST CONFIG API
//
//  Every function below implements a required interface of the React
//  reconciler's host config.  See ReactFiberHostConfig for the full
//  contract.

//  Context

/**
 * Returns the host context for the root container.
 * In Roblox we simply return the container's ClassName.
 */
function getRootHostContext(rootContainerInstance: Instance): string {
	return rootContainerInstance.ClassName;
}

/**
 * Returns the host context for a child element.
 * In Roblox we pass through the parent context.
 */
function getChildHostContext(parentHostContext: string, _type: string, _rootContainerInstance: Instance): string {
	return parentHostContext;
}

/**
 * Returns the public-facing instance for a given internal instance.
 * In Roblox this is just the instance itself.
 */
function getPublicInstance(instance: Instance): Instance {
	return instance;
}

//  Preparation (before commit)

function prepareForCommit(_containerInfo: Instance): undefined {
	return undefined;
}

function beforeActiveInstanceBlur(): void {
	// Not applicable in Roblox
}

function afterActiveInstanceBlur(): void {
	// Not applicable in Roblox
}

function resetAfterCommit(_containerInfo: Instance): void {
	// Not applicable in Roblox
}

//  Instance creation

interface InternalInstanceHandle {
	key?: string;
	return_?: InternalInstanceHandle;
}

/**
 * Creates a new Roblox instance for a React host element.
 *
 * Sets the instance's Name to the fiber key (for debugging in Studio)
 * and precaches the fiber ↔ instance mapping.
 */
function createInstance(
	type_: string,
	props: Record<string, unknown>,
	_rootContainerInstance: Instance,
	_hostContext: string,
	internalInstanceHandle: InternalInstanceHandle
): Instance {
	const domElement = new Instance(type_ as keyof CreatableInstances);

	// Name the instance after the fiber key for Studio readability
	if (internalInstanceHandle.key) {
		domElement.Name = internalInstanceHandle.key;
	} else {
		let currentHandle = internalInstanceHandle.return_;
		while (currentHandle) {
			if (currentHandle.key) {
				domElement.Name = currentHandle.key;
				break;
			}
			currentHandle = currentHandle.return_;
		}
	}

	ReactRobloxComponentTree.precacheFiberNode(internalInstanceHandle as Record<string, unknown>, domElement);
	ReactRobloxComponentTree.updateFiberProps(domElement, props);

	return domElement;
}

/**
 * Sets the parent of a child instance.
 */
function appendInitialChild(parentInstance: Instance, child: Instance): void {
	child.Parent = parentInstance;
}

/**
 * Applies initial properties to a newly created instance.
 * Returns `false` — Roblox doesn't have autoFocus.
 */
function finalizeInitialChildren(
	domElement: Instance,
	type_: string,
	props: Record<string, unknown>,
	rootContainerInstance: Instance,
	_hostContext: string
): boolean {
	ReactRobloxComponent.setInitialProperties(domElement, type_, props, rootContainerInstance);
	return false;
}

//  Update preparation

/**
 * Diffs old and new props, returning an update payload for `commitUpdate`.
 */
function prepareUpdate(
	domElement: Instance,
	type_: string,
	oldProps: Record<string, unknown>,
	newProps: Record<string, unknown>,
	rootContainerInstance: Instance,
	_hostContext: string
): unknown[] | undefined {
	return ReactRobloxComponent.diffProperties(domElement, type_, oldProps, newProps, rootContainerInstance);
}

/**
 * Returns `false` — Roblox doesn't have `textContent`.
 */
function shouldSetTextContent(_type: string, _props: Record<string, unknown>): boolean {
	return false;
}

/**
 * Not supported — Roblox doesn't have standalone text nodes.
 */
function createTextInstance(
	_text: string,
	_rootContainerInstance: Instance,
	_hostContext: string,
	_internalInstanceHandle: object
): undefined {
	unimplemented('createTextInstance');
	return undefined;
}

//  Timeout scheduling

function scheduleTimeout(callback: TimeoutCallback, delay: number): number {
	return setTimeout(callback, delay);
}

function cancelTimeout(id: number): void {
	clearTimeout(id);
}

const NO_TIMEOUT = -1;

//  Mutation — Tree operations

/**
 * Dev-only check that warns if tags are applied to orphaned instances.
 */
function checkTags(instance: Instance): void {
	if (!typeIs(instance, 'Instance')) {
		console.warn('Could not check tags on non-instance.');
		return;
	}
	if (!instance.IsDescendantOf(game)) {
		if (CollectionService.GetTags(instance).size() > 0) {
			console.warn(
				`Tags applied to orphaned ${instance.ClassName} "${instance.Name}" cannot be accessed via ` +
					"CollectionService:GetTagged. If you're relying on tag behavior in a unit test, " +
					'consider mounting your test root into the DataModel.'
			);
		}
	}
}

function appendChild(parentInstance: Instance, child: Instance): void {
	child.Parent = parentInstance;
	if (ReactGlobals.__DEV__) {
		checkTags(child);
	}
}

function appendChildToContainer(container: Instance, child: Instance): void {
	appendChild(container, child);
}

function insertBefore(parentInstance: Instance, child: Instance, _beforeChild: Instance): void {
	child.Parent = parentInstance;
	if (ReactGlobals.__DEV__) {
		checkTags(child);
	}
}

function insertInContainerBefore(container: Instance, child: Instance, beforeChild: Instance): void {
	insertBefore(container, child, beforeChild);
}

function removeChild(_parentInstance: Instance, child: Instance): void {
	recursivelyUncacheFiberNode(child);
	ReactRobloxComponent.cleanupHostComponent(child);
	child.Parent = undefined;
	child.Destroy();
}

function removeChildFromContainer(container: Instance, child: Instance): void {
	removeChild(container, child);
}

//  Suspense (unimplemented)

function clearSuspenseBoundary(_parentInstance: Instance, _suspenseInstance: unknown): void {
	unimplemented('clearSuspenseBoundary');
}

function clearSuspenseBoundaryFromContainer(_container: Instance, _suspenseInstance: unknown): void {
	unimplemented('clearSuspenseBoundaryFromContainer');
}

//  Visibility toggling (unimplemented)

function hideInstance(_instance: Instance): void {
	unimplemented('hideInstance');
}

function hideTextInstance(_textInstance: Instance): void {
	unimplemented('hideTextInstance');
}

function unhideInstance(_instance: Instance, _props: Record<string, unknown>): void {
	unimplemented('unhideInstance');
}

function unhideTextInstance(_textInstance: Instance, _text: string): void {
	unimplemented('unhideTextInstance');
}

//  Container clearing

function clearContainer(container: Instance): void {
	for (const child of container.GetChildren()) {
		removeChild(container, child);
	}
}

//  Commit-phase mutation

function commitMount(
	_domElement: Instance,
	_type: string,
	_newProps: Record<string, unknown>,
	_internalInstanceHandle: object
): void {
	// Not applicable in Roblox (no autoFocus equivalent)
}

function commitUpdate(
	domElement: Instance,
	updatePayload: unknown[],
	_type_: string,
	oldProps: Record<string, unknown>,
	newProps: Record<string, unknown>,
	_internalInstanceHandle: object
): void {
	// Update the props handle so we know which props are the current ones
	ReactRobloxComponentTree.updateFiberProps(domElement, newProps);
	// Apply the diff to the Roblox instance
	ReactRobloxComponent.updateProperties(domElement, updatePayload, oldProps);
}

//  Detached fiber cleanup (Roblox addition)

/**
 * Recursively detaches fibers from an instance tree before it's destroyed.
 * This is a Roblox-specific memory safety measure.
 */
function detachDeletedInstance(node: Instance): void {
	recursivelyUncacheFiberNode(node);

	if (typeIs(node, 'Instance')) {
		for (const child of node.GetDescendants()) {
			recursivelyUncacheFiberNode(child);
		}
	}
}

//  EXPORTS — everything the reconciler expects from a host config

// The reconciler checks for `supportsMutation` to decide codepaths.
const supportsMutation = true;

// We are the primary (and only) renderer.
const isPrimaryRenderer = true;

// When true, `act()` will warn if no wrapping `act()` call is active.
const warnsIfNotActing = true;

// Note: In the Lua source, `Object.assign(exports, require(Packages.Shared).ReactFiberHostConfig.WithNoPersistence)`
// is called to merge all the default no-persistence implementations. We inline
// the relevant defaults here.

export {
	// Context
	getRootHostContext,
	getChildHostContext,
	getPublicInstance,
	// Preparation
	prepareForCommit,
	beforeActiveInstanceBlur,
	afterActiveInstanceBlur,
	resetAfterCommit,
	// Instance creation
	createInstance,
	appendInitialChild,
	finalizeInitialChildren,
	// Updates
	prepareUpdate,
	shouldSetTextContent,
	createTextInstance,
	scheduleTimeout,
	cancelTimeout,
	NO_TIMEOUT as noTimeout,
	// Mutation
	supportsMutation,
	isPrimaryRenderer,
	warnsIfNotActing,
	commitMount,
	commitUpdate,
	appendChild,
	appendChildToContainer,
	insertBefore,
	insertInContainerBefore,
	removeChild,
	removeChildFromContainer,
	clearSuspenseBoundary,
	clearSuspenseBoundaryFromContainer,
	hideInstance,
	hideTextInstance,
	unhideInstance,
	unhideTextInstance,
	clearContainer,
	// Roblox additions
	detachDeletedInstance,
};
