/**
 * React Hooks — core React 17 hooks + polyfilled React 19 hooks.
 *
 * ## Core (React 17)
 * - `useState`, `useEffect`, `useLayoutEffect`, `useMemo`, `useCallback`
 * - `useRef`, `useReducer`, `useContext`, `useImperativeHandle`
 * - `useMemoCompare`, `useLifecycle`, `useDebugValue`
 *
 * ## React 19 (polyfilled)
 * - `useId`, `useTransition`, `useDeferredValue`, `useSyncExternalStore`
 * - `useInsertionEffect`, `useEffectEvent`, `useOptimistic`
 * - `use`, `useActionState`, `cache`, `startTransition`
 *
 * @module hooks
 * @packageDocumentation
 */

// Core React 17 hooks
export {
	useRef,
	useState,
	useReducer,
	useEffect,
	useLayoutEffect,
	useMemo,
	useCallback,
	useContext,
	useMemoCompare,
	useImperativeHandle,
} from './core';

// React 19 polyfilled hooks
export { useId } from './use-id';
export { useTransition } from './use-transition';
export { useDeferredValue } from './use-deferred-value';
export { useSyncExternalStore } from './use-sync-external-store';
export { useInsertionEffect } from './use-insertion-effect';
export { useEffectEvent } from './use-effect-event';
export { useOptimistic } from './use-optimistic';
export { use } from './use';
export { useActionState } from './use-action-state';
export { cache, startTransition } from './cache';

// Motion / animation hooks
export type { SpringConfig, Motion } from './use-motion';
export { useMotion, useHoverMotion } from './use-motion';

// Compiler hook
export { useMemoCache } from './use-memo-cache';

// Lifecycle utilities
export { useLifecycle, useDebugValue } from './lifecycle';
