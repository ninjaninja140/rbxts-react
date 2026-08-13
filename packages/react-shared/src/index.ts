/**
 * `react-shared` — the foundation module for the React 19 Roblox runtime.
 *
 * Contains the value/singleton/type primitives, shared error handling, prop
 * markers, and host-config shims consumed by both `react` and
 * `react-reconciler`. This package exists to break the circular dependency
 * between those two packages, exactly as the upstream `shared` module does.
 *
 * @module react-shared
 * @internal
 * @packageDocumentation
 */

import checkPropTypes from './checkPropTypes';
import consoleTable from './console';
import * as ConsolePatchingDev from './ConsolePatchingDev';
import * as consoleWithStackDev from './consoleWithStackDev';
import enqueueTask from './enqueueTask';
import * as ExecutionEnvironment from './ExecutionEnvironment';
import formatProdErrorMessage from './formatProdErrorMessage';
import getComponentName from './getComponentName';
import invariant from './invariant';
import * as invokeGuardedCallbackImpl from './invokeGuardedCallbackImpl';
import isValidElementType from './isValidElementType';
import objectIs from './objectIs';
import { assign, freeze } from './object';
import * as ReactComponentStackFrame from './ReactComponentStackFrame';
import * as ReactErrorUtils from './ReactErrorUtils';
import ReactFeatureFlags from './ReactFeatureFlags';
import * as SafeFlags from './SafeFlags';
import ReactInstanceMap from './ReactInstanceMap';
import ReactSharedInternals from './ReactSharedInternals';
import ReactFiberHostConfig from './ReactFiberHostConfig';
import * as ReactSymbols from './ReactSymbols';
import ReactVersion from './ReactVersion';
import shallowEqual from './shallowEqual';
import UninitializedState from './UninitializedState';
import * as ReactTypes from './types/ReactTypes';
import { describeError, errorToString, parseReactError } from './ErrorHandling';
import Symbol from './Symbol';
import Type from './Type';
import Change from './PropMarkers/Change';
import Event from './PropMarkers/Event';
import Tag from './PropMarkers/Tag';

export {
	checkPropTypes,
	consoleTable as console,
	ConsolePatchingDev,
	consoleWithStackDev,
	enqueueTask,
	ExecutionEnvironment,
	formatProdErrorMessage,
	getComponentName,
	invariant,
	invokeGuardedCallbackImpl,
	isValidElementType,
	objectIs,
	assign,
	freeze,
	ReactComponentStackFrame,
	ReactErrorUtils,
	ReactFeatureFlags,
	SafeFlags,
	ReactInstanceMap,
	ReactSharedInternals,
	ReactFiberHostConfig,
	ReactSymbols,
	ReactVersion,
	shallowEqual,
	UninitializedState,
	ReactTypes,
	describeError,
	errorToString,
	parseReactError,
	Symbol,
	Type,
	Change,
	Event,
	Tag,
};

// Top-level public types (mirrors upstream `ReactTypes`).
export type {
	ReactEmpty,
	ReactFragment,
	ReactNodeList,
	ReactProviderType,
	ReactConsumer,
	ReactProvider,
	ReactContext,
	ReactPortal,
	RefObject,
	EventPriority,
	ReactFundamentalComponentInstance,
	ReactFundamentalImpl,
	ReactFundamentalComponent,
	ReactScope,
	ReactScopeQuery,
	ReactScopeInstance,
	ReactBinding,
	ReactBindingUpdater,
	MutableSourceVersion,
	MutableSourceGetSnapshotFn,
	MutableSourceSubscribeFn,
	MutableSourceGetVersionFn,
	MutableSource,
	Wakeable,
	Thenable,
} from './types/ReactTypes';

export type { Source, ReactElement } from './types/ReactElementType';
export type { OpaqueIDType } from './ReactFiberHostConfig';
export type { Dispatcher } from './ReactSharedInternals';

// flowtypes re-exports (prefixed to avoid colliding with the names above).
export type {
	ReactRef as React_Ref,
	ReactContext as React_Context,
	ReactAbstractComponent as React_AbstractComponent,
	ReactForwardRefComponent as React_ForwardRefComponent,
	ReactMemoComponent as React_MemoComponent,
	ReactComponentType as React_ComponentType,
	ReactPureComponent as React_PureComponent,
	ReactComponent as React_Component,
	ReactElementProps as React_ElementProps,
	ReactStatelessFunctionalComponent as React_StatelessFunctionalComponent,
	ReactNode as React_Node,
	ReactElement as React_Element,
	ReactElementType as React_ElementType,
	ReactElementConfig as React_ElementConfig,
	ReactElementRef as React_ElementRef,
	ReactPortal as React_Portal,
	ReactKey as React_Key,
} from './types/flowtypes';
