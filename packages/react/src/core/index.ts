/**
 * The React core runtime.
 *
 * This barrel assembles the low-level React primitives — elements, classes,
 * hooks, context, and the Roblox binding extension — into the same export
 * object shape the reconciler and renderer expect.
 *
 * @module core
 * @internal
 * @packageDocumentation
 */

import { ReactSharedInternals, ReactSymbols, parseReactError, Event, Change, Tag } from '@nrbx/react-shared';

import * as ReactElement from './ReactElement';
import * as ReactBaseClasses from './ReactBaseClasses';
import * as ReactHooks from './ReactHooks';
import * as ReactContext from './ReactContext';
import * as ReactChildren from './ReactChildren';
import * as ReactCreateRef from './ReactCreateRef';
import * as ReactForwardRef from './ReactForwardRef';
import * as ReactMemo from './ReactMemo';
import * as ReactLazy from './ReactLazy';
import ReactMutableSource from './ReactMutableSource';
import ReactBinding from './ReactBinding';
import None from './None';

const { createElement, cloneElement, isValidElement } = ReactElement;

const { createRef } = ReactCreateRef.default;
const { forwardRef } = ReactForwardRef.default;
const { memo } = ReactMemo.default;
const { lazy } = ReactLazy.default;

const { create: createBinding, join: joinBindings, subscribe: __subscribeToBinding } = ReactBinding;

const React = {
	Children: ReactChildren.default,
	createMutableSource: ReactMutableSource,
	createRef,
	Component: ReactBaseClasses.Component,
	PureComponent: ReactBaseClasses.PureComponent,
	createContext: ReactContext.createContext,
	forwardRef,
	lazy,
	memo,
	useCallback: ReactHooks.useCallback,
	useContext: ReactHooks.useContext,
	useEffect: ReactHooks.useEffect,
	useImperativeHandle: ReactHooks.useImperativeHandle,
	useDebugValue: ReactHooks.useDebugValue,
	useLayoutEffect: ReactHooks.useLayoutEffect,
	useMemo: ReactHooks.useMemo,
	useMutableSource: ReactHooks.useMutableSource,
	useOpaqueIdentifier: ReactHooks.useOpaqueIdentifier,
	useReducer: ReactHooks.useReducer,
	useRef: ReactHooks.useRef,
	useBinding: ReactHooks.useBinding,
	useState: ReactHooks.useState,
	Fragment: ReactSymbols.REACT_FRAGMENT_TYPE,
	Profiler: ReactSymbols.REACT_PROFILER_TYPE,
	StrictMode: ReactSymbols.REACT_STRICT_MODE_TYPE,
	unstable_DebugTracingMode: ReactSymbols.REACT_DEBUG_TRACING_MODE_TYPE,
	Suspense: ReactSymbols.REACT_SUSPENSE_TYPE,
	createElement,
	cloneElement,
	isValidElement,
	__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: ReactSharedInternals,
	unstable_LegacyHidden: ReactSymbols.REACT_LEGACY_HIDDEN_TYPE,
	createBinding,
	joinBindings,
	None,
	__subscribeToBinding,
	Event,
	Change,
	Tag,
	unstable_parseReactError: parseReactError,
};

export default React;

// Named re-exports for the public package surface.
export { Component, PureComponent } from './ReactBaseClasses';
export { createContext } from './ReactContext';
export { createElement, cloneElement, isValidElement } from './ReactElement';
export {
	useCallback,
	useContext,
	useEffect,
	useImperativeHandle,
	useDebugValue,
	useLayoutEffect,
	useMemo,
	useMutableSource,
	useOpaqueIdentifier,
	useReducer,
	useRef,
	useBinding,
	useState,
} from './ReactHooks';
export { mapChildren, forEachChildren, countChildren, onlyChild, toArray } from './ReactChildren';
export { default as createMutableSource } from './ReactMutableSource';
export { createRef, forwardRef, memo, lazy };

// Roblox binding extension — exported by name so the reconciler can import
// these primitives without going through the public `@nrbx/react` entry point
// (which imports the reconciler and would otherwise create a require cycle).
export { createBinding, joinBindings, __subscribeToBinding, None };

// Type re-exports so the public package surface can be built on top.
export type { LazyComponent } from './ReactLazy';
export type { ForwardRefComponent } from './ReactForwardRef';
export type { MemoComponent } from './ReactMemo';
