/**
 * A singleton handed out as initial component state before `setState` runs.
 *
 * Reading from it warns in dev, and assigning to it errors, guiding users
 * toward `setState` rather than direct mutation.
 *
 * @module UninitializedState
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { consoleTable as console } from './console';

const UninitializedState = setmetatable(
	{} as Record<string, defined>,
	{
		__index: (_self: Record<string, defined>, _key: string) => {
			if (__DEV__) {
				console.warn('Attempted to access uninitialized state. Use setState to initialize state');
			}
			return undefined;
		},
		__newindex: (_self: Record<string, defined>, _key: string) => {
			if (__DEV__) {
				console.error('Attempted to directly mutate state. Use setState to assign new values to state.');
			}
			return undefined;
		},
		__tostring: () => '<uninitialized component state>',
		__metatable: 'UninitializedState',
	} as never
) as Record<string, defined>;

export default UninitializedState;
