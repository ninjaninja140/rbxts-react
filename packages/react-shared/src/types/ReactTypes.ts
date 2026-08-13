/**
 * Shared type-level contracts used across the React runtime.
 *
 * This module mirrors upstream `ReactTypes.js`. Most exports here are type
 * aliases; the exception is the {@link EventPriority} constants, which are
 * runtime values the reconciler reads directly.
 *
 * @module ReactTypes
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import type { ReactElement } from './ReactElementType';

export type ReactNode<T = any> = ReactElement<T> | ReactPortal | ReactFragment | ReactProvider<T> | ReactConsumer<T>;

/** The empty React fragment value (`undefined`/`boolean`). */
export type ReactEmpty = undefined | boolean;

export type ReactFragment = ReactEmpty | Iterable<ReactNode>;

export type ReactNodeList = ReactEmpty | ReactNode;

export interface ReactProvider<T> {
	/** @internal */ $$typeof: number;
	type: ReactProviderType<T>;
	key: string | undefined;
	ref: undefined;
	props: {
		value: T;
		children?: ReactNodeList;
	};
}

export interface ReactProviderType<T> {
	/** @internal */ $$typeof: number;
	_context: ReactContext<T>;
}

export interface ReactConsumer<T> {
	/** @internal */ $$typeof: number;
	type: ReactContext<T>;
	key: string | undefined;
	ref: undefined;
	props: {
		children: (value: T) => ReactNodeList;
		unstable_observedBits?: number;
	};
}

export interface ReactContext<T> {
	/** @internal */ $$typeof: number;
	Consumer: ReactContext<T>;
	Provider: ReactProviderType<T>;
	_calculateChangedBits?: (a: T, b: T) => number;
	_currentValue: T;
	_currentValue2: T;
	_threadCount: number;
	_currentRenderer?: unknown;
	_currentRenderer2?: unknown;
	displayName?: string;
}

export interface ReactPortal {
	/** @internal */ $$typeof: number;
	key: string | undefined;
	containerInfo: any;
	children: ReactNodeList;
	implementation: any;
}

export interface RefObject<T = unknown> {
	current: T;
}

/**
 * Event dispatch priority tiers. Roblox has no numeric literal types, so this
 * stays a plain number.
 */
export type EventPriority = number;

/** Priority used for discrete events such as clicks and key presses. */
export const DiscreteEvent: EventPriority = 0;
/** Priority used for continuous events such as scrolling. */
export const UserBlockingEvent: EventPriority = 1;
/** Priority used for default events. */
export const ContinuousEvent: EventPriority = 2;

export interface ReactFundamentalComponentInstance<C, H> {
	currentFiber: any;
	instance: any;
	prevProps?: any;
	props: any;
	impl: ReactFundamentalImpl<C, H>;
	state: any;
}

export interface ReactFundamentalImpl<C, H> {
	displayName: string;
	reconcileChildren: boolean;
	getInitialState?: (props: Record<string, unknown>) => Record<string, unknown>;
	getInstance: (a: C, b: Record<string, unknown>, c: Record<string, unknown>) => H;
	getServerSideString?: (a: C, b: Record<string, unknown>) => string;
	getServerSideStringClose?: (a: C, b: Record<string, unknown>) => string;
	onMount: (a: C, b: any, c: Record<string, unknown>, d: Record<string, unknown>) => void;
	shouldUpdate?: (
		a: C,
		b: Record<string, unknown> | undefined,
		c: Record<string, unknown>,
		d: Record<string, unknown>
	) => boolean;
	onUpdate?: (
		a: C,
		b: any,
		c: Record<string, unknown> | undefined,
		d: Record<string, unknown>,
		e: Record<string, unknown>
	) => void;
	onUnmount?: (a: C, b: any, c: Record<string, unknown>, d: Record<string, unknown>) => void;
	onHydrate?: (a: C, b: Record<string, unknown>, c: Record<string, unknown>) => boolean;
	onFocus?: (a: C, b: Record<string, unknown>, c: Record<string, unknown>) => boolean;
}

export interface ReactFundamentalComponent<C, H> {
	/** @internal */ $$typeof: number;
	impl: ReactFundamentalImpl<C, H>;
}

export interface ReactScope {
	/** @internal */ $$typeof: number;
}

export type ReactScopeQuery = (type: string, props: Record<string, any>, instance: any) => boolean;

export interface ReactScopeInstance {
	DO_NOT_USE_queryAllNodes: (query: ReactScopeQuery) => Array<any> | undefined;
	DO_NOT_USE_queryFirstNode: (query: ReactScopeQuery) => any;
	containsNode: (node: any) => boolean;
	getChildContextValues: <T>(context: ReactContext<T>) => Array<T>;
}

/**
 * A Roact-style mutable binding value (Roblox-only feature).
 */
export interface ReactBinding<T = any> {
	getValue: (self: ReactBinding<T>) => T;
	_source?: string;
	map: <U>(self: ReactBinding<T>, mapper: (value: T) => U) => ReactBinding<U>;
}

export type ReactBindingUpdater<T> = (value: T) => void;

/** A source version can be any value that changes with the source. */
export type MutableSourceVersion = unknown;

export type MutableSourceGetSnapshotFn<Source, Snapshot> = (source: Source) => Snapshot;

export type MutableSourceSubscribeFn<Source, Snapshot> = (
	source: Source,
	callback: (snapshot: Snapshot) => void
) => () => void;

export type MutableSourceGetVersionFn = (source: unknown) => MutableSourceVersion;

export interface MutableSource<Source> {
	_source: Source;
	_getVersion: MutableSourceGetVersionFn;
	_workInProgressVersionPrimary?: MutableSourceVersion;
	_workInProgressVersionSecondary?: MutableSourceVersion;
	_currentPrimaryRenderer?: unknown;
	_currentSecondaryRenderer?: unknown;
}

/**
 * A thenable value thrown into Suspense that never resolves to a value.
 */
export interface Wakeable {
	andThen: (self: Wakeable, onFulfill: () => void, onReject: () => void) => Wakeable | undefined;
	__reactDoNotTraceInteractions?: boolean;
}

/**
 * A promise-like value that resolves to `R`.
 */
export interface Thenable<R> {
	andThen: <U>(self: Thenable<R>, onFulfill: (value: R) => U, onReject: (error: any) => U) => void;
}
