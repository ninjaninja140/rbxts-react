/**
 * Reverse-engineered Flow-style component types.
 *
 * These are the internal type shapes for class components, function
 * components, contexts, refs and portals. They mirror the Luau
 * `flowtypes.roblox` module and are used by the reconciler's type contract.
 *
 * @module flowtypes
 * @internal
 * @packageDocumentation
 */

import type { Source } from './ReactElementType';
import type { ReactError } from '../ErrorHandling';

/** Any value renderable by React. */
export type ReactNode = undefined | boolean | number | string | ReactElement<any> | Array<ReactNode>;

/** An element of the given component or host type. */
export interface ReactElement<ElementType> {
	type: ElementType;
	props?: ReactElementProps<ElementType>;
	key: ReactKey | undefined;
	ref: any;
}

/** A class component with no extra behavior beyond {@link ReactComponent}. */
export type ReactPureComponent<Props, State = undefined> = ReactComponent<Props, State>;

export type ReactAbstractComponent<Config, T> = ReactForwardRefComponent<Config, T> | ReactMemoComponent<Config, T>;

interface ReactBaseAbstractComponent<Config, _T> {
	/** @internal */ $$typeof: number;
	displayName?: string;
	defaultProps?: Config;
	name?: string;
}

/** The object shape returned by `React.forwardRef`. */
export interface ReactForwardRefComponent<Config, Instance> extends ReactBaseAbstractComponent<Config, Instance> {
	render: (props: Config, ref: ReactRef<Instance>) => ReactNode;
	[key: string]: any;
}

/** The object shape returned by `React.memo`. */
export interface ReactMemoComponent<Config, T> extends ReactBaseAbstractComponent<Config, T> {
	type: ReactStatelessFunctionalComponent<Config>;
	compare?: (oldProps: Config, newProps: Config) => boolean;
}

export type ReactElementConfig<_C> = Record<string, any>;

/** Base class-component contract. */
export interface ReactComponent<Props, State = undefined> {
	props: Props;
	state: State;
	setState: (
		self: ReactComponent<Props, State>,
		partialState: State | ((state: State, props: Props) => State | undefined),
		callback?: () => void
	) => void;
	forceUpdate: (self: ReactComponent<Props, State>, callback?: () => void) => void;
	init?: (self: ReactComponent<Props, State>, props: Props, context?: unknown) => void;
	render: (self: ReactComponent<Props, State>) => ReactNode;
	componentWillMount?: (self: ReactComponent<Props, State>) => void;
	UNSAFE_componentWillMount?: (self: ReactComponent<Props, State>) => void;
	componentDidMount?: (self: ReactComponent<Props, State>) => void;
	componentWillReceiveProps?: (self: ReactComponent<Props, State>, nextProps: Props, nextContext: unknown) => void;
	UNSAFE_componentWillReceiveProps?: (
		self: ReactComponent<Props, State>,
		nextProps: Props,
		nextContext: unknown
	) => void;
	shouldComponentUpdate?: (
		self: ReactComponent<Props, State>,
		nextProps: Props,
		nextState: State,
		nextContext: unknown
	) => boolean;
	componentWillUpdate?: (
		self: ReactComponent<Props, State>,
		nextProps: Props,
		nextState: State,
		nextContext: unknown
	) => void;
	UNSAFE_componentWillUpdate?: (
		self: ReactComponent<Props, State>,
		nextProps: Props,
		nextState: State,
		nextContext: unknown
	) => void;
	componentDidUpdate?: (
		self: ReactComponent<Props, State>,
		prevProps: Props,
		prevState: State,
		prevContext: unknown
	) => void;
	componentWillUnmount?: (self: ReactComponent<Props, State>) => void;
	componentDidCatch?: (
		self: ReactComponent<Props, State>,
		error: ReactError,
		info: { componentStack: string }
	) => void;
	getDerivedStateFromProps?: (props: Props, state: State) => State | undefined;
	getDerivedStateFromError?: (error: ReactError) => State | undefined;
	getSnapshotBeforeUpdate?: (props: Props, state: State) => unknown;
	__refs: Record<string, any>;
	__updater: any;
	context: any;
	getChildContext: (self: ReactComponent<Props, State>) => unknown;
	__componentName: string;
	displayName?: string;
	name?: string;
	childContextTypes?: unknown;
	contextTypes?: unknown;
	propTypes?: unknown;
	validateProps?: (props: Props) => [boolean, string?];
	defaultProps?: Props;
	[key: string]: any;
}

/** A function component. */
export type ReactStatelessFunctionalComponent<Props> = (props: Props, context: unknown) => ReactNode;

export type ReactComponentType<Config> = ReactComponent<Config, unknown>;

export type ReactElementType = string | ReactComponent<unknown, unknown>;

export interface ReactElementProps<ElementType> {
	ref?: ReactRef<ElementType>;
	key?: ReactKey;
	__source?: Source;
	children?: any;
}

export type ReactElementRef<C> = C;

export type ReactRef<ElementType> =
	| { current: ReactElementRef<ElementType> | undefined }
	| ((value: ReactElementRef<ElementType> | undefined) => void);

export interface ReactContext<T> {
	Provider: ReactComponentType<{ value: T; children?: ReactNode }>;
	Consumer: ReactComponentType<{ children: (value: T) => ReactNode | undefined }>;
}

export type ReactPortal = any;

export type ReactKey = string | number;
