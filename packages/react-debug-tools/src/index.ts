/**
 * `@nrbx/react-debug-tools` — React hook inspection for DevTools.
 *
 * Provides `inspectHooks` and `inspectHooksOfFiber` for walking the React
 * hooks tree of a component or fiber. Used internally by React DevTools to
 * display hook state, but can also be used in custom debugging tooling.
 *
 * Ported from `react-lua/modules/react-debug-tools/src/ReactDebugHooks.lua`
 * which was itself derived from:
 * https://github.com/facebook/react/blob/v17.0.2/packages/react-debug-tools/src/ReactDebugHooks.js
 *
 * @module index
 * @packageDocumentation
 */

import {
	ReactSharedInternals,
	FunctionComponent,
	SimpleMemoComponent,
	ContextProvider,
	ForwardRef,
	Block,
	NoMode,
	REACT_OPAQUE_ID_TYPE,
} from '@nrbx/react';
import type { CurrentDispatcherRef } from '@nrbx/react';

// Types

/** A stack frame parsed from an Error.stack trace. */
interface StackFrame {
	/** The source line (e.g. `Script '...path', Line 42`). */
	source: string | undefined;
	/** The function name extracted from the source line, if any. */
	functionName: string | undefined;
}

/** A log entry produced by one of our hook interceptors during a render. */
interface HookLogEntry {
	/** The primitive hook name ("State", "Reducer", "Effect", etc.). */
	primitive: string;
	/** Stack trace captured at the hook call site for stack analysis. */
	stackError: StackError;
	/** The current memoized value of the hook. */
	value: unknown;
}

/**
 * Minimal stand-in for the `Error` objects used by the upstream
 * implementation. Only the stack trace string is needed, which we capture
 * directly from `debug.traceback()`.
 */
interface StackError {
	stack: string | undefined;
}

/**
 * Captures the current Lua call stack for hook stack-frame analysis.
 */
function captureStack(): StackError {
	return { stack: debug.traceback() };
}

/** A single hook node within a fiber's hook linked list. */
interface HookNode {
	memoizedState: unknown;
	next: HookNode | undefined;
}

/** Shape of the Reconciler's Dispatcher table. */
interface Dispatcher {
	readContext: <T>(context: { _currentValue: T }, observedBits?: number | boolean) => T;
	useCallback: <T extends Callback>(callback: T, inputs?: Array<unknown>) => T;
	useContext: <T>(context: { _currentValue: T }, observedBits?: number | boolean) => T;
	useEffect: (create: () => (() => void) | void, inputs?: Array<unknown>) => void;
	useImperativeHandle: (ref: unknown, create: () => unknown, inputs?: Array<unknown>) => void;
	useDebugValue: <T>(value: T, formatterFn?: (value: T) => unknown) => void;
	useLayoutEffect: (create: () => (() => void) | void, inputs?: Array<unknown>) => void;
	useMemo: (nextCreate: () => unknown, inputs?: Array<unknown>) => unknown;
	useReducer: <S, A>(reducer: (state: S, action: A) => S, initialArg: S, init?: (arg: S) => S) => [S, Dispatch<A>];
	useRef: <T>(initialValue: T) => { current: T };
	useState: <S>(initialState: (() => S) | S) => [S, Dispatch<BasicStateAction<S>>];
	useMutableSource: <Source, Snapshot>(
		source: MutableSource<Source>,
		getSnapshot: (source: Source) => Snapshot,
		subscribe: (source: Source, callback: (snapshot: Snapshot) => void) => () => void
	) => Snapshot;
	useOpaqueIdentifier: () => unknown;
}

type BasicStateAction<S> = ((prevState: S) => S) | S;
type Dispatch<A> = (action: A) => void;
type Callback = (...args: Array<unknown>) => unknown;

interface MutableSource<Source> {
	_source: Source;
}

/** A node in the React hooks tree representing a single hook's state. */
export interface HooksNode {
	/** The name of the hook (e.g. `"useState"`, `"useEffect"`). */
	name: string;
	/** Unique identifier for stateful hooks; undefined for non-stateful ones. */
	id: number | undefined;
	/** `true` if this hook's state can be edited at runtime (State, Reducer). */
	isStateEditable: boolean;
	/** The current value of the hook. */
	value: unknown;
	/** Sub-hooks within a custom hook. */
	subHooks: Array<HooksNode>;
}

/** A complete hooks tree for a component fiber. */
export type HooksTree = Array<HooksNode>;

// Internal state

/** Accumulates hook call entries during an inspection render. */
let hookLog: Array<HookLogEntry> = [];

/** Cache of primitive hook stack traces for stack-frame matching. */
let primitiveStackCache: Map<string, Array<StackFrame>> | undefined;

/** The fiber currently being inspected. Set by `inspectHooksOfFiber`. */
let currentFiber: unknown;

/** The current position in the fiber's hook linked list. */
let currentHook: HookNode | undefined;

/** Most-recently-matched ancestor index for optimized stack comparison. */
let mostLikelyAncestorIndex = 1;

// Error stack parser

/**
 * Parses a Roblox Lua error stack trace into stack frames.
 *
 * Only returns frames that reference actual source files (scripts/modules),
 * filtering out native C frames and stack header boilerplate.
 *
 * Accepts two line formats:
 * - `Script '...path', Line N` (roblox-ts / require-based)
 * - `LoadedCode(...)` (loadstring-based, used by react-lua runtime)
 */
function parseErrorStack(err: StackError): Array<StackFrame> {
	const stack = err.stack;
	if (!stack || typeIs(stack, 'nil')) return [];

	const lines = stack.split('\n');
	const result: Array<StackFrame> = [];

	for (const line of lines) {
		const isSourceLine = line.find("Script '")[0] !== undefined || line.find('LoadedCode')[0] !== undefined;

		if (!isSourceLine) continue;

		const funcMatch = line.match('function (%w+)$');
		result.push({
			source: line,
			functionName: funcMatch[0] !== undefined ? (funcMatch[0] as string) : undefined,
		});
	}

	return result;
}

// Primitive stack cache

/**
 * Builds a cache mapping each primitive hook name to its stack trace.
 *
 * We call every primitive hook once with dummy values through the real
 * Dispatcher to record what the stack looks like when each hook is
 * called. Later, during stack analysis, we subtract this "primitive
 * wrapper" from the hook call stack to reveal only the custom hook
 * frames above it.
 */
function getPrimitiveStackCache(): Map<string, Array<StackFrame>> {
	if (primitiveStackCache !== undefined) {
		return primitiveStackCache;
	}

	const cache = new Map<string, Array<StackFrame>>();
	let readHookLog: Array<HookLogEntry>;

	const previousDispatcher = ReactSharedInternals.ReactCurrentDispatcher.current as unknown as Dispatcher;

	{
		const [ok, err] = pcall(() => {
			previousDispatcher.useContext({ _currentValue: undefined });
			previousDispatcher.useState(undefined);
			previousDispatcher.useReducer((s: unknown, _a: unknown) => s, undefined);
			previousDispatcher.useRef(undefined);
			previousDispatcher.useLayoutEffect(() => {});
			previousDispatcher.useEffect(() => {});
			previousDispatcher.useImperativeHandle(undefined, () => undefined);
			previousDispatcher.useDebugValue(undefined);
			previousDispatcher.useCallback(() => {});
			previousDispatcher.useMemo(() => undefined);
		});

		readHookLog = hookLog;
		hookLog = [];

		if (!ok) {
			error(err);
		}
	}

	for (const hook of readHookLog) {
		cache.set(hook.primitive, parseErrorStack(hook.stackError));
	}

	primitiveStackCache = cache;
	return cache;
}

// Hook linked-list traversal

/** Advances `currentHook` to the next node in the fiber's hook list. */
function nextHook(): HookNode | undefined {
	const hook = currentHook;
	if (hook !== undefined) {
		currentHook = hook.next;
	}
	return hook;
}

// Hook interceptors (the "logging dispatcher")

function _readContext<T>(context: { _currentValue: T }, _observedBits?: number | boolean): T {
	return context._currentValue;
}

function _useContext<T>(context: { _currentValue: T }, _observedBits?: number | boolean): T {
	hookLog.push({
		primitive: 'Context',
		stackError: captureStack(),
		value: context._currentValue,
	});
	return context._currentValue;
}

function _useState<S>(initialState: (() => S) | S): LuaTuple<[S, Dispatch<BasicStateAction<S>>]> {
	const hook = nextHook();
	let state: S;
	if (hook !== undefined) {
		state = hook.memoizedState as S;
	} else if (typeIs(initialState, 'function')) {
		state = (initialState as () => S)();
	} else {
		state = initialState as S;
	}
	hookLog.push({
		primitive: 'State',
		stackError: captureStack(),
		value: state,
	});
	return $tuple(state, (_action: BasicStateAction<S>) => {});
}

function _useReducer<S, A>(
	_reducer: (state: S, action: A) => S,
	initialArg: S,
	init?: (arg: S) => S
): LuaTuple<[S, Dispatch<A>]> {
	const hook = nextHook();
	let state: S;
	if (hook !== undefined) {
		state = hook.memoizedState as S;
	} else if (init !== undefined) {
		state = init(initialArg);
	} else {
		state = initialArg;
	}
	hookLog.push({
		primitive: 'Reducer',
		stackError: captureStack(),
		value: state,
	});
	return $tuple(state, (_action: A) => {});
}

function _useRef<T>(initialValue: T): { current: T } {
	const hook = nextHook();
	const ref = hook !== undefined ? (hook.memoizedState as { current: T }) : { current: initialValue };
	hookLog.push({
		primitive: 'Ref',
		stackError: captureStack(),
		value: ref.current,
	});
	return ref;
}

function _useLayoutEffect(create: (() => void) | (() => () => void), _inputs?: Array<unknown>): void {
	nextHook();
	hookLog.push({
		primitive: 'LayoutEffect',
		stackError: captureStack(),
		value: create,
	});
}

function _useEffect(create: (() => void) | (() => () => void), _inputs?: Array<unknown>): void {
	nextHook();
	hookLog.push({
		primitive: 'Effect',
		stackError: captureStack(),
		value: create,
	});
}

function _useImperativeHandle<T>(
	ref: { current: T | undefined } | ((inst: T | undefined) => unknown | undefined | undefined),
	_create: () => T,
	_inputs?: Array<unknown>
): void {
	nextHook();
	let instance: T | undefined;
	if (ref !== undefined && typeIs(ref, 'table')) {
		instance = (ref as { current: T | undefined }).current;
	}
	hookLog.push({
		primitive: 'ImperativeHandle',
		stackError: captureStack(),
		value: instance,
	});
}

function _useDebugValue<T>(value: T, formatterFn?: (value: T) => unknown): void {
	hookLog.push({
		primitive: 'DebugValue',
		stackError: captureStack(),
		value: typeIs(formatterFn, 'function') ? formatterFn(value) : value,
	});
}

function _useCallback<T extends Callback>(callback: T, _inputs?: Array<unknown>): T {
	const hook = nextHook();
	const value = hook !== undefined ? (hook.memoizedState as Array<unknown>)[0] : callback;
	hookLog.push({
		primitive: 'Callback',
		stackError: captureStack(),
		value,
	});
	return callback;
}

function _useMemo<T>(nextCreate: () => T, _inputs?: Array<unknown>): T {
	const hook = nextHook();
	const value = hook !== undefined ? (hook.memoizedState as Array<unknown>)[0] : nextCreate();
	hookLog.push({
		primitive: 'Memo',
		stackError: captureStack(),
		value,
	});
	return value as T;
}

function _useMutableSource<Source, Snapshot>(
	source: MutableSource<Source>,
	getSnapshot: (source: Source) => Snapshot,
	_subscribe: (source: Source, callback: (snapshot: Snapshot) => void) => () => void
): Snapshot {
	nextHook(); // MutableSource
	nextHook(); // State
	nextHook(); // Effect
	nextHook(); // Effect
	const value = getSnapshot(source._source);
	hookLog.push({
		primitive: 'MutableSource',
		stackError: captureStack(),
		value,
	});
	return value;
}

function _useOpaqueIdentifier(): unknown {
	const hook = nextHook(); // State

	if (currentFiber && (currentFiber as { mode: number }).mode === NoMode) {
		nextHook(); // Effect
	}

	let value: unknown = hook !== undefined ? hook.memoizedState : undefined;

	if (value && typeIs(value, 'table') && (value as Record<string, unknown>).$$typeof === REACT_OPAQUE_ID_TYPE) {
		value = undefined;
	}

	hookLog.push({
		primitive: 'OpaqueIdentifier',
		stackError: captureStack(),
		value,
	});
	return value;
}

// The logging Dispatcher

/** Dispatcher that intercepts hook calls during inspection to build the hooks log. */
const Dispatcher: Dispatcher = {
	readContext: _readContext as Dispatcher['readContext'],
	useCallback: _useCallback as Dispatcher['useCallback'],
	useContext: _useContext as Dispatcher['useContext'],
	useEffect: _useEffect as Dispatcher['useEffect'],
	useImperativeHandle: _useImperativeHandle as Dispatcher['useImperativeHandle'],
	useDebugValue: _useDebugValue as Dispatcher['useDebugValue'],
	useLayoutEffect: _useLayoutEffect as Dispatcher['useLayoutEffect'],
	useMemo: _useMemo as Dispatcher['useMemo'],
	useReducer: _useReducer as Dispatcher['useReducer'],
	useRef: _useRef as Dispatcher['useRef'],
	useState: _useState as Dispatcher['useState'],
	useMutableSource: _useMutableSource as Dispatcher['useMutableSource'],
	useOpaqueIdentifier: _useOpaqueIdentifier as Dispatcher['useOpaqueIdentifier'],
};

// Stack frame analysis

/**
 * Finds the index in `hookStack` where it shares the same source as
 * `rootStack[rootIndex]`, and validates that subsequent frames match too.
 * Returns -1 if no match is found.
 */
function findSharedIndex(hookStack: Array<StackFrame>, rootStack: Array<StackFrame>, rootIndex: number): number {
	const source = rootStack[rootIndex - 1].source;

	for (let i = 0; i < hookStack.size(); i++) {
		const hookSource = hookStack[i].source;
		if (hookSource !== source) continue;

		let a = rootIndex;
		let b = i + 1;
		let mismatch = false;

		while (a < rootStack.size() && b < hookStack.size()) {
			if (hookStack[b].source !== rootStack[a].source) {
				mismatch = true;
				break;
			}
			a++;
			b++;
		}

		if (!mismatch) {
			return i + 1;
		}
	}

	return -1;
}

/**
 * Finds the common ancestor stack frame shared between the root call stack
 * and a hook call stack. Starts with the most-likely cached index.
 */
function findCommonAncestorIndex(rootStack: Array<StackFrame>, hookStack: Array<StackFrame>): number {
	let rootIndex = findSharedIndex(hookStack, rootStack, mostLikelyAncestorIndex);

	if (rootIndex !== -1) return rootIndex;

	const limit = math.min(rootStack.size(), 5);
	for (let i = 1; i <= limit; i++) {
		rootIndex = findSharedIndex(hookStack, rootStack, i);
		if (rootIndex !== -1) {
			mostLikelyAncestorIndex = i;
			return rootIndex;
		}
	}

	return -1;
}

/**
 * Checks whether a function name looks like a React wrapper for a primitive
 * hook, e.g. `useState` for primitive "State".
 */
function isReactWrapper(functionName: string | undefined, primitiveName: string): boolean {
	if (!functionName || functionName === '') return false;

	const expectedName = `use${primitiveName}`;
	if (functionName.size() < expectedName.size()) return false;

	const lastIndex = functionName.size() - expectedName.size();
	return functionName.sub(lastIndex + 1) === expectedName;
}

/**
 * Finds the index in the hook stack where the primitive hook's own stack
 * entry ends and the caller's stack begins.
 */
function findPrimitiveIndex(hookStack: Array<StackFrame>, hook: HookLogEntry): number {
	const stackCache = getPrimitiveStackCache();
	const primitiveStack = stackCache.get(hook.primitive);

	if (primitiveStack === undefined) return -1;

	const maxLen = math.min(primitiveStack.size(), hookStack.size());
	for (let i = 0; i < maxLen; i++) {
		if (primitiveStack[i].source !== hookStack[i].source) {
			const hsSize = hookStack.size();
			if (i < hsSize - 1 && isReactWrapper(hookStack[i].functionName, hook.primitive)) {
				i++;
			}
			if (i < hsSize - 1 && isReactWrapper(hookStack[i].functionName, hook.primitive)) {
				i++;
			}
			return i + 1;
		}
	}

	return -1;
}

// Stack trimming

/**
 * Extracts the custom-hook stack frames between the primitive hook and the
 * root component call. This is the "custom hook call chain" used to build
 * the hooks tree.
 */
function parseTrimmedStack(rootStack: Array<StackFrame>, hook: HookLogEntry): Array<StackFrame> | undefined {
	const hookStack = parseErrorStack(hook.stackError);
	const rootIndex = findCommonAncestorIndex(rootStack, hookStack);
	const primitiveIndex = findPrimitiveIndex(hookStack, hook);

	if (rootIndex === -1 || primitiveIndex === -1 || rootIndex - primitiveIndex < 2) {
		return undefined;
	}

	const result: Array<StackFrame> = [];
	for (let i = primitiveIndex - 1; i < rootIndex - 1; i++) {
		result.push(hookStack[i]);
	}
	return result;
}

// Hook name extraction

/**
 * Extracts a custom hook name from a stack frame's function name.
 *
 * Strips leading module path (everything up to and including the last `.`)
 * and skips a leading `use` prefix so `useMyHook` becomes `MyHook`.
 */
function parseCustomHookName(functionName: string | undefined): string {
	if (!functionName) return '';

	const parts = (functionName as string).split('.');
	const nameOnly = parts.size() > 0 ? parts[parts.size() - 1] : (functionName as string);

	if (nameOnly.sub(1, 3) === 'use') {
		return nameOnly.sub(4);
	}
	return nameOnly;
}

// Tree builder

/** Forward declaration for mutual recursion with processDebugValues. */
let _processDebugValues: (hooksTree: HooksTree, parentNode: HooksNode | undefined) => void;

/**
 * Builds the final hooks tree from the raw hook log entries.
 *
 * Reconstructs the nested custom-hook / primitive-hook hierarchy by
 * comparing the call stacks of each hook entry. Hooks that share more
 * stack frames are grouped together under the same custom hook node.
 */
function buildTree(rootStack: Array<StackFrame>, readHookLog: Array<HookLogEntry>): HooksTree {
	const rootChildren: Array<HooksNode> = [];
	let prevStack: Array<StackFrame> | undefined;
	let levelChildren = rootChildren;
	let nativeHookID = 1;
	const stackOfChildren: Array<Array<HooksNode>> = [];

	for (const hook of readHookLog) {
		const stack = parseTrimmedStack(rootStack, hook);

		if (stack !== undefined) {
			let commonSteps = 0;

			if (prevStack !== undefined) {
				while (commonSteps < stack.size() && commonSteps < prevStack.size()) {
					const stackSource = stack[stack.size() - commonSteps - 1].source;
					const prevSource = prevStack[prevStack.size() - commonSteps - 1].source;

					if (stackSource !== prevSource) break;
					commonSteps++;
				}

				for (let j = prevStack.size() - 1; j > commonSteps; j--) {
					const popped = stackOfChildren.pop();
					if (popped !== undefined) {
						levelChildren = popped;
					}
				}
			}

			for (let j = stack.size() - commonSteps; j >= 2; j--) {
				const children: Array<HooksNode> = [];
				levelChildren.push({
					id: undefined,
					isStateEditable: false,
					name: parseCustomHookName(stack[j - 2].functionName),
					value: undefined,
					subHooks: children,
				});
				stackOfChildren.push(levelChildren);
				levelChildren = children;
			}

			prevStack = stack;
		}

		const postfixIncrement = (): number => {
			const prev = nativeHookID;
			nativeHookID++;
			return prev;
		};

		const primitive = hook.primitive;
		const id = primitive === 'Context' || primitive === 'DebugValue' ? undefined : postfixIncrement();

		const isStateEditable = primitive === 'Reducer' || primitive === 'State';

		levelChildren.push({
			id,
			isStateEditable,
			name: primitive,
			value: hook.value,
			subHooks: [],
		});
	}

	_processDebugValues(rootChildren, undefined);
	return rootChildren;
}

// Debug value assignment

/**
 * Walks the hooks tree and assigns `useDebugValue()` entries to their
 * parent custom hook nodes, then removes the standalone DebugValue nodes.
 *
 * A single debug value is assigned directly; multiple become an array.
 */
_processDebugValues = (hooksTree: HooksTree, parentNode: HooksNode | undefined): void => {
	const debugValueNodes: Array<HooksNode> = [];

	for (let i = hooksTree.size() - 1; i >= 0; i--) {
		const node = hooksTree[i];

		if (node.name === 'DebugValue' && node.subHooks.size() === 0) {
			hooksTree.remove(i);
			debugValueNodes.push(node);
		} else {
			_processDebugValues(node.subHooks, node);
		}
	}

	const reversed: Array<HooksNode> = [];
	for (let i = debugValueNodes.size() - 1; i >= 0; i--) {
		reversed.push(debugValueNodes[i]);
	}

	if (parentNode !== undefined) {
		if (reversed.size() === 1) {
			parentNode.value = reversed[0].value;
		} else if (reversed.size() > 1) {
			const values: Array<defined> = [];
			for (const node of reversed) {
				values.push(node.value as defined);
			}
			parentNode.value = values;
		}
	}
};

// Public API — inspectHooks

/**
 * Inspects the hooks of a render function by temporarily replacing the
 * current dispatcher with a logging dispatcher, calling the function,
 * and building a hooks tree from the captured data.
 *
 * @param renderFunction - The component's render function.
 * @param props - Props to pass to the render function.
 * @param currentDispatcherRef - Optional dispatcher ref (defaults to
 *   `ReactSharedInternals.ReactCurrentDispatcher`).
 * @returns The hooks tree for the component.
 */
export function inspectHooks<Props>(
	renderFunction: (props: Props) => unknown,
	props: Props,
	currentDispatcherRef?: CurrentDispatcherRef
): HooksTree {
	if (currentDispatcherRef === undefined) {
		currentDispatcherRef = ReactSharedInternals.ReactCurrentDispatcher;
	}

	const previousDispatcher = currentDispatcherRef.current;
	currentDispatcherRef.current = Dispatcher as unknown as typeof currentDispatcherRef.current;

	let ancestorStackError: StackError;

	const [ok, errResult] = pcall(() => {
		ancestorStackError = captureStack();
		renderFunction(props);
	});

	const readHookLog: Array<HookLogEntry> = hookLog;
	hookLog = [];
	currentDispatcherRef.current = previousDispatcher;

	if (!ok) {
		error(errResult);
	}

	const rootStack = parseErrorStack(ancestorStackError!);
	return buildTree(rootStack, readHookLog);
}

// Context setup / restore helpers

/**
 * Walks the fiber's ancestor chain and records the current values of any
 * context providers, then sets them to the value from the inspected fiber's props.
 */
function setupContexts(contextMap: Map<unknown, unknown>, fiber: Record<string, unknown>): void {
	let current: Record<string, unknown> | undefined = fiber;

	while (current) {
		if (current.tag === ContextProvider) {
			const providerType = current.type as { _context: { _currentValue: unknown } };
			const context = providerType._context;

			if (!contextMap.has(context)) {
				contextMap.set(context, context._currentValue);
				context._currentValue = (current.memoizedProps as Record<string, unknown>).value;
			}
		}
		current = current.return_ as Record<string, unknown> | undefined;
	}
}

/** Restores context values to their original state after inspection. */
function restoreContexts(contextMap: Map<unknown, unknown>): void {
	for (const [context, value] of contextMap) {
		(context as { _currentValue: unknown })._currentValue = value;
	}
}

// ForwardRef inspection

/**
 * Inspects hooks on a ForwardRef component by calling its `render` function
 * with props and the forwarded ref.
 */
function inspectHooksOfForwardRef<Props, Ref>(
	renderFunction: (props: Props, ref: Ref) => unknown,
	props: Props,
	ref: Ref,
	currentDispatcherRef: CurrentDispatcherRef
): HooksTree {
	const previousDispatcher = currentDispatcherRef.current;
	currentDispatcherRef.current = Dispatcher as unknown as typeof currentDispatcherRef.current;

	let ancestorStackError: StackError;

	const [ok, errResult] = pcall(() => {
		ancestorStackError = captureStack();
		renderFunction(props, ref);
	});

	const readHookLog: Array<HookLogEntry> = hookLog;
	hookLog = [];
	currentDispatcherRef.current = previousDispatcher;

	if (!ok) {
		error(errResult);
	}

	const rootStack = parseErrorStack(ancestorStackError!);
	return buildTree(rootStack, readHookLog);
}

// Default props resolution

/**
 * Merges a component's `defaultProps` into the base props, mimicking
 * what `ReactElement` does during element creation.
 */
function resolveDefaultProps(
	Component: { defaultProps?: Record<string, unknown> },
	baseProps: Record<string, unknown>
): Record<string, unknown> {
	if (typeIs(Component, 'table') && Component.defaultProps) {
		const props = { ...baseProps };
		const defaultProps = Component.defaultProps;
		for (const [propName, propValue] of pairs(defaultProps)) {
			if ((props as Record<string, unknown>)[propName as string] === undefined) {
				(props as Record<string, unknown>)[propName as string] = propValue;
			}
		}
		return props;
	}
	return baseProps;
}

// Public API — inspectHooksOfFiber

/**
 * Inspects the hooks of a React fiber node.
 *
 * Valid fiber types: `FunctionComponent`, `SimpleMemoComponent`,
 * `ForwardRef`, `Block`.
 *
 * @param fiber - The React fiber to inspect.
 * @param currentDispatcherRef - Optional dispatcher ref override.
 * @returns The hooks tree for the fiber.
 * @throws If the fiber is not a supported function component type.
 */
export function inspectHooksOfFiber(
	fiber: Record<string, unknown>,
	currentDispatcherRef?: CurrentDispatcherRef
): HooksTree {
	if (currentDispatcherRef === undefined) {
		currentDispatcherRef = ReactSharedInternals.ReactCurrentDispatcher;
	}

	currentFiber = fiber;

	const tag = fiber.tag as number;
	if (tag !== FunctionComponent && tag !== SimpleMemoComponent && tag !== ForwardRef && tag !== Block) {
		error('Unknown Fiber. Needs to be a function component to inspect hooks.');
	}

	getPrimitiveStackCache();

	const type_ = fiber.type as
		| ((props: Record<string, unknown>) => unknown)
		| { render: (props: Record<string, unknown>, ref: unknown) => unknown }
		| { defaultProps?: Record<string, unknown> };

	let props = fiber.memoizedProps as Record<string, unknown>;

	if (type_ !== fiber.elementType) {
		props = resolveDefaultProps((type_ as { defaultProps?: Record<string, unknown> }) ?? {}, props);
	}

	currentHook = fiber.memoizedState as HookNode | undefined;

	const contextMap = new Map<unknown, unknown>();

	const [ok, errResult] = pcall(() => {
		setupContexts(contextMap, fiber);

		if (tag === ForwardRef) {
			const renderFn = (type_ as { render: (props: Record<string, unknown>, ref: unknown) => unknown }).render;
			return inspectHooksOfForwardRef(renderFn, props, fiber.ref, currentDispatcherRef!);
		}

		return inspectHooks(type_ as (props: Record<string, unknown>) => unknown, props, currentDispatcherRef);
	});

	currentHook = undefined;
	restoreContexts(contextMap);

	if (!ok) {
		error(errResult);
	}

	return errResult as HooksTree;
}

export default {
	inspectHooks,
	inspectHooksOfFiber,
};
