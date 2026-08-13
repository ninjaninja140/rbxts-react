/**
 * `react-roblox` host component helpers.
 *
 * This mirrors the host-side component logic from the ReactDOM implementation,
 * adapted for Roblox instances instead of DOM nodes. The implementation covers:
 *
 * - initial property application
 * - prop diffing between renders
 * - update payload application
 * - cleanup when an instance is unmounted
 * - controlled value restoration for Roblox input-like instances
 *
 * The port stays compatible with roblox-ts constraints:
 * - no `any`
 * - no `null`
 * - no variable names beginning with `$`
 * - runtime type checks use `typeIs()` rather than `typeof`
 *
 * @module ReactRobloxComponent
 */

import { getDefaultInstanceProperty } from './getDefaultInstanceProperty';
import { SingleEventManager } from './SingleEventManager';
import { DragResizeManager } from './DragResizeManager';
import type { HostInstance } from './ReactRobloxHostTypes';

declare const React: {
	__subscribeToBinding?: (binding: BindingLike, listener: (value: unknown) => void) => (() => void) | undefined;
};

declare const ReactGlobals: {
	__DEV__: boolean;
};

declare const console: {
	error: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
};

type PropsMap = Record<string, unknown>;
type UpdatePayload = Array<string | number | boolean | bigint | symbol | object>;

interface BindingLike {
	getValue(): unknown;
	_source?: string;
	$$typeof?: number;
	[key: string]: unknown;
}

const REACT_BINDING_TYPE = 0xeae0 as number;
/** Sentinel used in update payloads to indicate a property was removed. */
const PROPERTY_REMOVED = { __sentinel: 'PROPERTY_REMOVED' } as const;

const instanceToEventManager = new Map<Instance, SingleEventManager>();
const instanceToBindings = new Map<Instance, Map<string, () => void>>();
const instanceToDragResizeManager = new Map<Instance, DragResizeManager>();
const trackedValueNodes = new Map<Instance, Map<string, { value: unknown }>>();

/**
 * Returns `true` when the value is a Roblox binding object created by React.
 *
 * @param value - Value to inspect.
 * @returns `true` when a binding is detected.
 */
function isBindingValue(value: unknown): value is BindingLike {
	if (!typeIs(value, 'table')) {
		return false;
	}

	const tableValue = value as Record<string, unknown>;
	const typeofValue = tableValue.$$typeof as number | undefined;
	return typeofValue === REACT_BINDING_TYPE;
}

/**
 * Removes an existing binding subscription from an instance property.
 *
 * @param hostInstance - Roblox instance whose binding should be removed.
 * @param key - Property name associated with the binding.
 */
function removeBinding(hostInstance: Instance, key: string): void {
	const bindings = instanceToBindings.get(hostInstance);
	if (bindings === undefined) {
		return;
	}

	const disconnect = bindings.get(key);
	if (disconnect !== undefined) {
		disconnect();
	}
	bindings.delete(key);

	if (bindings.size() === 0) {
		instanceToBindings.delete(hostInstance);
	}
}

/**
 * Applies a property to a Roblox instance, resetting it to the default when the
 * value resolves to `undefined`.
 *
 * @param hostInstance - Target instance.
 * @param key - Property name.
 * @param nextValue - Value to apply.
 */
function setRobloxInstanceProperty(hostInstance: Instance, key: string, nextValue: unknown): void {
	const instanceRecord = hostInstance as unknown as Record<string, unknown>;

	if (nextValue === undefined) {
		const [resetSucceeded] = pcall(() => {
			hostInstance.ResetPropertyToDefault(key);
		});
		if (resetSucceeded) {
			return;
		}

		const [defaultSucceeded, defaultValue] = getDefaultInstanceProperty(hostInstance.ClassName, key);
		if (defaultSucceeded) {
			instanceRecord[key] = defaultValue;
			return;
		}
	}

	instanceRecord[key] = nextValue;
}

/**
 * Attaches a binding subscription and writes the current value into the target
 * Roblox instance property.
 *
 * @param hostInstance - Target instance.
 * @param key - Property key to bind.
 * @param binding - Roblox binding object.
 */
function attachBinding(hostInstance: Instance, key: string, binding: BindingLike): void {
	const updateBoundProperty = (newValue: unknown): void => {
		const [ok, errorResult] = xpcall(
			() => {
				setRobloxInstanceProperty(hostInstance, key, newValue);
			},
			(errorValue: unknown) => {
				const source = binding._source ?? '<enable DEV mode for stack>';
				const message = [
					`Error updating binding or ref assigned to key ${key} of '${hostInstance.Name}' (${hostInstance.ClassName}).`,
					'',
					'Updated value:',
					`  ${tostring(newValue)}`,
					'',
					'Error:',
					`  ${tostring(errorValue)}`,
					'',
					source,
				].join('\n');
				if (ReactGlobals.__DEV__) {
					console.error(message);
				}
				return message;
			}
		);

		if (!ok) {
			throw errorResult;
		}
	};

	let bindings = instanceToBindings.get(hostInstance);
	if (bindings === undefined) {
		bindings = new Map<string, () => void>();
		instanceToBindings.set(hostInstance, bindings);
	}

	const subscribeToBinding = React.__subscribeToBinding;
	if (subscribeToBinding !== undefined) {
		const disconnect = subscribeToBinding(binding, updateBoundProperty);
		if (disconnect !== undefined) {
			bindings.set(key, disconnect);
		}
	}

	updateBoundProperty(binding.getValue());
}

/**
 * Enables or disables the experimental `draggable` / `resizable` behavior on a
 * host instance. Only `GuiObject` instances support these props — anything
 * else is ignored.
 *
 * @param hostInstance - Target instance.
 * @param key - Either `"draggable"` or `"resizable"`.
 * @param enabled - Whether the behavior should be active.
 */
function applyDragResizeProp(hostInstance: Instance, key: 'draggable' | 'resizable', enabled: boolean): void {
	if (!hostInstance.IsA('GuiObject')) {
		return;
	}

	let manager = instanceToDragResizeManager.get(hostInstance);
	if (enabled) {
		if (manager === undefined) {
			manager = new DragResizeManager(hostInstance);
			instanceToDragResizeManager.set(hostInstance, manager);
		}
		if (key === 'draggable') {
			manager.setDraggable(true);
		} else {
			manager.setResizable(true);
		}
		return;
	}

	if (manager === undefined) {
		return;
	}

	if (key === 'draggable') {
		manager.setDraggable(false);
	} else {
		manager.setResizable(false);
	}

	if (!manager.isActive()) {
		manager.disconnect();
		instanceToDragResizeManager.delete(hostInstance);
	}
}

/**
 * Disconnects and removes any drag/resize manager bound to an instance.
 *
 * @param hostInstance - Instance to clean up.
 */
function cleanupDragResize(hostInstance: Instance): void {
	const manager = instanceToDragResizeManager.get(hostInstance);
	if (manager !== undefined) {
		manager.disconnect();
		instanceToDragResizeManager.delete(hostInstance);
	}
}

/**
 * Applies a single Roblox property update.
 *
 * @param hostInstance - Target instance.
 * @param key - Property or event key.
 * @param newValue - Value to apply.
 * @param oldValue - Previous value for diffing.
 */
function applyProp(hostInstance: Instance, key: string, newValue: unknown, oldValue: unknown): void {
	if (key === 'ref' || key === 'children' || key === 'key') {
		return;
	}

	if (key === 'draggable' || key === 'resizable') {
		applyDragResizeProp(hostInstance, key, newValue === true);
		return;
	}

	const eventDescriptor = key as unknown as Record<string, unknown>;
	if (typeIs(eventDescriptor, 'table') && typeOf(eventDescriptor.name) === 'string') {
		let eventManager = instanceToEventManager.get(hostInstance);
		if (eventManager === undefined) {
			eventManager = new SingleEventManager(hostInstance);
			instanceToEventManager.set(hostInstance, eventManager);
		}

		const eventName = eventDescriptor.name as string;
		const isChangeEvent = eventDescriptor.kind === 'change';
		if (isChangeEvent) {
			eventManager.connectPropertyChange(eventName, newValue as ((...args: unknown[]) => void) | undefined);
			return;
		}
		eventManager.connectEvent(eventName, newValue as ((...args: unknown[]) => void) | undefined);
		return;
	}

	if (oldValue !== undefined && isBindingValue(oldValue)) {
		removeBinding(hostInstance, key);
	}

	if (isBindingValue(newValue)) {
		attachBinding(hostInstance, key, newValue as BindingLike);
		return;
	}

	setRobloxInstanceProperty(hostInstance, key, newValue);
}

/**
 * Applies a set of props to a Roblox instance.
 *
 * @param hostInstance - Target instance.
 * @param props - Property map.
 */
function applyProps(hostInstance: Instance, props: PropsMap): void {
	for (const [key, value] of pairs(props)) {
		if (key === 'ref' || key === 'children' || key === 'key') {
			continue;
		}
		applyProp(hostInstance, key, value, undefined);
	}
}

/**
 * Applies the initial prop set to a host instance.
 *
 * @param domElement - Target Roblox instance.
 * @param _tag - Host tag string (unused by the Roblox renderer hook).
 * @param rawProps - Initial props to apply.
 * @param _rootContainerElement - Root container instance.
 */
export function setInitialProperties(
	domElement: HostInstance,
	_tag: string,
	rawProps: PropsMap,
	_rootContainerElement: HostInstance
): void {
	const [ok, errorMessage] = xpcall(
		() => {
			applyProps(domElement, rawProps);
		},
		(errorValue: unknown) => {
			const message = tostring(errorValue);
			if (ReactGlobals.__DEV__) {
				console.error(message);
			}
			return message;
		}
	);

	if (!ok) {
		throw `Error applying initial props to Roblox Instance '${domElement.Name}' (${domElement.ClassName}): ${tostring(errorMessage)}`;
	}

	const eventManager = instanceToEventManager.get(domElement);
	if (eventManager !== undefined) {
		eventManager.resume();
	}
}

/**
 * Produces a diff payload between the previous and next props object.
 *
 * Starts with a generic property comparison that emits `[key, value]` pairs for
 * changed keys and a sentinel for removed properties.
 *
 * @param domElement - Target instance.
 * @param _tag - Host tag string.
 * @param lastRawProps - Previous props.
 * @param nextRawProps - Next props.
 * @param _rootContainerElement - Root container instance.
 * @returns Array of update pairs or `undefined` when nothing changed.
 */
export function diffProperties(
	_domElement: HostInstance,
	_tag: string,
	lastRawProps: PropsMap,
	nextRawProps: PropsMap,
	_rootContainerElement: HostInstance
): UpdatePayload | undefined {
	const lastProps = lastRawProps;
	const nextProps = nextRawProps;
	let updatePayload: UpdatePayload | undefined;

	for (const [propKey] of pairs(lastProps)) {
		if (propKey === 'ref' || propKey === 'children' || propKey === 'key') {
			continue;
		}
		if (nextProps[propKey] === undefined) {
			if (updatePayload === undefined) {
				updatePayload = [];
			}
			// Bypass roblox-ts `this` constraint on Array.push for `unknown` elements
			const arr = updatePayload as defined[];
			arr.push(propKey as defined, PROPERTY_REMOVED as defined);
		}
	}

	for (const [propKey, nextPropValue] of pairs(nextProps)) {
		if (propKey === 'ref' || propKey === 'children' || propKey === 'key') {
			continue;
		}

		const nextProp = nextPropValue as string | number | boolean | bigint | symbol | object;
		const lastProp = lastProps[propKey] as string | number | boolean | bigint | symbol | object | undefined;
		if (nextProp === lastProp) {
			continue;
		}

		if (updatePayload === undefined) {
			updatePayload = [];
		}
		// Bypass roblox-ts `this` constraint on Array.push for `unknown` elements
		const arr = updatePayload as defined[];
		arr.push(propKey as defined, nextProp as defined);
	}

	return updatePayload;
}

/**
 * Safely applies an update payload to a host instance.
 *
 * @param hostInstance - Target instance.
 * @param updatePayload - Payload as `[key, value]` pairs.
 * @param lastProps - Last props for binding cleanup.
 */
function safelyApplyProperties(hostInstance: Instance, updatePayload: UpdatePayload, lastProps: PropsMap): void {
	for (let index = 0; index < updatePayload.size(); index += 2) {
		const propKey = updatePayload[index] as string;
		let value: string | number | boolean | bigint | symbol | object | undefined = updatePayload[index + 1];
		if (value === PROPERTY_REMOVED) {
			value = undefined;
		}
		if (propKey !== 'ref' && propKey !== 'children' && propKey !== 'key') {
			applyProp(hostInstance, propKey, value, lastProps[propKey]);
		}
	}
}

/**
 * Updates a Roblox instance using a previously diffed payload.
 *
 * @param domElement - Target instance.
 * @param updatePayload - Payload created by `diffProperties`.
 * @param lastProps - Previous props.
 */
export function updateProperties(domElement: HostInstance, updatePayload: UpdatePayload, lastProps: PropsMap): void {
	const eventManager = instanceToEventManager.get(domElement);
	if (eventManager !== undefined) {
		eventManager.suspend();
	}

	const [ok, errorMessage] = xpcall(
		() => {
			safelyApplyProperties(domElement, updatePayload, lastProps);
		},
		(errorValue: unknown) => {
			const message = tostring(errorValue);
			if (ReactGlobals.__DEV__) {
				console.error(message);
			}
			return message;
		}
	);

	if (!ok) {
		throw `Error updating props on Roblox Instance '${domElement.Name}' (${domElement.ClassName}): ${tostring(errorMessage)}`;
	}

	if (eventManager !== undefined) {
		eventManager.resume();
	}
}

/**
 * Cleans up internal bookkeeping for a host instance and its descendants.
 *
 * @param domElement - Instance being removed from the tree.
 */
export function cleanupHostComponent(domElement: HostInstance): void {
	instanceToEventManager.delete(domElement);
	instanceToBindings.delete(domElement);
	cleanupDragResize(domElement);

	for (const child of domElement.GetDescendants()) {
		instanceToEventManager.delete(child);
		instanceToBindings.delete(child);
		cleanupDragResize(child);
	}
}

/**
 * Tracks a controlled value on an instance so it can be restored when React re-renders.
 *
 * @param node - Roblox instance to observe.
 * @param valueField - Property name such as `Text`, `Value`, or `Transparency`.
 * @param initialValue - The initial value to track.
 * @returns An object with read/write access to the tracked value.
 */
export function trackValueOnNode(
	node: Instance,
	valueField: string,
	initialValue: unknown
): {
	getValue: () => unknown;
	setValue: (nextValue: unknown) => void;
} {
	let nodeTrackers = trackedValueNodes.get(node);
	if (nodeTrackers === undefined) {
		nodeTrackers = new Map<string, { value: unknown }>();
		trackedValueNodes.set(node, nodeTrackers);
	}

	const tracker = nodeTrackers.get(valueField) ?? { value: initialValue };
	nodeTrackers.set(valueField, tracker);
	tracker.value = initialValue;

	return {
		getValue: (): unknown => tracker.value,
		setValue: (nextValue: unknown): void => {
			tracker.value = nextValue;
			const record = node as unknown as Record<string, unknown>;
			record[valueField] = nextValue;
		},
	};
}

/**
 * Restores a controlled value onto a Roblox instance before the next render is
 * committed. This covers `Text` and `Value`-style properties used by Roblox UI
 * controls such as `TextBox`, `NumberValue`, and other instance types with a
 * single tracked public value.
 *
 * @param domElement - Instance to restore.
 * @param tag - Element type string.
 * @param props - Current props.
 */
export function restoreControlledState(domElement: HostInstance, tag: string, props: PropsMap): void {
	const instanceRecord = domElement as unknown as Record<string, unknown>;
	const controlledKeys = ['Text', 'Value'] as const;

	for (const controlledKey of controlledKeys) {
		if (props[controlledKey] === undefined) {
			continue;
		}

		const currentValue = instanceRecord[controlledKey];
		if (currentValue !== props[controlledKey]) {
			instanceRecord[controlledKey] = props[controlledKey];
		}
	}

	if (tag === 'TextBox' || tag === 'TextLabel' || tag === 'TextButton') {
		const nextText = props.Text;
		if (nextText !== undefined) {
			instanceRecord.Text = nextText;
		}
	}

	if (tag === 'NumberValue' || tag === 'IntValue' || tag === 'StringValue') {
		const nextValue = props.Value;
		if (nextValue !== undefined) {
			instanceRecord.Value = nextValue;
		}
	}
}

export const ReactRobloxComponent = {
	setInitialProperties,
	diffProperties,
	updateProperties,
	cleanupHostComponent,
	restoreControlledState,
	trackValueOnNode,
};
