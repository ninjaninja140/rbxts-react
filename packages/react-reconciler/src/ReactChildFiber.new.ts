/**
 * Child-fiber reconciliation helpers used during mount/update.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactChildFiber.new.lua`.
 *
 * @module ReactChildFiber
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import {
	console,
	describeError,
	getComponentName,
	invariant,
	ReactFeatureFlags,
	ReactSymbols,
	SafeFlags,
} from '@nrbx/react-shared';
import type { ReactElement, ReactFragment, ReactPortal } from '@nrbx/react-shared';

import { Deletion, Placement } from './ReactFiberFlags';
import {
	createFiberFromElement,
	createFiberFromFragment,
	createFiberFromPortal,
	createFiberFromText,
	createWorkInProgress,
	isArray,
	resetWorkInProgress,
} from './ReactFiber.new';
import { isCompatibleFamilyForHotReloading } from './ReactFiberHotReloading.new';
import {
	Block,
	ClassComponent,
	ForwardRef,
	Fragment,
	FunctionComponent,
	HostPortal,
	HostText,
	SimpleMemoComponent,
} from './ReactWorkTags';
import type { Fiber, Lanes, RoactStableKey } from './types';

const FFlagReactPreventAssigningKeyToChildren = SafeFlags.createGetFFlag('ReactPreventAssigningKeyToChildren')();

const { enableBlocksAPI, enableLazyElements } = ReactFeatureFlags;
const { getIteratorFn, REACT_BLOCK_TYPE, REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE, REACT_LAZY_TYPE, REACT_PORTAL_TYPE } =
	ReactSymbols;

type KeyedRecord = Record<string, unknown> &
	Record<number, unknown> & {
		key?: RoactStableKey;
		ref?: unknown;
		type?: unknown;
		props?: Record<string, unknown>;
		children?: unknown;
		containerInfo?: unknown;
		implementation?: unknown;
		_owner?: Fiber;
		_self?: unknown;
		_source?: unknown;
		_store?: {
			validated?: boolean;
		} & Record<string, unknown>;
		_payload?: unknown;
		_init?: (payload: unknown) => unknown;
		_render?: unknown;
		$$typeof?: unknown;
	};

type ReactElementLike = ReactElement<Record<string, unknown>, unknown> & KeyedRecord;
type ReactPortalLike = ReactPortal & KeyedRecord;

type IteratorStep = {
	value: unknown;
	key: unknown;
	done: boolean;
};

type IteratorObject = {
	next: () => IteratorStep;
};

type IteratorFunction = (...args: Array<unknown>) => IteratorObject;

type LazyComponent<T> = {
	_payload: unknown;
	_init: (payload: unknown) => T;
};

let didWarnAboutMaps = false;
let ownerHasKeyUseWarning: Record<string, boolean> = {};
let ownerHasFunctionTypeWarning: Record<string, boolean> = {};
let warnForMissingKey: (child: unknown, returnFiber: Fiber) => void = () => undefined;

if (__DEV__) {
	didWarnAboutMaps = false;
	ownerHasKeyUseWarning = {};
	ownerHasFunctionTypeWarning = {};

	warnForMissingKey = (child: unknown, returnFiber: Fiber): void => {
		if (child === undefined || typeOf(child) !== 'table') {
			return;
		}

		const childRecord = child as KeyedRecord;
		if (childRecord._store === undefined || childRecord._store.validated || childRecord.key !== undefined) {
			return;
		}

		invariant(
			childRecord._store !== undefined && typeOf(childRecord._store) === 'table',
			'React Component in warnForMissingKey should have a _store. ' +
				'This error is likely caused by a bug in React. Please file an issue.'
		);
		childRecord._store.validated = true;

		const componentName = getComponentName(returnFiber.type) ?? 'Component';
		if (ownerHasKeyUseWarning[componentName]) {
			return;
		}
		ownerHasKeyUseWarning[componentName] = true;

		console.error(
			'Each child in a list should have a unique ' +
				'"key" prop. See https://reactjs.org/link/warning-keys for ' +
				'more information.'
		);
	};
}

function coerceRef(returnFiber: Fiber, _current: Fiber | undefined, element: ReactElementLike): Fiber['ref'] {
	const mixedRef = element.ref;
	if (mixedRef !== undefined && typeOf(mixedRef) === 'string') {
		if (
			(element._owner as unknown) === undefined ||
			element._self === undefined ||
			((element._owner as KeyedRecord).stateNode as unknown) === element._self
		) {
			const componentName = __DEV__
				? (getComponentName(returnFiber.type) ?? 'Component')
				: '<enable __DEV__ mode for component names>';
			error(
				string.format(
					'Component "%s" contains the string ref "%s". Support for string refs ' +
						'has been removed. We recommend using ' +
						'useRef() or createRef() instead. ' +
						'Learn more about using refs safely here: ' +
						'https://reactjs.org/link/strict-mode-string-ref',
					componentName,
					tostring(mixedRef)
				)
			);
		}

		if ((element._owner as unknown) === undefined) {
			error('Expected ref to be a function or an object returned by React.createRef(), or nil.');
		}
	}

	return mixedRef as Fiber['ref'];
}

function warnOnFunctionType(returnFiber: Fiber): void {
	if (__DEV__) {
		const componentName = getComponentName(returnFiber.type) ?? 'Component';
		if (ownerHasFunctionTypeWarning[componentName]) {
			return;
		}
		ownerHasFunctionTypeWarning[componentName] = true;

		console.error(
			'Functions are not valid as a React child. This may happen if ' +
				'you return a Component instead of <Component /> from render. ' +
				'Or maybe you meant to call this function rather than return it.'
		);
	}
}

function resolveLazyType<T>(lazyComponent: LazyComponent<T>): LazyComponent<T> | T {
	const payload = lazyComponent._payload;
	const init = lazyComponent._init;
	const [ok, result] = xpcall(init as Callback, describeError as Callback, payload as never) as LuaTuple<
		[boolean, unknown]
	>;

	if (!ok) {
		return lazyComponent;
	}

	return result as T;
}

function ChildReconciler(shouldTrackSideEffects: boolean) {
	function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
		if (!shouldTrackSideEffects) {
			return;
		}

		const deletions = returnFiber.deletions;
		if (deletions === undefined) {
			returnFiber.deletions = [childToDelete];
			returnFiber.flags = bit32.bor(returnFiber.flags, Deletion);
		} else {
			deletions.push(childToDelete);
		}
	}

	function deleteRemainingChildren(returnFiber: Fiber, currentFirstChild: Fiber | undefined): Fiber | undefined {
		if (!shouldTrackSideEffects) {
			return undefined;
		}

		let childToDelete = currentFirstChild;
		while (childToDelete !== undefined) {
			deleteChild(returnFiber, childToDelete);
			childToDelete = childToDelete.sibling;
		}
		return undefined;
	}

	function mapRemainingChildren(_returnFiber: Fiber, currentFirstChild: Fiber): Map<RoactStableKey, Fiber> {
		const existingChildren = new Map<RoactStableKey, Fiber>();

		let existingChild: Fiber | undefined = currentFirstChild;
		while (existingChild !== undefined) {
			if (existingChild.key !== undefined) {
				existingChildren.set(existingChild.key, existingChild);
			} else {
				existingChildren.set(existingChild.index, existingChild);
			}
			existingChild = existingChild.sibling;
		}
		return existingChildren;
	}

	function useFiber(fiber: Fiber, pendingProps: unknown): Fiber {
		const clone = createWorkInProgress(fiber, pendingProps);
		clone.index = 1;
		clone.sibling = undefined;
		return clone;
	}

	function placeChild(newFiber: Fiber, lastPlacedIndex: number, newIndex: number): number {
		newFiber.index = newIndex;
		if (!shouldTrackSideEffects) {
			return lastPlacedIndex;
		}

		const current = newFiber.alternate;
		if (current !== undefined) {
			const oldIndex = current.index;
			if (oldIndex < lastPlacedIndex) {
				newFiber.flags = bit32.bor(newFiber.flags, Placement);
				return lastPlacedIndex;
			}

			return oldIndex;
		}

		newFiber.flags = bit32.bor(newFiber.flags, Placement);
		return lastPlacedIndex;
	}

	function placeSingleChild(newFiber: Fiber): Fiber {
		if (shouldTrackSideEffects && newFiber.alternate === undefined) {
			newFiber.flags = bit32.bor(newFiber.flags, Placement);
		}
		return newFiber;
	}

	function updateTextNode(returnFiber: Fiber, current: Fiber | undefined, textContent: string, lanes: Lanes): Fiber {
		if (current === undefined || current.tag !== HostText) {
			const created = createFiberFromText(textContent, returnFiber.mode, lanes);
			created.return_ = returnFiber;
			return created;
		}

		const existing = useFiber(current, textContent);
		existing.return_ = returnFiber;
		return existing;
	}

	function updateElement(
		returnFiber: Fiber,
		current: Fiber | undefined,
		element: ReactElementLike,
		lanes: Lanes
	): Fiber {
		if (current !== undefined) {
			if (
				(current.elementType as unknown) === element.type ||
				(__DEV__ && isCompatibleFamilyForHotReloading(current, element))
			) {
				const existing = useFiber(current, element.props as unknown);
				existing.ref = coerceRef(returnFiber, current, element);
				existing.return_ = returnFiber;
				if (__DEV__) {
					existing._debugSource = element._source;
					existing._debugOwner = element._owner;
				}
				return existing;
			} else if (enableBlocksAPI && current.tag === Block) {
				let type_: unknown = element.type;
				if (typeOf(type_) === 'table' && (type_ as KeyedRecord).$$typeof === REACT_LAZY_TYPE) {
					type_ = resolveLazyType(type_ as unknown as LazyComponent<unknown>);
				}

				if (
					(type_ as KeyedRecord).$$typeof === REACT_BLOCK_TYPE &&
					(type_ as KeyedRecord)._render === (current.type as KeyedRecord)._render
				) {
					const existing = useFiber(current, element.props as unknown);
					existing.return_ = returnFiber;
					existing.type = type_;
					if (__DEV__) {
						existing._debugSource = element._source;
						existing._debugOwner = element._owner;
					}
					return existing;
				}
			}
		}

		const created = createFiberFromElement(element, returnFiber.mode, lanes);
		created.ref = coerceRef(returnFiber, current, element);
		created.return_ = returnFiber;
		return created;
	}

	function updatePortal(
		returnFiber: Fiber,
		current: Fiber | undefined,
		portal: ReactPortalLike,
		lanes: Lanes
	): Fiber {
		if (
			current === undefined ||
			current.tag !== HostPortal ||
			(current.stateNode as KeyedRecord).containerInfo !== (portal.containerInfo as unknown) ||
			(current.stateNode as KeyedRecord).implementation !== (portal.implementation as unknown)
		) {
			const created = createFiberFromPortal(portal, returnFiber.mode, lanes);
			created.return_ = returnFiber;
			return created;
		}

		const existing = useFiber(current, portal.children ?? ({} as Record<string, unknown>));
		existing.return_ = returnFiber;
		return existing;
	}

	function updateFragment(
		returnFiber: Fiber,
		current: Fiber | undefined,
		fragment: unknown,
		lanes: Lanes,
		key?: RoactStableKey
	): Fiber {
		if (current === undefined || current.tag !== Fragment) {
			const created = createFiberFromFragment(
				fragment as ReactFragment,
				returnFiber.mode,
				lanes,
				key as string | undefined
			);
			created.return_ = returnFiber;
			return created;
		}

		const existing = useFiber(current, fragment);
		existing.return_ = returnFiber;
		return existing;
	}

	function assignStableKey(tableKey: unknown, newChild: KeyedRecord): void {
		if (newChild.key === undefined) {
			const typeOfTableKey = typeOf(tableKey);
			if (typeOfTableKey === 'string' || typeOfTableKey === 'number') {
				newChild.key = tableKey as RoactStableKey;
			} else if (typeOfTableKey === 'table') {
				newChild.key = tostring(tableKey);
			}
		}
	}

	function createChild(returnFiber: Fiber, newChild: unknown, lanes: Lanes, tableKey?: unknown): Fiber | undefined {
		if (newChild === undefined) {
			return undefined;
		}

		const typeOfNewChild = typeOf(newChild);
		if (typeOfNewChild === 'table') {
			const childRecord = newChild as KeyedRecord;
			assignStableKey(tableKey, childRecord);

			const newChildTypeof = childRecord.$$typeof;
			if (newChildTypeof === REACT_ELEMENT_TYPE) {
				const created = createFiberFromElement(childRecord as ReactElementLike, returnFiber.mode, lanes);
				created.ref = coerceRef(returnFiber, undefined, childRecord as ReactElementLike);
				created.return_ = returnFiber;
				return created;
			} else if (newChildTypeof === REACT_PORTAL_TYPE) {
				const created = createFiberFromPortal(childRecord as ReactPortalLike, returnFiber.mode, lanes);
				created.return_ = returnFiber;
				return created;
			} else if (newChildTypeof === REACT_LAZY_TYPE) {
				if (enableLazyElements) {
					const payload = childRecord._payload;
					const init = childRecord._init;
					if (init !== undefined) {
						return createChild(returnFiber, init(payload), lanes);
					}
				}
			}

			const created = createFiberFromFragment(newChild as ReactFragment, returnFiber.mode, lanes, undefined);
			created.return_ = returnFiber;
			return created;
		}

		if (typeOfNewChild === 'string' || typeOfNewChild === 'number') {
			const created = createFiberFromText(tostring(newChild), returnFiber.mode, lanes);
			created.return_ = returnFiber;
			return created;
		}

		if (__DEV__ && typeOfNewChild === 'function') {
			warnOnFunctionType(returnFiber);
		}

		return undefined;
	}

	function updateSlot(
		returnFiber: Fiber,
		oldFiber: Fiber | undefined,
		newChild: unknown,
		lanes: Lanes,
		tableKey?: unknown
	): Fiber | undefined {
		if (newChild === undefined) {
			return undefined;
		}

		const key = oldFiber?.key;
		const typeOfNewChild = typeOf(newChild);

		if (typeOfNewChild === 'table') {
			const childRecord = newChild as KeyedRecord;
			assignStableKey(tableKey, childRecord);
			const newChildTypeof = childRecord.$$typeof;

			if (newChildTypeof === REACT_ELEMENT_TYPE) {
				if (childRecord.key === key) {
					if (childRecord.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(
							returnFiber,
							oldFiber,
							(childRecord.props as KeyedRecord).children,
							lanes,
							key
						);
					}
					return updateElement(returnFiber, oldFiber, childRecord as ReactElementLike, lanes);
				}
				return undefined;
			} else if (newChildTypeof === REACT_PORTAL_TYPE) {
				if (childRecord.key === key) {
					return updatePortal(returnFiber, oldFiber, childRecord as ReactPortalLike, lanes);
				}
				return undefined;
			} else if (newChildTypeof === REACT_LAZY_TYPE) {
				if (enableLazyElements) {
					const payload = childRecord._payload;
					const init = childRecord._init;
					if (init !== undefined) {
						return updateSlot(returnFiber, oldFiber, init(payload), lanes);
					}
				}
			}

			if (key !== undefined) {
				return undefined;
			}
			return updateFragment(returnFiber, oldFiber, newChild, lanes);
		}

		if (typeOfNewChild === 'string' || typeOfNewChild === 'number') {
			if (key !== undefined) {
				return undefined;
			}
			return updateTextNode(returnFiber, oldFiber, tostring(newChild), lanes);
		}

		if (__DEV__ && typeOfNewChild === 'function') {
			warnOnFunctionType(returnFiber);
		}

		return undefined;
	}

	function updateFromMap(
		existingChildren: Map<RoactStableKey, Fiber>,
		returnFiber: Fiber,
		newIdx: number,
		newChild: unknown,
		lanes: Lanes,
		tableKey?: unknown
	): Fiber | undefined {
		if (newChild === undefined) {
			return undefined;
		}

		const typeOfNewChild = typeOf(newChild);
		if (typeOfNewChild === 'table') {
			const childRecord = newChild as KeyedRecord;
			assignStableKey(tableKey, childRecord);

			let existingChildrenKey: RoactStableKey;
			const newChildTypeof = childRecord.$$typeof;
			if (newChildTypeof === REACT_ELEMENT_TYPE) {
				existingChildrenKey = childRecord.key === undefined ? newIdx : childRecord.key;
				const matchedFiber = existingChildren.get(existingChildrenKey);
				if (childRecord.type === REACT_FRAGMENT_TYPE) {
					return updateFragment(
						returnFiber,
						matchedFiber,
						(childRecord.props as KeyedRecord).children,
						lanes,
						childRecord.key
					);
				}
				return updateElement(returnFiber, matchedFiber, childRecord as ReactElementLike, lanes);
			} else if (newChildTypeof === REACT_PORTAL_TYPE) {
				existingChildrenKey = childRecord.key === undefined ? newIdx : childRecord.key;
				const matchedFiber = existingChildren.get(existingChildrenKey);
				return updatePortal(returnFiber, matchedFiber, childRecord as ReactPortalLike, lanes);
			} else if (newChildTypeof === REACT_LAZY_TYPE) {
				if (enableLazyElements) {
					const payload = childRecord._payload;
					const init = childRecord._init;
					if (init !== undefined) {
						return updateFromMap(existingChildren, returnFiber, newIdx, init(payload), lanes);
					}
				}
			}

			const matchedFiber = existingChildren.get(newIdx);
			return updateFragment(returnFiber, matchedFiber, newChild, lanes);
		}

		if (typeOfNewChild === 'string' || typeOfNewChild === 'number') {
			const matchedFiber = existingChildren.get(newIdx);
			return updateTextNode(returnFiber, matchedFiber, tostring(newChild), lanes);
		}

		if (__DEV__ && typeOfNewChild === 'function') {
			warnOnFunctionType(returnFiber);
		}

		return undefined;
	}

	function warnOnInvalidKey(
		child: unknown,
		knownKeys: Set<string> | undefined,
		returnFiber: Fiber
	): Set<string> | undefined {
		if (__DEV__) {
			if (child === undefined || typeOf(child) !== 'table') {
				return knownKeys;
			}

			const childRecord = child as KeyedRecord;
			const childTypeof = childRecord.$$typeof;
			if (childTypeof === REACT_ELEMENT_TYPE || childTypeof === REACT_PORTAL_TYPE) {
				warnForMissingKey(child, returnFiber);
				const key = childRecord.key;
				if (typeOf(key) !== 'string') {
					// noop
				} else if (knownKeys === undefined) {
					knownKeys = new Set([key as string]);
				} else if (!knownKeys.has(key as string)) {
					knownKeys.add(key as string);
				} else {
					console.error(
						'Encountered two children with the same key, `%s`. ' +
							'Keys should be unique so that components maintain their identity ' +
							'across updates. Non-unique keys may cause children to be ' +
							'duplicated and/or omitted — the behavior is unsupported and ' +
							'could change in a future version.',
						key
					);
				}
			} else if (childTypeof === REACT_LAZY_TYPE) {
				if (enableLazyElements) {
					const payload = childRecord._payload;
					const init = childRecord._init;
					if (init !== undefined) {
						warnOnInvalidKey(init(payload), knownKeys, returnFiber);
					}
				}
			}
		}

		return knownKeys;
	}

	function reconcileChildrenArray(
		returnFiber: Fiber,
		currentFirstChild: Fiber | undefined,
		newChildren: Array<unknown>,
		lanes: Lanes
	): Fiber | undefined {
		if (__DEV__) {
			let knownKeys: Set<string> | undefined;
			const newChildrenCountForKeys = newChildren.size();
			const newChildrenTableForKeys = newChildren as unknown as Record<number, unknown>;
			let keyIdx = 1;
			while (keyIdx <= newChildrenCountForKeys) {
				knownKeys = warnOnInvalidKey(newChildrenTableForKeys[keyIdx], knownKeys, returnFiber);
				keyIdx += 1;
			}
		}

		let resultingFirstChild: Fiber | undefined;
		let previousNewFiber: Fiber | undefined;

		let oldFiber = currentFirstChild;
		let lastPlacedIndex = 1;
		let newIdx = 1;
		let nextOldFiber: Fiber | undefined;
		const newChildrenCount = newChildren.size();
		const newChildrenTable = newChildren as unknown as Record<number, unknown>;

		while (oldFiber !== undefined && newIdx <= newChildrenCount) {
			if (oldFiber.index > newIdx) {
				nextOldFiber = oldFiber;
				oldFiber = undefined;
			} else {
				nextOldFiber = oldFiber.sibling;
			}

			let newFiber: Fiber | undefined;
			const newChildNewIdx = newChildrenTable[newIdx];
			if (
				newChildNewIdx !== undefined &&
				typeOf(newChildNewIdx) === 'table' &&
				(newChildNewIdx as KeyedRecord).$$typeof !== undefined
			) {
				newFiber = updateSlot(returnFiber, oldFiber, newChildNewIdx, lanes, newIdx);
			} else {
				newFiber = updateSlot(returnFiber, oldFiber, newChildNewIdx, lanes);
			}

			if (newFiber === undefined) {
				if (oldFiber === undefined) {
					oldFiber = nextOldFiber;
				}
				break;
			}

			if (shouldTrackSideEffects) {
				if (oldFiber !== undefined && newFiber.alternate === undefined) {
					deleteChild(returnFiber, oldFiber);
				}
			}

			lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
			if (previousNewFiber === undefined) {
				resultingFirstChild = newFiber;
			} else {
				previousNewFiber.sibling = newFiber;
			}

			previousNewFiber = newFiber;
			oldFiber = nextOldFiber;
			newIdx += 1;
		}

		if (newIdx > newChildrenCount) {
			deleteRemainingChildren(returnFiber, oldFiber);
			return resultingFirstChild;
		}

		if (oldFiber === undefined) {
			while (newIdx <= newChildrenCount) {
				let newFiber: Fiber | undefined;
				const newChildNewIdx = newChildrenTable[newIdx];
				if (
					newChildNewIdx !== undefined &&
					typeOf(newChildNewIdx) === 'table' &&
					(newChildNewIdx as KeyedRecord).$$typeof !== undefined
				) {
					newFiber = createChild(returnFiber, newChildNewIdx, lanes, newIdx);
				} else {
					newFiber = createChild(returnFiber, newChildNewIdx, lanes);
				}

				if (newFiber === undefined) {
					newIdx += 1;
					continue;
				}

				lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
				if (previousNewFiber === undefined) {
					resultingFirstChild = newFiber;
				} else {
					previousNewFiber.sibling = newFiber;
				}
				previousNewFiber = newFiber;
				newIdx += 1;
			}
			return resultingFirstChild;
		}

		const existingChildren = mapRemainingChildren(returnFiber, oldFiber);

		while (newIdx <= newChildrenCount) {
			let newFiber: Fiber | undefined;
			const newChildNewIdx = newChildrenTable[newIdx];
			if (
				!FFlagReactPreventAssigningKeyToChildren ||
				(newChildNewIdx !== undefined &&
					typeOf(newChildNewIdx) === 'table' &&
					(newChildNewIdx as KeyedRecord).$$typeof !== undefined)
			) {
				newFiber = updateFromMap(existingChildren, returnFiber, newIdx, newChildNewIdx, lanes, newIdx);
			} else {
				newFiber = updateFromMap(existingChildren, returnFiber, newIdx, newChildNewIdx, lanes);
			}

			if (newFiber !== undefined) {
				if (shouldTrackSideEffects) {
					if (newFiber.alternate !== undefined) {
						existingChildren.delete(newFiber.key === undefined ? newIdx : newFiber.key);
					}
				}

				lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
				if (previousNewFiber === undefined) {
					resultingFirstChild = newFiber;
				} else {
					previousNewFiber.sibling = newFiber;
				}
				previousNewFiber = newFiber;
			}

			newIdx += 1;
		}

		if (shouldTrackSideEffects) {
			for (const [, child] of existingChildren) {
				deleteChild(returnFiber, child);
			}
		}

		return resultingFirstChild;
	}

	function reconcileChildrenIterator(
		returnFiber: Fiber,
		currentFirstChild: Fiber | undefined,
		newChildrenIterable: unknown,
		lanes: Lanes,
		iteratorFn: IteratorFunction
	): Fiber | undefined {
		if (__DEV__) {
			if ((newChildrenIterable as KeyedRecord).entries === iteratorFn) {
				if (!didWarnAboutMaps) {
					console.error(
						'Using Maps as children is not supported. ' + 'Use an array of keyed ReactElements instead.'
					);
				}
				didWarnAboutMaps = true;
			}

			const newChildren = iteratorFn(newChildrenIterable);
			if (newChildren) {
				let knownKeys: Set<string> | undefined;
				let step = newChildren.next();
				while (!step.done) {
					step = newChildren.next();
					const child = step.value;
					knownKeys = warnOnInvalidKey(child, knownKeys, returnFiber);
				}
			}
		}

		const newChildren = iteratorFn(newChildrenIterable);
		let resultingFirstChild: Fiber | undefined;
		let previousNewFiber: Fiber | undefined;

		let oldFiber = currentFirstChild;
		let lastPlacedIndex = 1;
		let newIdx = 1;
		let nextOldFiber: Fiber | undefined;

		let step = newChildren.next();
		while (oldFiber !== undefined && !step.done) {
			if (oldFiber.index > newIdx) {
				nextOldFiber = oldFiber;
				oldFiber = undefined;
			} else {
				nextOldFiber = oldFiber.sibling;
			}

			const newFiber = updateSlot(returnFiber, oldFiber, step.value, lanes, step.key);
			if (newFiber === undefined) {
				if (oldFiber === undefined) {
					oldFiber = nextOldFiber;
				}
				break;
			}

			if (shouldTrackSideEffects) {
				if (oldFiber !== undefined && newFiber.alternate === undefined) {
					deleteChild(returnFiber, oldFiber);
				}
			}

			lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
			if (previousNewFiber === undefined) {
				resultingFirstChild = newFiber;
			} else {
				previousNewFiber.sibling = newFiber;
			}
			previousNewFiber = newFiber;
			oldFiber = nextOldFiber;

			newIdx += 1;
			step = newChildren.next();
		}

		if (step.done) {
			deleteRemainingChildren(returnFiber, oldFiber);
			return resultingFirstChild;
		}

		if (oldFiber === undefined) {
			while (!step.done) {
				const newFiber = createChild(returnFiber, step.value, lanes, step.key);
				if (newFiber === undefined) {
					newIdx += 1;
					step = newChildren.next();
					continue;
				}

				lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
				if (previousNewFiber === undefined) {
					resultingFirstChild = newFiber;
				} else {
					previousNewFiber.sibling = newFiber;
				}
				previousNewFiber = newFiber;

				newIdx += 1;
				step = newChildren.next();
			}
			return resultingFirstChild;
		}

		let existingChildren: Map<RoactStableKey, Fiber> | undefined;
		while (!step.done) {
			if (existingChildren === undefined) {
				existingChildren = mapRemainingChildren(returnFiber, oldFiber);
			}

			const newFiber = updateFromMap(existingChildren, returnFiber, newIdx, step.value, lanes, step.key);

			if (newFiber !== undefined) {
				if (shouldTrackSideEffects) {
					if (newFiber.alternate !== undefined) {
						if (newFiber.key === undefined) {
							existingChildren.delete(newIdx);
						} else {
							existingChildren.delete(newFiber.key);
						}
					}
				}

				lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
				if (previousNewFiber === undefined) {
					resultingFirstChild = newFiber;
				} else {
					previousNewFiber.sibling = newFiber;
				}
				previousNewFiber = newFiber;
			}

			newIdx += 1;
			step = newChildren.next();
		}

		if (shouldTrackSideEffects && existingChildren !== undefined) {
			for (const [, child] of existingChildren) {
				deleteChild(returnFiber, child);
			}
		}

		return resultingFirstChild;
	}

	function reconcileSingleTextNode(
		returnFiber: Fiber,
		currentFirstChild: Fiber | undefined,
		textContent: string,
		lanes: Lanes
	): Fiber {
		if (currentFirstChild !== undefined && currentFirstChild.tag === HostText) {
			deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
			const existing = useFiber(currentFirstChild, textContent);
			existing.return_ = returnFiber;
			return existing;
		}

		deleteRemainingChildren(returnFiber, currentFirstChild);
		const created = createFiberFromText(textContent, returnFiber.mode, lanes);
		created.return_ = returnFiber;
		return created;
	}

	function reconcileSingleElement(
		returnFiber: Fiber,
		currentFirstChild: Fiber | undefined,
		element: ReactElementLike,
		lanes: Lanes
	): Fiber {
		const key = element.key;
		let child = currentFirstChild;
		while (child !== undefined) {
			if (child.key === key) {
				if (child.tag === Fragment) {
					if ((element.type as unknown as number) === REACT_FRAGMENT_TYPE) {
						deleteRemainingChildren(returnFiber, child.sibling);
						const existing = useFiber(child, (element.props as KeyedRecord).children);
						existing.return_ = returnFiber;
						if (__DEV__) {
							existing._debugSource = element._source;
							existing._debugOwner = element._owner;
						}
						return existing;
					}
				} else if (
					(child.elementType as unknown) === element.type ||
					(__DEV__ && isCompatibleFamilyForHotReloading(child, element))
				) {
					deleteRemainingChildren(returnFiber, child.sibling);
					const existing = useFiber(child, element.props as unknown);
					existing.ref = coerceRef(returnFiber, child, element);
					existing.return_ = returnFiber;
					if (__DEV__) {
						existing._debugSource = element._source;
						existing._debugOwner = element._owner;
					}
					return existing;
				}

				deleteRemainingChildren(returnFiber, child);
				break;
			}

			deleteChild(returnFiber, child);
			child = child.sibling;
		}

		if ((element.type as unknown as number) === REACT_FRAGMENT_TYPE) {
			const created = createFiberFromFragment(
				(element.props as KeyedRecord).children as ReactFragment,
				returnFiber.mode,
				lanes,
				element.key as string | undefined
			);
			created.return_ = returnFiber;
			return created;
		}

		const created = createFiberFromElement(element, returnFiber.mode, lanes);
		created.ref = coerceRef(returnFiber, currentFirstChild, element);
		created.return_ = returnFiber;
		return created;
	}

	function reconcileSinglePortal(
		returnFiber: Fiber,
		currentFirstChild: Fiber | undefined,
		portal: ReactPortalLike,
		lanes: Lanes
	): Fiber {
		const key = portal.key;
		let child = currentFirstChild;
		while (child !== undefined) {
			if (child.key === key) {
				if (
					child.tag === HostPortal &&
					(child.stateNode as KeyedRecord).containerInfo === (portal.containerInfo as unknown) &&
					(child.stateNode as KeyedRecord).implementation === (portal.implementation as unknown)
				) {
					deleteRemainingChildren(returnFiber, child.sibling);
					const existing = useFiber(child, portal.children ?? ({} as Record<string, unknown>));
					existing.return_ = returnFiber;
					return existing;
				}

				deleteRemainingChildren(returnFiber, child);
				break;
			}

			deleteChild(returnFiber, child);
			child = child.sibling;
		}

		const created = createFiberFromPortal(portal, returnFiber.mode, lanes);
		created.return_ = returnFiber;
		return created;
	}

	function reconcileChildFibers(
		returnFiber: Fiber,
		currentFirstChild: Fiber | undefined,
		newChild: unknown,
		lanes: Lanes
	): Fiber | undefined {
		let typeOfNewChild = typeOf(newChild);
		const isUnkeyedTopLevelFragment =
			newChild !== undefined &&
			typeOfNewChild === 'table' &&
			(newChild as KeyedRecord).type === REACT_FRAGMENT_TYPE &&
			(newChild as KeyedRecord).key === undefined;

		if (isUnkeyedTopLevelFragment) {
			newChild = ((newChild as KeyedRecord).props as KeyedRecord).children;
			typeOfNewChild = typeOf(newChild);
		}

		const newChildIsArray = isArray(newChild);
		const isObject = newChild !== undefined && typeOfNewChild === 'table' && !newChildIsArray;

		if (isObject) {
			const newChildTypeof = (newChild as KeyedRecord).$$typeof;
			if (newChildTypeof === REACT_ELEMENT_TYPE) {
				return placeSingleChild(
					reconcileSingleElement(returnFiber, currentFirstChild, newChild as ReactElementLike, lanes)
				);
			} else if (newChildTypeof === REACT_PORTAL_TYPE) {
				return placeSingleChild(
					reconcileSinglePortal(returnFiber, currentFirstChild, newChild as ReactPortalLike, lanes)
				);
			} else if (newChildTypeof === REACT_LAZY_TYPE) {
				if (enableLazyElements) {
					const payload = (newChild as KeyedRecord)._payload;
					const init = (newChild as KeyedRecord)._init;
					if (init !== undefined) {
						return reconcileChildFibers(returnFiber, currentFirstChild, init(payload), lanes);
					}
				}
			}
		} else if (newChildIsArray) {
			return reconcileChildrenArray(returnFiber, currentFirstChild, newChild as Array<unknown>, lanes);
		} else if (typeOfNewChild === 'string' || typeOfNewChild === 'number') {
			return placeSingleChild(reconcileSingleTextNode(returnFiber, currentFirstChild, tostring(newChild), lanes));
		}

		const newChildIteratorFn =
			newChild !== undefined ? (getIteratorFn(newChild as defined) as IteratorFunction | undefined) : undefined;
		if (newChildIteratorFn !== undefined) {
			return reconcileChildrenIterator(returnFiber, currentFirstChild, newChild, lanes, newChildIteratorFn);
		}

		if (__DEV__ && typeOfNewChild === 'function') {
			warnOnFunctionType(returnFiber);
		}

		if (newChild === undefined && !isUnkeyedTopLevelFragment) {
			const shouldFallThrough = false;
			if (
				shouldFallThrough &&
				(returnFiber.tag === ClassComponent ||
					returnFiber.tag === FunctionComponent ||
					returnFiber.tag === ForwardRef ||
					returnFiber.tag === SimpleMemoComponent)
			) {
				invariant(
					false,
					'%s(...): Nothing was returned from render. This usually means a ' +
						'return statement is missing. Or, to render nothing, ' +
						'return nil.',
					getComponentName(returnFiber.type) ?? 'Component'
				);
			}
		}

		return deleteRemainingChildren(returnFiber, currentFirstChild);
	}

	return reconcileChildFibers;
}

/**
 * Reconciles children for updates and tracks placement/deletion side effects.
 */
export const reconcileChildFibers = ChildReconciler(true);

/**
 * Reconciles children for mounts without tracking side effects.
 */
export const mountChildFibers = ChildReconciler(false);

/**
 * Clones the child fiber list from the current tree onto a work-in-progress fiber.
 */
export function cloneChildFibers(_current: Fiber | undefined, workInProgress: Fiber): void {
	if (workInProgress.child === undefined) {
		return;
	}

	let currentChild = workInProgress.child;
	let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
	workInProgress.child = newChild;

	newChild.return_ = workInProgress;
	while (currentChild.sibling !== undefined) {
		currentChild = currentChild.sibling;
		newChild.sibling = createWorkInProgress(currentChild, currentChild.pendingProps);
		newChild = newChild.sibling as Fiber;
		newChild.return_ = workInProgress;
	}
	newChild.sibling = undefined;
}

/**
 * Resets each child of a work-in-progress fiber before a second render pass.
 */
export function resetChildFibers(workInProgress: Fiber, lanes: Lanes): void {
	let child = workInProgress.child;
	while (child !== undefined) {
		resetWorkInProgress(child, lanes);
		child = child.sibling;
	}
}

export default {
	reconcileChildFibers,
	mountChildFibers,
	cloneChildFibers,
	resetChildFibers,
};
