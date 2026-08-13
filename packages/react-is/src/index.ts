/**
 * @nrbx/react-is
 *
 * Type-checking utilities for React elements and special objects.
 *
 * Re-exports all type-guard functions and the symbol constants.
 */

export {
	typeOf,
	isElement,
	isContext,
	isContextConsumer,
	isContextProvider,
	isForwardRef,
	isFragment,
	isLazy,
	isMemo,
	isPortal,
	isProfiler,
	isStrictMode,
	isSuspense,
	isSuspenseList,
	isValidElementType,
} from './react-is';

export {
	REACT_ELEMENT_TYPE,
	REACT_CONTEXT_TYPE,
	REACT_PROVIDER_TYPE,
	REACT_FORWARD_REF_TYPE,
	REACT_FRAGMENT_TYPE,
	REACT_LAZY_TYPE,
	REACT_MEMO_TYPE,
	REACT_PORTAL_TYPE,
	REACT_PROFILER_TYPE,
	REACT_STRICT_MODE_TYPE,
	REACT_SUSPENSE_TYPE,
	REACT_SUSPENSE_LIST_TYPE,
	REACT_BINDING_TYPE,
} from './ReactSymbols';
