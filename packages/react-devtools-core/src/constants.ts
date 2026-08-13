/**
 * Shared constants for the React DevTools backend.
 *
 * Ported from `react-devtools-shared/src/constants.js` (React 17) for the
 * `@nrbx/react-devtools-core` Roblox package.
 *
 * @module constants
 * @packageDocumentation
 */

import { __DEBUG__ } from '@nrbx/react-globals';

/** Flip to `true` to enable verbose console debug logging. */
export { __DEBUG__ };

/** Operation: add a node to the tree. */
export const TREE_OPERATION_ADD = 1;

/** Operation: remove a node from the tree. */
export const TREE_OPERATION_REMOVE = 2;

/** Operation: reorder a node's children. */
export const TREE_OPERATION_REORDER_CHILDREN = 3;

/** Operation: update a node's tree base duration. */
export const TREE_OPERATION_UPDATE_TREE_BASE_DURATION = 4;

/** localStorage key used to persist component filter preferences. */
export const LOCAL_STORAGE_FILTER_PREFERENCES_KEY = 'React::DevTools::componentFilters';

/** sessionStorage key used to persist the last selection. */
export const SESSION_STORAGE_LAST_SELECTION_KEY = 'React::DevTools::lastSelection';

/** sessionStorage key used to persist record-change-descriptions. */
export const SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY = 'React::DevTools::recordChangeDescriptions';

/** sessionStorage key used to persist reload-and-profile state. */
export const SESSION_STORAGE_RELOAD_AND_PROFILE_KEY = 'React::DevTools::reloadAndProfile';

/** localStorage key used to persist break-on-console-errors preference. */
export const LOCAL_STORAGE_SHOULD_BREAK_ON_CONSOLE_ERRORS = 'React::DevTools::breakOnConsoleErrors';

/** localStorage key used to persist append-component-stack preference. */
export const LOCAL_STORAGE_SHOULD_PATCH_CONSOLE_KEY = 'React::DevTools::appendComponentStack';

/** localStorage key used to persist trace-updates preference. */
export const LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY = 'React::DevTools::traceUpdatesEnabled';

/** Version of the profiler export format this backend emits. */
export const PROFILER_EXPORT_VERSION = 4;

/** URL to the DevTools changelog. */
export const CHANGE_LOG_URL = 'https://github.com/facebook/react/blob/master/packages/react-devtools/CHANGELOG.md';

/** URL shown when an unsupported renderer version is detected. */
export const UNSUPPORTED_VERSION_URL =
	'https://reactjs.org/blog/2019/08/15/new-react-devtools.html#how-do-i-get-the-old-version-back';

/** Comfortable line height (px) used by the elements tree frontend. */
export const COMFORTABLE_LINE_HEIGHT = 15;

/** Compact line height (px) used by the elements tree frontend. */
export const COMPACT_LINE_HEIGHT = 10;
