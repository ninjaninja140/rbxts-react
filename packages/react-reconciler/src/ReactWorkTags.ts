/**
 * Work tags identify the kind of fiber node the reconciler is processing.
 *
 * Upstream: `packages/react-reconciler/src/ReactWorkTags.js`
 *
 * @module ReactWorkTags
 * @internal
 * @packageDocumentation
 */

export type WorkTag = number;

export const FunctionComponent = 0;
export const ClassComponent = 1;
// Before we know whether it is a function or class.
export const IndeterminateComponent = 2;
// Root of a host tree. Could be nested inside another node.
export const HostRoot = 3;
// A subtree. Could be an entry point to a different renderer.
export const HostPortal = 4;
export const HostComponent = 5;
export const HostText = 6;
export const Fragment = 7;
export const Mode = 8;
export const ContextConsumer = 9;
export const ContextProvider = 10;
export const ForwardRef = 11;
export const Profiler = 12;
export const SuspenseComponent = 13;
export const MemoComponent = 14;
export const SimpleMemoComponent = 15;
export const LazyComponent = 16;
export const IncompleteClassComponent = 17;
export const DehydratedFragment = 18;
export const SuspenseListComponent = 19;
export const FundamentalComponent = 20;
export const ScopeComponent = 21;
export const Block = 22;
export const OffscreenComponent = 23;
export const LegacyHiddenComponent = 24;

export default {
	FunctionComponent,
	ClassComponent,
	IndeterminateComponent,
	HostRoot,
	HostPortal,
	HostComponent,
	HostText,
	Fragment,
	Mode,
	ContextConsumer,
	ContextProvider,
	ForwardRef,
	Profiler,
	SuspenseComponent,
	MemoComponent,
	SimpleMemoComponent,
	LazyComponent,
	IncompleteClassComponent,
	DehydratedFragment,
	SuspenseListComponent,
	FundamentalComponent,
	ScopeComponent,
	Block,
	OffscreenComponent,
	LegacyHiddenComponent,
};
