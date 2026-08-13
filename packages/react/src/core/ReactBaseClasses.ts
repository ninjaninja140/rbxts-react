/**
 * Base classes for class components.
 *
 * This module defines the `Component` and `PureComponent` base classes that
 * user components extend. Unlike the original Luau runtime (which simulated
 * classes with metatables and an `extend` method), these are real roblox-ts
 * classes, so `class MyComponent extends React.Component<Props, State>` works
 * exactly like it does in JavaScript React.
 *
 * The reconciler recognises class components by their `isReactComponent`
 * static flag and constructs them through the `new` entry point that
 * roblox-ts generates for every class.
 *
 * @module ReactBaseClasses
 * @packageDocumentation
 */

import { __DEV__, __COMPAT_WARNINGS__ } from '@nrbx/react-globals';
import { assign, console, freeze, getComponentName, UninitializedState } from '@nrbx/react-shared';
import ReactNoopUpdateQueue from './ReactNoopUpdateQueue';

/**
 * The shape of an update queue object. Before a component mounts this is the
 * no-op queue; the reconciler swaps in the real fiber-backed queue afterwards.
 *
 * The methods are declared as function-valued properties (rather than
 * TypeScript methods) so that roblox-ts emits plain `.` calls with the
 * component instance passed explicitly as the first argument. This mirrors the
 * original Luau runtime, where the update queue stores plain functions.
 *
 * @internal
 */
export interface UpdateQueue {
	isMounted: (instance: unknown) => boolean;
	enqueueForceUpdate: (instance: unknown, callback?: unknown, callerName?: string) => void;
	enqueueReplaceState: (instance: unknown, completeState?: unknown, callback?: unknown, callerName?: string) => void;
	enqueueSetState: (instance: unknown, partialState?: unknown, callback?: unknown, callerName?: string) => void;
}

/**
 * The shared frozen object used for `refs` until a component actually opts in
 * to string refs. The reconciler compares against it to decide whether it
 * needs to build a real refs container.
 *
 * @internal
 */
const emptyObject: Record<string, never> = {};
if (__DEV__) {
	freeze(emptyObject);
}

/**
 * Loose view of a component instance used by the helper functions below.
 *
 * @internal
 */
type ComponentInstance = {
	props: unknown;
	state: unknown;
	__componentName: string;
	__updater: UpdateQueue;
};

/**
 * Merge a state update issued from inside `init`. `setState` is synchronous
 * during initialisation because there is no mounted queue to schedule against
 * yet.
 *
 * @internal
 */
function setStateInInit(componentInstance: ComponentInstance, statePayload: unknown, callback: unknown): void {
	if (__DEV__ && callback !== undefined) {
		console.warn(
			'Received a `callback` argument to `setState` during initialization of ' +
				'"%s". The callback behavior is not supported when using `setState` ' +
				'in `init`.\n\nConsider defining similar behavior in a ' +
				'`componentDidMount` method instead.',
			componentInstance.__componentName
		);
	}

	const payloadType = statePayload !== undefined ? type(statePayload) : 'nil';
	if (statePayload === undefined || (payloadType !== 'table' && payloadType !== 'function')) {
		error(
			'setState(...): takes an object of state variables to update or a ' +
				'function which returns an object of state variables.'
		);
	}

	const prevState = componentInstance.state;
	const partialState =
		payloadType === 'function'
			? (statePayload as (prevState: unknown, props: unknown) => unknown)(prevState, componentInstance.props)
			: statePayload;

	componentInstance.state = assign({}, prevState as object, partialState as object);
}

/**
 * The base class for stateful class components.
 *
 * ```tsx
 * class Counter extends React.Component<{}, { count: number }> {
 *     public init() {
 *         this.setState({ count: 0 });
 *     }
 *
 *     public render() {
 *         return <textlabel Text={`Count: ${this.state.count}`} />;
 *     }
 * }
 * ```
 *
 * The `init` method (the roblox-ts equivalent of a constructor) may assign
 * `state` directly or call `setState`; both are applied synchronously before
 * the component mounts.
 */
export class Component<Props, State = undefined> {
	/** The props passed to this component. Treat as read-only. */
	public props: Props;
	/** The legacy context value (use the context API instead). */
	public context: unknown;
	/** The current state. Assign directly only inside `init`. */
	public state: State;
	/** Ref container for legacy string refs. */
	public __refs: unknown;
	/** The active update queue (no-op until mounted). */
	public __updater: UpdateQueue;
	/** Display name used in warnings and error messages. */
	public __componentName: string;
	/** True while the `init` method is executing. */
	public __inInit: boolean;

	public static isReactComponent = true;
	public static __refs: unknown = emptyObject;

	/**
	 * Constructs the component. The reconciler invokes this through the class
	 * `new` entry point; users rarely call it directly.
	 */
	public constructor(props: Props, context?: unknown) {
		this.props = props;
		this.context = context;
		this.state = UninitializedState as unknown as State;
		this.__refs = emptyObject;
		this.__updater = ReactNoopUpdateQueue;
		this.__componentName = getComponentName(getmetatable(this)) ?? 'ReactClass';
		this.__inInit = false;

		// Legacy Roact-style components define an `init` method instead of a
		// constructor. Run it (if the subclass defines one) so `setState` works
		// synchronously during initialisation.
		const init = (this as unknown as Record<string, unknown>).init;
		if (type(init) === 'function') {
			this.__inInit = true;
			(init as (self: unknown, props: unknown, context: unknown) => void)(this, props, context);
			this.__inInit = false;
		}
	}

	/**
	 * Creates a legacy-style component class with an explicit display name.
	 *
	 * This exists for compatibility with the original Roact `Component:extend`
	 * API. New code should use `class MyComponent extends React.Component`
	 * instead, which gives you full type checking for free.
	 */
	public static extend(name: string): typeof Component {
		if (name === undefined) {
			if (__COMPAT_WARNINGS__) {
				console.warn(
					'Component:extend() accepting no arguments is deprecated, and will ' +
						'not be supported in a future version of Roact. Please provide an explicit name.'
				);
			}
			name = '';
		} else if (type(name) !== 'string') {
			error('Component class name must be a string');
		}

		class Extended extends Component<unknown, unknown> {}
		(Extended as unknown as Record<string, unknown>).__componentName = name;
		(Extended as unknown as Record<string, unknown>).displayName = name;
		return Extended as unknown as typeof Component;
	}

	/**
	 * Schedules a partial state update.
	 *
	 * `partialState` may be an object to shallow-merge, or a function of
	 * `(state, props)` returning the object to merge. The update is batched by
	 * the reconciler and may not be applied synchronously.
	 */
	public setState(
		partialState: Partial<State> | ((prevState: State, props: Props) => Partial<State>),
		callback?: () => void
	): void {
		const payload = partialState as unknown;
		const payloadType = payload !== undefined ? type(payload) : 'nil';
		if (payload !== undefined && payloadType !== 'table' && payloadType !== 'function') {
			error(
				'setState(...): takes an object of state variables to update or a ' +
					'function which returns an object of state variables.'
			);
		}

		if (this.__inInit) {
			setStateInInit(this as unknown as ComponentInstance, payload, callback);
			return;
		}

		this.__updater.enqueueSetState(this, payload, callback, 'setState');
	}

	/**
	 * Forces a re-render even when `shouldComponentUpdate` would bail out.
	 * `shouldComponentUpdate` is skipped, but the normal lifecycle methods
	 * still run.
	 */
	public forceUpdate(callback?: () => void): void {
		this.__updater.enqueueForceUpdate(this, callback, 'forceUpdate');
	}

	/**
	 * Deprecated: always returns `false`. Use lifecycle methods to manage
	 * subscriptions instead.
	 *
	 * @deprecated
	 */
	public isMounted(): boolean {
		if (__DEV__) {
			console.warn(
				'%s(...) is deprecated in plain JavaScript React classes. ' +
					'Instead, make sure to clean up subscriptions and pending requests in ' +
					'componentWillUnmount to prevent memory leaks.',
				'isMounted'
			);
		}
		return false;
	}

	/**
	 * Deprecated: use `setState` instead.
	 *
	 * @deprecated
	 */
	public replaceState(_completeState: unknown, _callback?: () => void): void {
		if (__DEV__) {
			console.warn(
				'%s(...) is deprecated in plain JavaScript React classes. ' +
					'Refactor your code to use setState instead (see ' +
					'https://github.com/facebook/react/issues/3236).',
				'replaceState'
			);
		}
	}
}

/**
 * A `Component` with a default shallow equality check in
 * `shouldComponentUpdate`, so it skips re-rendering when props and state are
 * shallowly equal.
 *
 * ```tsx
 * class Label extends React.PureComponent<{ text: string }> {
 *     public render() {
 *         return <textlabel Text={this.props.text} />;
 *     }
 * }
 * ```
 */
export class PureComponent<Props, State = undefined> extends Component<Props, State> {
	public static isPureReactComponent = true;
}
