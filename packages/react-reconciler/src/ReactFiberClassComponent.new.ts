/**
 * Class component mount/update logic for the fiber reconciler.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberClassComponent.new.lua`.
 *
 * @module ReactFiberClassComponent
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import {
	assign,
	console,
	freeze,
	ReactFeatureFlags,
	ReactInstanceMap,
	shallowEqual,
	getComponentName,
	UninitializedState,
	describeError,
	ReactSymbols,
	ConsolePatchingDev,
} from '@nrbx/react-shared';
import type { ReactContext, React_Component } from '@nrbx/react-shared';
import type { Fiber, Update as UpdateType, UpdateQueue, Lanes } from './types';
import { NoLanes } from './ReactFiberLane';
import {
	enqueueUpdate,
	processUpdateQueue,
	checkHasForceUpdateAfterProcessing,
	resetHasForceUpdateBeforeProcessing,
	createUpdate,
	ReplaceState,
	ForceUpdate,
	initializeUpdateQueue,
	cloneUpdateQueue,
} from './ReactUpdateQueue.new';
import { Update, Snapshot, MountLayoutDev } from './ReactFiberFlags';
import ReactStrictModeWarnings from './ReactStrictModeWarnings.new';
import { isMounted } from './ReactFiberTreeReflection';
import { resolveDefaultProps } from './ReactFiberLazyComponent.new';
import { DebugTracingMode, StrictMode } from './ReactTypeOfMode';
import {
	cacheContext,
	getMaskedContext,
	getUnmaskedContext,
	hasContextChanged,
	emptyContextObject,
} from './ReactFiberContext.new';
import { readContext } from './ReactFiberNewContext.new';
import { logForceUpdateScheduled, logStateUpdateScheduled } from './DebugTracing';
import { markForceUpdateScheduled, markStateUpdateScheduled } from './SchedulingProfiler';

type UnknownRecord = Record<string, unknown>;
type ComponentInstance = UnknownRecord & {
	props?: unknown;
	state?: unknown;
	context?: unknown;
	__refs?: unknown;
	__updater?: unknown;
	render?: unknown;
};

type ClassComponentCtor<Props = unknown, State = unknown> = UnknownRecord &
	React_Component<Props, State> & {
		new?: (props: Props, context: unknown) => ComponentInstance;
		contextType?: unknown;
		contextTypes?: unknown;
		childContextTypes?: unknown;
		getDerivedStateFromProps?: (props: Props, state: State) => State | undefined;
		isPureReactComponent?: boolean;
		render?: unknown;
	};

type ClassComponentUpdater = {
	isMounted: typeof isMounted;
	enqueueSetState: (
		inst: unknown,
		payload: unknown,
		callback?: ((...args: Array<unknown>) => unknown) | undefined
	) => void;
	enqueueReplaceState: (
		inst: unknown,
		payload: unknown,
		callback?: ((...args: Array<unknown>) => unknown) | undefined
	) => void;
	enqueueForceUpdate: (inst: unknown, callback?: ((...args: Array<unknown>) => unknown) | undefined) => void;
};

function invokeClassMethod<Args extends Array<unknown>, Result>(
	method: unknown,
	instance: unknown,
	...args: Args
): Result {
	return (method as (self: unknown, ...methodArgs: Args) => Result)(instance, ...args);
}

const {
	debugRenderPhaseSideEffectsForStrictMode,
	disableLegacyContext,
	enableDebugTracing,
	enableSchedulingProfiler,
	warnAboutDeprecatedLifecycles,
	enableDoubleInvokingEffects,
} = ReactFeatureFlags;

const { get: getInstance, set: setInstance } = ReactInstanceMap;
const { disableLogs, reenableLogs } = ConsolePatchingDev;
const { REACT_CONTEXT_TYPE, REACT_PROVIDER_TYPE } = ReactSymbols;

const fakeInternalInstance: UnknownRecord = {};
// String refs are not supported by this runtime, so instances always point at
// a shared frozen empty table. Keeping this local (rather than reaching back
// into the `@nrbx/react` public entry point) avoids a circular require between
// the reconciler and the React package.
const emptyRefsObject = freeze({}) as Record<string, never>;

let didWarnAboutStateAssignmentForComponent: Map<defined, boolean> | undefined;
let didWarnAboutUninitializedState: Map<defined, boolean> | undefined;
let didWarnAboutGetSnapshotBeforeUpdateWithoutDidUpdate: Map<defined, boolean> | undefined;
let didWarnAboutLegacyLifecyclesAndDerivedState: Map<defined, boolean> | undefined;
let _didWarnAboutUndefinedDerivedState: Map<defined, boolean> | undefined;
let didWarnAboutDirectlyAssigningPropsToState: Map<defined, boolean> | undefined;
let didWarnAboutContextTypeAndContextTypes: Map<defined, boolean> | undefined;
let didWarnAboutInvalidateContextType: Map<defined, boolean> | undefined;
let warnOnUndefinedDerivedState: ((type_: unknown, partialState: unknown) => void) | undefined;
let warnOnInvalidCallback: ((callback: unknown, callerName: string) => void) | undefined;

if (__DEV__) {
	didWarnAboutStateAssignmentForComponent = new Map();
	didWarnAboutUninitializedState = new Map();
	didWarnAboutGetSnapshotBeforeUpdateWithoutDidUpdate = new Map();
	didWarnAboutLegacyLifecyclesAndDerivedState = new Map();
	didWarnAboutDirectlyAssigningPropsToState = new Map();
	_didWarnAboutUndefinedDerivedState = new Map();
	didWarnAboutContextTypeAndContextTypes = new Map();
	didWarnAboutInvalidateContextType = new Map();

	const didWarnOnInvalidCallback = new Map<defined, boolean>();

	warnOnInvalidCallback = (callback: unknown, callerName: string) => {
		if (callback === undefined || typeOf(callback) === 'function') {
			return;
		}
		const key = `${callerName}_${tostring(callback)}`;
		if (!didWarnOnInvalidCallback.has(key)) {
			didWarnOnInvalidCallback.set(key, true);
			console.error(
				'%s(...): Expected the last optional `callback` argument to be a function. Instead received: %s.',
				callerName,
				tostring(callback)
			);
		}
	};

	warnOnUndefinedDerivedState = (_type_: unknown, _partialState: unknown) => {
		// ROBLOX deviation: `nil` is a valid return for getDerivedStateFromProps,
		// and undefined cannot be represented directly in Luau call returns.
	};
}

/**
 * Applies static `getDerivedStateFromProps` to the in-progress class fiber.
 */
export function applyDerivedStateFromProps<Props, State>(
	workInProgress: Fiber,
	ctor: React_Component<Props, State>,
	getDerivedStateFromProps: (props: Props, state: State) => State | undefined,
	nextProps: Props
): void {
	const prevState = workInProgress.memoizedState as State;

	if (__DEV__) {
		if (debugRenderPhaseSideEffectsForStrictMode && bit32.band(workInProgress.mode, StrictMode) !== 0) {
			disableLogs();
			const [ok, result] = xpcall(
				getDerivedStateFromProps as (props: unknown, state: unknown) => unknown,
				describeError,
				nextProps as unknown,
				prevState as unknown
			) as LuaTuple<[boolean, unknown]>;
			reenableLogs();
			if (!ok) {
				error(result);
			}
		}
	}

	const partialState = getDerivedStateFromProps(nextProps, prevState);

	if (__DEV__) {
		warnOnUndefinedDerivedState!(ctor as unknown, partialState as unknown);
	}

	const memoizedState =
		partialState === undefined ? prevState : assign({}, prevState as object, partialState as object);
	workInProgress.memoizedState = memoizedState;

	if (workInProgress.lanes === NoLanes) {
		const updateQueue = workInProgress.updateQueue as UpdateQueue<any>;
		updateQueue.baseState = memoizedState;
	}
}

let classComponentUpdater: ClassComponentUpdater | undefined;

function initializeClassComponentUpdater(): void {
	const reactFiberWorkLoop = require(script.Parent!.WaitForChild('ReactFiberWorkLoop.new') as ModuleScript) as {
		requestEventTime: () => number;
		requestUpdateLane: (fiber: Fiber) => Lanes;
		scheduleUpdateOnFiber: (fiber: Fiber, lane: Lanes, eventTime: number) => void;
	};
	const { requestEventTime, requestUpdateLane, scheduleUpdateOnFiber } = reactFiberWorkLoop;

	classComponentUpdater = {
		isMounted,
		enqueueSetState: (
			inst: unknown,
			payload: unknown,
			callback?: ((...args: Array<unknown>) => unknown) | undefined
		): void => {
			const fiber = getInstance(inst as UnknownRecord) as unknown as Fiber;
			const eventTime = requestEventTime();
			const lane = requestUpdateLane(fiber);

			const update = createUpdate(eventTime, lane, payload, callback);
			if (callback !== undefined) {
				if (__DEV__) {
					warnOnInvalidCallback!(callback, 'setState');
				}
			}

			enqueueUpdate(fiber, update);
			scheduleUpdateOnFiber(fiber, lane, eventTime);

			if (__DEV__) {
				if (enableDebugTracing) {
					if (bit32.band(fiber.mode, DebugTracingMode) !== 0) {
						const name = getComponentName(fiber.type) ?? 'Unknown';
						logStateUpdateScheduled(name, lane, payload);
					}
				}
			}

			if (enableSchedulingProfiler) {
				markStateUpdateScheduled(fiber, lane);
			}
		},
		enqueueReplaceState: (
			inst: unknown,
			payload: unknown,
			callback?: ((...args: Array<unknown>) => unknown) | undefined
		): void => {
			const fiber = getInstance(inst as UnknownRecord) as unknown as Fiber;
			const eventTime = requestEventTime();
			const lane = requestUpdateLane(fiber);

			const update = createUpdate(eventTime, lane, payload, callback) as UpdateType<unknown>;
			update.tag = ReplaceState;

			if (callback !== undefined) {
				if (__DEV__) {
					warnOnInvalidCallback!(callback, 'replaceState');
				}
			}

			enqueueUpdate(fiber, update);
			scheduleUpdateOnFiber(fiber, lane, eventTime);

			if (__DEV__) {
				if (enableDebugTracing) {
					if (bit32.band(fiber.mode, DebugTracingMode) !== 0) {
						const name = getComponentName(fiber.type) ?? 'Unknown';
						logStateUpdateScheduled(name, lane, payload);
					}
				}
			}

			if (enableSchedulingProfiler) {
				markStateUpdateScheduled(fiber, lane);
			}
		},
		enqueueForceUpdate: (inst: unknown, callback?: ((...args: Array<unknown>) => unknown) | undefined): void => {
			const fiber = getInstance(inst as UnknownRecord) as unknown as Fiber;
			const eventTime = requestEventTime();
			const lane = requestUpdateLane(fiber);

			const update = createUpdate(eventTime, lane, undefined, callback) as UpdateType<unknown>;
			update.tag = ForceUpdate;

			if (callback !== undefined) {
				if (__DEV__) {
					warnOnInvalidCallback!(callback, 'forceUpdate');
				}
			}

			enqueueUpdate(fiber, update);
			scheduleUpdateOnFiber(fiber, lane, eventTime);

			if (__DEV__) {
				if (enableDebugTracing) {
					if (bit32.band(fiber.mode, DebugTracingMode) !== 0) {
						const name = getComponentName(fiber.type) ?? 'Unknown';
						logForceUpdateScheduled(name, lane);
					}
				}
			}

			if (enableSchedulingProfiler) {
				markForceUpdateScheduled(fiber, lane);
			}
		},
	};
}

function getClassComponentUpdater(): ClassComponentUpdater {
	if (classComponentUpdater === undefined) {
		initializeClassComponentUpdater();
	}
	return classComponentUpdater!;
}

function checkShouldComponentUpdate(
	workInProgress: Fiber,
	ctor: unknown,
	oldProps: unknown,
	newProps: unknown,
	oldState: unknown,
	newState: unknown,
	nextContext: unknown
): boolean | undefined {
	const instance = workInProgress.stateNode as ComponentInstance;
	if (instance.shouldComponentUpdate !== undefined && typeOf(instance.shouldComponentUpdate) === 'function') {
		if (__DEV__) {
			if (debugRenderPhaseSideEffectsForStrictMode && bit32.band(workInProgress.mode, StrictMode) !== 0) {
				disableLogs();
				const [ok, result] = xpcall(
					instance.shouldComponentUpdate as (
						self: unknown,
						props: unknown,
						state: unknown,
						context: unknown
					) => unknown,
					describeError,
					instance,
					newProps,
					newState,
					nextContext
				) as LuaTuple<[boolean, unknown]>;
				reenableLogs();
				if (!ok) {
					error(result);
				}
			}
		}

		const shouldUpdate = invokeClassMethod<[unknown, unknown, unknown], unknown>(
			instance.shouldComponentUpdate,
			instance,
			newProps,
			newState,
			nextContext
		);

		if (__DEV__) {
			if (shouldUpdate === undefined) {
				console.error(
					'%s.shouldComponentUpdate(): Returned nil instead of a boolean value. Make sure to return true or false.',
					getComponentName(ctor) ?? 'Component'
				);
			}
		}

		return shouldUpdate as boolean | undefined;
	}

	const ctorRecord = ctor as UnknownRecord;
	if (typeOf(ctor) === 'table' && ctorRecord.isPureReactComponent) {
		return (
			!shallowEqual(oldProps as defined, newProps as defined) ||
			!shallowEqual(oldState as defined, newState as defined)
		);
	}

	return true;
}

function checkClassInstance(workInProgress: Fiber, ctor: unknown, newProps: unknown): void {
	const instance = workInProgress.stateNode as ComponentInstance;
	const ctorRecord = ctor as UnknownRecord;

	if (__DEV__) {
		const name = getComponentName(ctor) ?? 'Component';
		const renderPresent = instance.render;

		if (!renderPresent) {
			if (typeOf(ctorRecord.render) === 'function') {
				console.error(
					'%s(...): No `render` method found on the returned component instance: did you accidentally return an object from the constructor?',
					name
				);
			} else {
				console.error(
					'%s(...): No `render` method found on the returned component instance: you may have forgotten to define `render`.',
					name
				);
			}
		}

		const getInitialState = instance.getInitialState as UnknownRecord | undefined;
		if (getInitialState && !getInitialState.isReactClassApproved && !instance.state) {
			console.error(
				'getInitialState was defined on %s, a plain JavaScript class. This is only supported for classes created using React.createClass. Did you mean to define a state property instead?',
				name
			);
		}
		const getDefaultProps = instance.getDefaultProps as UnknownRecord | undefined;
		if (getDefaultProps && !getDefaultProps.isReactClassApproved) {
			console.error(
				'getDefaultProps was defined on %s, a plain JavaScript class. This is only supported for classes created using React.createClass. Use a static property to define defaultProps instead.',
				name
			);
		}

		if (instance.propTypes && !ctorRecord.propTypes) {
			console.error(
				'propTypes was defined as an instance property on %s. Use a static property to define propTypes instead.',
				name
			);
		}
		if (instance.contextType && !ctorRecord.contextType) {
			console.error(
				'contextType was defined as an instance property on %s. Use a static property to define contextType instead.',
				name
			);
		}

		if (disableLegacyContext) {
			if (ctorRecord.childContextTypes) {
				console.error(
					'%s uses the legacy childContextTypes API which is no longer supported. Use React.createContext() instead.',
					name
				);
			}
			if (ctorRecord.contextTypes) {
				console.error(
					'%s uses the legacy contextTypes API which is no longer supported. Use React.createContext() with static contextType instead.',
					name
				);
			}
		} else {
			if (instance.contextTypes && !ctorRecord.contextTypes) {
				console.error(
					'contextTypes was defined as an instance property on %s. Use a static property to define contextTypes instead.',
					name
				);
			}

			if (
				typeOf(ctor) === 'table' &&
				ctorRecord.contextType &&
				ctorRecord.contextTypes &&
				!didWarnAboutContextTypeAndContextTypes!.has(ctor as defined)
			) {
				didWarnAboutContextTypeAndContextTypes!.set(ctor as defined, true);
				console.error(
					'%s declares both contextTypes and contextType static properties. The legacy contextTypes property will be ignored.',
					name
				);
			}
		}

		if (typeOf(instance.componentShouldUpdate) === 'function') {
			console.error(
				'%s has a method called componentShouldUpdate(). Did you mean shouldComponentUpdate()? The name is phrased as a question because the function is expected to return a value.',
				name
			);
		}
		if (
			typeOf(ctor) === 'table' &&
			ctorRecord.isPureReactComponent &&
			instance.shouldComponentUpdate !== undefined
		) {
			console.error(
				'%s has a method called shouldComponentUpdate(). shouldComponentUpdate should not be used when extending React.PureComponent. Please extend React.Component if shouldComponentUpdate is used.',
				getComponentName(ctor) ?? 'A pure component'
			);
		}
		if (typeOf(instance.componentDidUnmount) === 'function') {
			console.error(
				'%s has a method called componentDidUnmount(). But there is no such lifecycle method. Did you mean componentWillUnmount()?',
				name
			);
		}
		if (typeOf(instance.componentDidReceiveProps) === 'function') {
			console.error(
				'%s has a method called componentDidReceiveProps(). But there is no such lifecycle method. If you meant to update the state in response to changing props, use componentWillReceiveProps(). If you meant to fetch data or run side-effects or mutations after React has updated the UI, use componentDidUpdate().',
				name
			);
		}
		if (typeOf(instance.componentWillRecieveProps) === 'function') {
			console.error(
				'%s has a method called componentWillRecieveProps(). Did you mean componentWillReceiveProps()?',
				name
			);
		}
		if (typeOf(instance.UNSAFE_componentWillRecieveProps) === 'function') {
			console.error(
				'%s has a method called UNSAFE_componentWillRecieveProps(). Did you mean UNSAFE_componentWillReceiveProps()?',
				name
			);
		}
		const hasMutatedProps = instance.props !== newProps;
		if (instance.props !== undefined && hasMutatedProps) {
			console.error(
				"%s(...): When calling super() in `%s`, make sure to pass up the same props that your component's constructor was passed.",
				name,
				name
			);
		}
		if (rawget(instance as object, 'defaultProps') !== undefined) {
			console.error(
				'Setting defaultProps as an instance property on %s is not supported and will be ignored. Instead, define defaultProps as a static property on %s.',
				name,
				name
			);
		}

		if (
			typeOf(instance.getSnapshotBeforeUpdate) === 'function' &&
			typeOf(instance.componentDidUpdate) !== 'function' &&
			!didWarnAboutGetSnapshotBeforeUpdateWithoutDidUpdate!.has(ctor as defined)
		) {
			didWarnAboutGetSnapshotBeforeUpdateWithoutDidUpdate!.set(ctor as defined, true);
			console.error(
				'%s: getSnapshotBeforeUpdate() should be used with componentDidUpdate(). This component defines getSnapshotBeforeUpdate() only.',
				getComponentName(ctor)
			);
		}

		const state = instance.state;
		if (state !== undefined && typeOf(state) !== 'table') {
			console.error('%s.state: must be set to an object or nil', name);
		}
		if (
			typeOf(ctor) === 'table' &&
			typeOf(instance.getChildContext) === 'function' &&
			typeOf(ctorRecord.childContextTypes) !== 'table'
		) {
			console.error(
				'%s.getChildContext(): childContextTypes must be defined in order to use getChildContext().',
				name
			);
		}
	}
}

/**
 * Associates a public class instance with its internal fiber.
 */
export function adoptClassInstance(workInProgress: Fiber, instance: unknown): void {
	const classInstance = instance as ComponentInstance;
	classInstance.__updater = getClassComponentUpdater();
	workInProgress.stateNode = classInstance;
	setInstance(classInstance as UnknownRecord, workInProgress);
	if (__DEV__) {
		(classInstance as UnknownRecord)._reactInternalInstance = fakeInternalInstance;
	}
}

/**
 * Constructs a class instance and initializes context, state, and warnings.
 */
export function constructClassInstance(workInProgress: Fiber, ctor: unknown, props: unknown): unknown {
	let isLegacyContextConsumer = false;
	let unmaskedContext = emptyContextObject;
	let context = emptyContextObject;
	const ctorRecord = ctor as ClassComponentCtor;
	const contextType = ctorRecord.contextType;

	if (__DEV__) {
		if (ctorRecord.contextType !== undefined) {
			const contextTypeRecord = contextType as UnknownRecord | undefined;
			const isValid =
				contextType === undefined ||
				(contextTypeRecord?.$$typeof === REACT_CONTEXT_TYPE && contextTypeRecord?._context === undefined);

			if (!isValid && !didWarnAboutInvalidateContextType!.has(ctor as defined)) {
				didWarnAboutInvalidateContextType!.set(ctor as defined, true);

				let addendum = '';
				if (contextType === undefined) {
					addendum =
						' However, it is set to nil. This can be caused by a typo or by mixing up named and default imports. This can also happen due to a circular dependency, so try moving the createContext() call to a separate file.';
				} else if (typeOf(contextType) !== 'table') {
					addendum = ` However, it is set to a ${typeOf(contextType)}.`;
				} else if (contextTypeRecord?.$$typeof === REACT_PROVIDER_TYPE) {
					addendum = ' Did you accidentally pass the Context.Provider instead?';
				} else if (contextTypeRecord?._context !== undefined) {
					addendum = ' Did you accidentally pass the Context.Consumer instead?';
				} else {
					addendum += ' However, it is set to an object with keys {';
					for (const [key] of pairs(contextType as UnknownRecord)) {
						addendum += `${tostring(key)}, `;
					}
					addendum += '}.';
				}
				console.error(
					'%s defines an invalid contextType. contextType should point to the Context object returned by React.createContext().%s',
					getComponentName(ctor) ?? 'Component',
					addendum
				);
			}
		}
	}

	if (contextType !== undefined && typeOf(contextType) === 'table') {
		context = readContext(contextType as ReactContext<Object>);
	} else if (!disableLegacyContext) {
		unmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
		const contextTypes = ctorRecord.contextTypes;
		isLegacyContextConsumer = contextTypes !== undefined;
		context = isLegacyContextConsumer ? getMaskedContext(workInProgress, unmaskedContext) : emptyContextObject;
	}

	if (__DEV__) {
		if (debugRenderPhaseSideEffectsForStrictMode && bit32.band(workInProgress.mode, StrictMode) !== 0) {
			disableLogs();
			const [ok, result] = xpcall(
				ctorRecord.new as (props_: unknown, context_: unknown) => unknown,
				describeError,
				props,
				context
			) as LuaTuple<[boolean, unknown]>;
			reenableLogs();
			if (!ok) {
				error(result);
			}
		}
	}

	const instance = (ctorRecord.new as (props_: unknown, context_: unknown) => ComponentInstance)(props, context);
	workInProgress.memoizedState = instance.state;
	const state = workInProgress.memoizedState;
	adoptClassInstance(workInProgress, instance);

	if (__DEV__) {
		if (typeOf(ctorRecord.getDerivedStateFromProps) === 'function' && (state as unknown) === UninitializedState) {
			const componentName = getComponentName(ctor) ?? 'Component';
			if (!didWarnAboutUninitializedState!.has(componentName)) {
				didWarnAboutUninitializedState!.set(componentName, true);
				console.error(
					'`%s` uses `getDerivedStateFromProps` but its initial state has not been initialized. This is not recommended. Instead, define the initial state by passing an object to `self:setState` in the `init` method of `%s`. This ensures that `getDerivedStateFromProps` arguments have a consistent shape.',
					componentName,
					componentName
				);
			}
		}

		if (
			typeOf(ctorRecord.getDerivedStateFromProps) === 'function' ||
			typeOf(instance.getSnapshotBeforeUpdate) === 'function'
		) {
			let foundWillMountName: string | undefined;
			let foundWillReceivePropsName: string | undefined;
			let foundWillUpdateName: string | undefined;
			if (typeOf(instance.componentWillMount) === 'function') {
				foundWillMountName = 'componentWillMount';
			} else if (typeOf(instance.UNSAFE_componentWillMount) === 'function') {
				foundWillMountName = 'UNSAFE_componentWillMount';
			}
			if (typeOf(instance.componentWillReceiveProps) === 'function') {
				foundWillReceivePropsName = 'componentWillReceiveProps';
			} else if (typeOf(instance.UNSAFE_componentWillReceiveProps) === 'function') {
				foundWillReceivePropsName = 'UNSAFE_componentWillReceiveProps';
			}
			if (typeOf(instance.componentWillUpdate) === 'function') {
				foundWillUpdateName = 'componentWillUpdate';
			} else if (typeOf(instance.UNSAFE_componentWillUpdate) === 'function') {
				foundWillUpdateName = 'UNSAFE_componentWillUpdate';
			}
			if (
				foundWillMountName !== undefined ||
				foundWillReceivePropsName !== undefined ||
				foundWillUpdateName !== undefined
			) {
				const componentName = getComponentName(ctor) ?? 'Component';
				const newApiName =
					typeOf(ctorRecord.getDerivedStateFromProps) === 'function'
						? 'getDerivedStateFromProps()'
						: 'getSnapshotBeforeUpdate()';
				const willMountName = foundWillMountName !== undefined ? `\n  ${tostring(foundWillMountName)}` : '';
				const willReceievePropsName =
					foundWillReceivePropsName !== undefined ? `\n  ${tostring(foundWillReceivePropsName)}` : '';
				const willUpdateName = foundWillUpdateName !== undefined ? `\n  ${tostring(foundWillUpdateName)}` : '';

				if (!didWarnAboutLegacyLifecyclesAndDerivedState!.has(componentName)) {
					didWarnAboutLegacyLifecyclesAndDerivedState!.set(componentName, true);
					console.error(
						'Unsafe legacy lifecycles will not be called for components using new component APIs.\n\n%s uses %s but also contains the following legacy lifecycles:%s%s%s\n\nThe above lifecycles should be removed. Learn more about this warning here:\nhttps://reactjs.org/link/unsafe-component-lifecycles',
						componentName,
						newApiName,
						willMountName,
						willReceievePropsName,
						willUpdateName
					);
				}
			}
		}
	}

	if (isLegacyContextConsumer) {
		cacheContext(workInProgress, unmaskedContext, context);
	}

	return instance;
}

function callComponentWillMount(workInProgress: Fiber, instance: ComponentInstance): void {
	const oldState = instance.state;

	if (instance.componentWillMount !== undefined && typeOf(instance.componentWillMount) === 'function') {
		invokeClassMethod<[], void>(instance.componentWillMount, instance);
	}
	if (instance.UNSAFE_componentWillMount !== undefined && typeOf(instance.UNSAFE_componentWillMount) === 'function') {
		invokeClassMethod<[], void>(instance.UNSAFE_componentWillMount, instance);
	}

	if (oldState !== instance.state) {
		if (__DEV__) {
			console.error(
				"%s.componentWillMount(): Assigning directly to this.state is deprecated (except inside a component's constructor). Use setState instead.",
				getComponentName(workInProgress.type) ?? 'Component'
			);
		}
		getClassComponentUpdater().enqueueReplaceState(instance, instance.state);
	}
}

function callComponentWillReceiveProps(
	workInProgress: Fiber,
	instance: ComponentInstance,
	newProps: unknown,
	nextContext: unknown
): void {
	const oldState = instance.state;
	if (instance.componentWillReceiveProps !== undefined && typeOf(instance.componentWillReceiveProps) === 'function') {
		invokeClassMethod<[unknown, unknown], void>(
			instance.componentWillReceiveProps,
			instance,
			newProps,
			nextContext
		);
	}
	if (
		instance.UNSAFE_componentWillReceiveProps !== undefined &&
		typeOf(instance.UNSAFE_componentWillReceiveProps) === 'function'
	) {
		invokeClassMethod<[unknown, unknown], void>(
			instance.UNSAFE_componentWillReceiveProps,
			instance,
			newProps,
			nextContext
		);
	}

	if (instance.state !== oldState) {
		if (__DEV__) {
			const componentName = getComponentName(workInProgress.type) ?? 'Component';
			if (!didWarnAboutStateAssignmentForComponent!.has(componentName)) {
				didWarnAboutStateAssignmentForComponent!.set(componentName, true);
				console.error(
					"%s.componentWillReceiveProps(): Assigning directly to this.state is deprecated (except inside a component's constructor). Use setState instead.",
					componentName
				);
			}
		}
		getClassComponentUpdater().enqueueReplaceState(instance, instance.state);
	}
}

/**
 * Runs mount lifecycles for a class instance that has never rendered.
 */
export function mountClassInstance(workInProgress: Fiber, ctor: unknown, newProps: unknown, renderLanes: Lanes): void {
	if (__DEV__) {
		checkClassInstance(workInProgress, ctor, newProps);
	}

	const instance = workInProgress.stateNode as ComponentInstance;
	instance.props = newProps;
	instance.state = workInProgress.memoizedState;
	instance.__refs = emptyRefsObject;

	initializeUpdateQueue(workInProgress);

	let contextType: unknown;
	if (typeOf(ctor) === 'table') {
		contextType = (ctor as UnknownRecord).contextType;
	}
	if (contextType !== undefined && typeOf(contextType) === 'table') {
		instance.context = readContext(contextType as ReactContext<unknown>);
	} else if (disableLegacyContext) {
		instance.context = emptyContextObject;
	} else {
		const unmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
		instance.context = getMaskedContext(workInProgress, unmaskedContext);
	}

	if (__DEV__) {
		if (instance.state === newProps) {
			const componentName = getComponentName(ctor) ?? 'Component';
			if (!didWarnAboutDirectlyAssigningPropsToState!.has(componentName)) {
				didWarnAboutDirectlyAssigningPropsToState!.set(componentName, true);
				console.error(
					"%s: It is not recommended to assign props directly to state because updates to props won't be reflected in state. In most cases, it is better to use props directly.",
					componentName
				);
			}
		}

		if (bit32.band(workInProgress.mode, StrictMode) !== 0) {
			ReactStrictModeWarnings.recordLegacyContextWarning(workInProgress, instance);
		}

		if (warnAboutDeprecatedLifecycles) {
			ReactStrictModeWarnings.recordUnsafeLifecycleWarnings(workInProgress, instance);
		}
	}

	processUpdateQueue(workInProgress, newProps, instance, renderLanes);
	instance.state = workInProgress.memoizedState;

	const typeofCtor = typeOf(ctor);
	let getDerivedStateFromProps: unknown;
	if (typeOf(ctor) === 'table') {
		getDerivedStateFromProps = (ctor as UnknownRecord).getDerivedStateFromProps;
	}
	if (getDerivedStateFromProps !== undefined && typeOf(getDerivedStateFromProps) === 'function') {
		applyDerivedStateFromProps(
			workInProgress,
			ctor as React_Component<unknown, unknown>,
			getDerivedStateFromProps as (props: unknown, state: unknown) => unknown,
			newProps
		);
		instance.state = workInProgress.memoizedState;
	}

	if (
		typeofCtor === 'table' &&
		typeOf((ctor as UnknownRecord).getDerivedStateFromProps) !== 'function' &&
		typeOf(instance.getSnapshotBeforeUpdate) !== 'function' &&
		(typeOf(instance.UNSAFE_componentWillMount) === 'function' ||
			typeOf(instance.componentWillMount) === 'function')
	) {
		callComponentWillMount(workInProgress, instance);
		processUpdateQueue(workInProgress, newProps, instance, renderLanes);
		instance.state = workInProgress.memoizedState;
	}

	if (typeOf(instance.componentDidMount) === 'function') {
		if (__DEV__ && enableDoubleInvokingEffects) {
			workInProgress.flags = bit32.bor(workInProgress.flags, bit32.bor(MountLayoutDev, Update));
		} else {
			workInProgress.flags = bit32.bor(workInProgress.flags, Update);
		}
	}
}

/**
 * Continues a mount pass for a class fiber and returns whether it should render.
 */
export function resumeMountClassInstance(
	workInProgress: Fiber,
	ctor: unknown,
	newProps: unknown,
	renderLanes: Lanes
): boolean {
	const instance = workInProgress.stateNode as ComponentInstance;

	const oldProps = workInProgress.memoizedProps;
	instance.props = oldProps;

	const oldContext = instance.context;
	const ctorRecord = ctor as UnknownRecord;
	const contextType = ctorRecord.contextType;
	let nextContext = emptyContextObject;

	if (contextType !== undefined && typeOf(contextType) === 'table') {
		nextContext = readContext(contextType as ReactContext<Object>);
	} else if (!disableLegacyContext) {
		const nextLegacyUnmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
		nextContext = getMaskedContext(workInProgress, nextLegacyUnmaskedContext);
	}

	const getDerivedStateFromProps = ctorRecord.getDerivedStateFromProps;
	const hasNewLifecycles =
		typeOf(getDerivedStateFromProps) === 'function' || typeOf(instance.getSnapshotBeforeUpdate) === 'function';

	if (
		!hasNewLifecycles &&
		(typeOf(instance.UNSAFE_componentWillReceiveProps) === 'function' ||
			typeOf(instance.componentWillReceiveProps) === 'function')
	) {
		if ((oldProps as unknown) !== newProps || oldContext !== nextContext) {
			callComponentWillReceiveProps(workInProgress, instance, newProps, nextContext);
		}
	}

	resetHasForceUpdateBeforeProcessing();

	const oldState = workInProgress.memoizedState;
	instance.state = oldState;
	let newState = oldState;
	processUpdateQueue(workInProgress, newProps, instance, renderLanes);
	newState = workInProgress.memoizedState;
	if (
		(oldProps as unknown) === newProps &&
		(oldState as unknown) === (newState as unknown) &&
		!hasContextChanged() &&
		!checkHasForceUpdateAfterProcessing()
	) {
		if (typeOf(instance.componentDidMount) === 'function') {
			if (__DEV__ && enableDoubleInvokingEffects) {
				workInProgress.flags = bit32.bor(workInProgress.flags, MountLayoutDev, Update);
			} else {
				workInProgress.flags = bit32.bor(workInProgress.flags, Update);
			}
		}
		return false;
	}

	if (getDerivedStateFromProps !== undefined && typeOf(getDerivedStateFromProps) === 'function') {
		applyDerivedStateFromProps(
			workInProgress,
			ctor as React_Component<unknown, unknown>,
			getDerivedStateFromProps as (props: unknown, state: unknown) => unknown,
			newProps
		);
		newState = workInProgress.memoizedState;
	}

	const shouldUpdate =
		checkHasForceUpdateAfterProcessing() ||
		checkShouldComponentUpdate(workInProgress, ctor, oldProps, newProps, oldState, newState, nextContext);

	if (shouldUpdate) {
		if (
			!hasNewLifecycles &&
			(typeOf(instance.UNSAFE_componentWillMount) === 'function' ||
				typeOf(instance.componentWillMount) === 'function')
		) {
			if (typeOf(instance.componentWillMount) === 'function') {
				invokeClassMethod<[], void>(instance.componentWillMount, instance);
			}
			if (typeOf(instance.UNSAFE_componentWillMount) === 'function') {
				invokeClassMethod<[], void>(instance.UNSAFE_componentWillMount, instance);
			}
		}
		if (typeOf(instance.componentDidMount) === 'function') {
			if (__DEV__ && enableDoubleInvokingEffects) {
				workInProgress.flags = bit32.bor(workInProgress.flags, MountLayoutDev, Update);
			} else {
				workInProgress.flags = bit32.bor(workInProgress.flags, Update);
			}
		}
	} else {
		if (typeOf(instance.componentDidMount) === 'function') {
			if (__DEV__ && enableDoubleInvokingEffects) {
				workInProgress.flags = bit32.bor(workInProgress.flags, MountLayoutDev, Update);
			} else {
				workInProgress.flags = bit32.bor(workInProgress.flags, Update);
			}
		}

		workInProgress.memoizedProps = newProps;
		workInProgress.memoizedState = newState;
	}

	instance.props = newProps;
	instance.state = newState;
	instance.context = nextContext;

	return shouldUpdate as boolean;
}

/**
 * Runs update lifecycles for an existing class instance.
 */
export function updateClassInstance(
	current: Fiber,
	workInProgress: Fiber,
	ctor: unknown,
	newProps: unknown,
	renderLanes: Lanes
): boolean {
	const instance = workInProgress.stateNode as ComponentInstance;

	cloneUpdateQueue(current, workInProgress);

	const unresolvedOldProps = workInProgress.memoizedProps;
	const oldProps =
		(workInProgress.type as unknown) === (workInProgress.elementType as unknown)
			? unresolvedOldProps
			: resolveDefaultProps(workInProgress.type, unresolvedOldProps as Record<string, defined | undefined>);
	instance.props = oldProps;
	const unresolvedNewProps = workInProgress.pendingProps;

	const oldContext = instance.context;
	let contextType: unknown;
	let getDerivedStateFromProps: unknown;
	if (typeOf(ctor) === 'table') {
		const ctorRecord = ctor as UnknownRecord;
		contextType = ctorRecord.contextType;
		getDerivedStateFromProps = ctorRecord.getDerivedStateFromProps;
	}
	let nextContext = emptyContextObject;
	if (typeOf(contextType) === 'table') {
		nextContext = readContext(contextType as ReactContext<Object>);
	} else if (!disableLegacyContext) {
		const nextUnmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
		nextContext = getMaskedContext(workInProgress, nextUnmaskedContext);
	}

	const hasNewLifecycles =
		(getDerivedStateFromProps !== undefined && typeOf(getDerivedStateFromProps) === 'function') ||
		(instance.getSnapshotBeforeUpdate !== undefined && typeOf(instance.getSnapshotBeforeUpdate) === 'function');

	if (
		!hasNewLifecycles &&
		((instance.UNSAFE_componentWillReceiveProps !== undefined &&
			typeOf(instance.UNSAFE_componentWillReceiveProps) === 'function') ||
			(instance.componentWillReceiveProps !== undefined &&
				typeOf(instance.componentWillReceiveProps) === 'function'))
	) {
		if ((unresolvedOldProps as unknown) !== (unresolvedNewProps as unknown) || oldContext !== nextContext) {
			callComponentWillReceiveProps(workInProgress, instance, newProps, nextContext);
		}
	}

	resetHasForceUpdateBeforeProcessing();

	const oldState = workInProgress.memoizedState;
	instance.state = oldState;
	let newState = instance.state;
	processUpdateQueue(workInProgress, newProps, instance, renderLanes);
	newState = workInProgress.memoizedState;

	if (
		(unresolvedOldProps as unknown) === (unresolvedNewProps as unknown) &&
		(oldState as unknown) === (newState as unknown) &&
		!hasContextChanged() &&
		!checkHasForceUpdateAfterProcessing()
	) {
		if (instance.componentDidUpdate !== undefined && typeOf(instance.componentDidUpdate) === 'function') {
			if (
				(unresolvedOldProps as unknown) !== (current.memoizedProps as unknown) ||
				(oldState as unknown) !== (current.memoizedState as unknown)
			) {
				workInProgress.flags = bit32.bor(workInProgress.flags, Update);
			}
		}
		if (instance.getSnapshotBeforeUpdate !== undefined && typeOf(instance.getSnapshotBeforeUpdate) === 'function') {
			if (
				(unresolvedOldProps as unknown) !== (current.memoizedProps as unknown) ||
				(oldState as unknown) !== (current.memoizedState as unknown)
			) {
				workInProgress.flags = bit32.bor(workInProgress.flags, Snapshot);
			}
		}
		return false;
	}

	if (getDerivedStateFromProps !== undefined && typeOf(getDerivedStateFromProps) === 'function') {
		applyDerivedStateFromProps(
			workInProgress,
			ctor as React_Component<unknown, unknown>,
			getDerivedStateFromProps as (props: unknown, state: unknown) => unknown,
			newProps
		);
		newState = workInProgress.memoizedState;
	}

	const shouldUpdate =
		checkHasForceUpdateAfterProcessing() ||
		checkShouldComponentUpdate(workInProgress, ctor, oldProps, newProps, oldState, newState, nextContext);

	if (shouldUpdate) {
		if (
			!hasNewLifecycles &&
			((instance.UNSAFE_componentWillUpdate !== undefined &&
				typeOf(instance.UNSAFE_componentWillUpdate) === 'function') ||
				(instance.componentWillUpdate !== undefined && typeOf(instance.componentWillUpdate) === 'function'))
		) {
			if (instance.componentWillUpdate !== undefined && typeOf(instance.componentWillUpdate) === 'function') {
				invokeClassMethod<[unknown, unknown, unknown], void>(
					instance.componentWillUpdate,
					instance,
					newProps,
					newState,
					nextContext
				);
			}
			if (
				instance.UNSAFE_componentWillUpdate !== undefined &&
				typeOf(instance.UNSAFE_componentWillUpdate) === 'function'
			) {
				invokeClassMethod<[unknown, unknown, unknown], void>(
					instance.UNSAFE_componentWillUpdate,
					instance,
					newProps,
					newState,
					nextContext
				);
			}
		}
		if (instance.componentDidUpdate !== undefined && typeOf(instance.componentDidUpdate) === 'function') {
			workInProgress.flags = bit32.bor(workInProgress.flags, Update);
		}
		if (instance.getSnapshotBeforeUpdate !== undefined && typeOf(instance.getSnapshotBeforeUpdate) === 'function') {
			workInProgress.flags = bit32.bor(workInProgress.flags, Snapshot);
		}
	} else {
		if (instance.componentDidUpdate !== undefined && typeOf(instance.componentDidUpdate) === 'function') {
			if (
				(unresolvedOldProps as unknown) !== (current.memoizedProps as unknown) ||
				(oldState as unknown) !== (current.memoizedState as unknown)
			) {
				workInProgress.flags = bit32.bor(workInProgress.flags, Update);
			}
		}
		if (instance.getSnapshotBeforeUpdate !== undefined && typeOf(instance.getSnapshotBeforeUpdate) === 'function') {
			if (
				(unresolvedOldProps as unknown) !== (current.memoizedProps as unknown) ||
				(oldState as unknown) !== (current.memoizedState as unknown)
			) {
				workInProgress.flags = bit32.bor(workInProgress.flags, Snapshot);
			}
		}

		workInProgress.memoizedProps = newProps;
		workInProgress.memoizedState = newState;
	}

	instance.props = newProps;
	instance.state = newState;
	instance.context = nextContext;

	return shouldUpdate as boolean;
}

export { emptyRefsObject };

export default {
	adoptClassInstance,
	constructClassInstance,
	mountClassInstance,
	resumeMountClassInstance,
	updateClassInstance,
	applyDerivedStateFromProps,
	emptyRefsObject,
};
