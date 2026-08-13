/**
 * `createMutableSource` — creates a mutable source for use with
 * `useMutableSource`/`useSyncExternalStore`-style subscriptions.
 *
 * @module ReactMutableSource
 * @packageDocumentation
 */

import { __DEV__ } from '@nrbx/react-globals';
import type { MutableSource, MutableSourceGetVersionFn } from '@nrbx/react-shared';

/**
 * Creates a mutable source.
 *
 * @param source - The source value.
 * @param getVersion - A function returning a version that changes whenever the
 * source snapshot changes.
 */
function createMutableSource<Source>(source: Source, getVersion: MutableSourceGetVersionFn): MutableSource<Source> {
	const mutableSource: MutableSource<Source> = {
		_getVersion: getVersion,
		_source: source,
		_workInProgressVersionPrimary: undefined,
		_workInProgressVersionSecondary: undefined,
	};

	if (__DEV__) {
		mutableSource._currentPrimaryRenderer = undefined;
		mutableSource._currentSecondaryRenderer = undefined;
	}

	return mutableSource;
}

export default createMutableSource;
