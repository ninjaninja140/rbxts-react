/**
 * `react-globals` — Scoped React global flags for the Roblox runtime.
 *
 * Each flag is initialised from the Roblox global table (`_G`) when
 * available, falling back to a sensible default. This design allows
 * different copies of React running in the same environment to read
 * the same set of global flags while still providing type-safe defaults.
 *
 * After initialisation the flags are plain mutable booleans/objects on
 * the returned table — setting them on `_G` after startup has no effect.
 *
 * @module react-globals
 */

// Helpers

function loadFromGlobal<T>(key: string, defaultValue: T): T {
	const globalValue = (_G as Record<string, unknown>)[key];
	if (globalValue !== undefined) {
		return globalValue as T;
	}
	return defaultValue;
}

// General debug flags

/** Enables React Developer Tools integration. */
export const __DEV__ = loadFromGlobal('__DEV__', false);

/** Enables React Profiler integration. */
export const __PROFILE__ = loadFromGlobal('__PROFILE__', false);

/** Enables experimental / unstable React features. */
export const __EXPERIMENTAL__ = loadFromGlobal('__EXPERIMENTAL__', false);

/** Enables debug logging and assertions. */
export const __DEBUG__ = loadFromGlobal('__DEBUG__', false);

/** YOLO mode — skips safety checks for performance. */
export const __YOLO__ = loadFromGlobal('__YOLO__', false);

/** Disables all warnings except prop validation warnings. */
export const __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__ = loadFromGlobal(
	'__DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__',
	false
);

// DevTools flags

/** DevTools global hook object. Set by the devtools client. */
export const __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown | undefined = loadFromGlobal(
	'__REACT_DEVTOOLS_GLOBAL_HOOK__',
	undefined
);

/** DevTools attach function. */
export const __REACT_DEVTOOLS_ATTACH__: any | undefined = loadFromGlobal('__REACT_DEVTOOLS_ATTACH__', undefined);

/** When true, devtools will append component stack traces to error messages. */
export const __REACT_DEVTOOLS_APPEND_COMPONENT_STACK__ = loadFromGlobal(
	'__REACT_DEVTOOLS_APPEND_COMPONENT_STACK__',
	false
);

/** When true, devtools will break on console.error() calls. */
export const __REACT_DEVTOOLS_BREAK_ON_CONSOLE_ERRORS__ = loadFromGlobal(
	'__REACT_DEVTOOLS_BREAK_ON_CONSOLE_ERRORS__',
	false
);

/** DevTools component filter configuration. */
export const __REACT_DEVTOOLS_COMPONENT_FILTERS__: any | undefined = loadFromGlobal(
	'__REACT_DEVTOOLS_COMPONENT_FILTERS__',
	undefined
);

// Storage flags

/** Mock `localStorage` implementation for use in Roblox. */
export const __LOCALSTORAGE__: Record<string, unknown> = loadFromGlobal('__LOCALSTORAGE__', {});

/** Mock `sessionStorage` implementation for use in Roblox. */
export const __SESSIONSTORAGE__: Record<string, unknown> = loadFromGlobal('__SESSIONSTORAGE__', {});

// Misc flags

/** When true, compatibility warnings from the legacy Roact 17 migration are shown. */
export const __COMPAT_WARNINGS__ = loadFromGlobal('__COMPAT_WARNINGS__', false);

/** Indicates that the TestEZ test framework is running. */
export const __TESTEZ_RUNNING_TEST__ = loadFromGlobal('__TESTEZ_RUNNING_TEST__', false);

/** When true, Roact 17 uses a mock scheduler for deterministic testing. */
export const __ROACT_17_MOCK_SCHEDULER__ = loadFromGlobal('__ROACT_17_MOCK_SCHEDULER__', false);

/** When true, `act()` runs synchronously instead of yielding. */
export const __ROACT_17_INLINE_ACT__ = loadFromGlobal('__ROACT_17_INLINE_ACT__', false);
