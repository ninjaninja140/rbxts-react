/**
 * Captures the mutable singleton state shared across the whole React runtime.
 *
 * @module ReactSharedInternals
 * @internal
 * @packageDocumentation
 */

import { __DEV__ } from '@nrbx/react-globals';

import ReactCurrentDispatcher from './ReactCurrentDispatcher';
import type { Dispatcher } from './ReactCurrentDispatcher';
import ReactCurrentBatchConfig from './ReactCurrentBatchConfig';
import ReactCurrentOwner from './ReactCurrentOwner';
import ReactDebugCurrentFrame from './ReactDebugCurrentFrame';
import IsSomeRendererActing from './IsSomeRendererActing';

export type { Dispatcher };

const ReactSharedInternals = {
	ReactCurrentDispatcher,
	ReactCurrentBatchConfig,
	ReactCurrentOwner,
	IsSomeRendererActing,
	// The dev frame module is only meaningful in __DEV__; in production the
	// same shape is preserved but its members are no-ops.
	ReactDebugCurrentFrame: __DEV__
		? ReactDebugCurrentFrame
		: {
				setExtraStackFrame: (_stack?: string) => {
					warn('ReactDebugCurrentFrame.setExtraStackFrame is only available in tests, not in production');
				},
			},
};

export default ReactSharedInternals;
