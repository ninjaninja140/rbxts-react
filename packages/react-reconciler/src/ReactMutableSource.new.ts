/**
 * Tracks mutable-source version reads during a render so that tearing can be
 * detected, and eagerly records the source version used during hydration.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactMutableSource.new.lua`.
 *
 * @module ReactMutableSource
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { console } from '@nrbx/react-shared';
import type { MutableSource, MutableSourceVersion } from '@nrbx/react-shared';
import HostConfig from './ReactFiberHostConfig';
import type { FiberRoot } from './types';

// Read lazily — `isPrimaryRenderer` is spliced in by the renderer at
// `initialize()`, after this module has already been `require`d.
const isPrimaryRenderer = () => HostConfig.isPrimaryRenderer;

// Work-in-progress version numbers only apply to a single render,
// and should be reset before starting a new render.
// This tracks which mutable sources need to be reset after a render.
const workInProgressSources: Array<MutableSource<unknown>> = [];

// Used to detect multiple renderers using the same mutable source.
const rendererSigil: object | undefined = __DEV__ ? {} : undefined;

/**
 * Records `mutableSource` as read during the current render.
 *
 * @param mutableSource - The source that was read.
 * @internal
 */
export function markSourceAsDirty(mutableSource: MutableSource<unknown>): void {
	workInProgressSources.push(mutableSource);
}

/**
 * Clears the per-render version numbers captured during the previous render.
 *
 * @internal
 */
export function resetWorkInProgressVersions(): void {
	for (const mutableSource of workInProgressSources) {
		if (isPrimaryRenderer()) {
			mutableSource._workInProgressVersionPrimary = undefined;
		} else {
			mutableSource._workInProgressVersionSecondary = undefined;
		}
	}
	table.clear(workInProgressSources);
}

/**
 * Returns the version of `mutableSource` captured during the current render.
 *
 * @param mutableSource - The source to query.
 * @returns The work-in-progress version, or `undefined` if unread.
 * @internal
 */
export function getWorkInProgressVersion(mutableSource: MutableSource<unknown>): MutableSourceVersion | undefined {
	if (isPrimaryRenderer()) {
		return mutableSource._workInProgressVersionPrimary;
	}
	return mutableSource._workInProgressVersionSecondary;
}

/**
 * Stores the version of `mutableSource` captured during the current render.
 *
 * @param mutableSource - The source that was read.
 * @param version_ - The version to store.
 * @internal
 */
export function setWorkInProgressVersion(mutableSource: MutableSource<unknown>, version_: MutableSourceVersion): void {
	if (isPrimaryRenderer()) {
		mutableSource._workInProgressVersionPrimary = version_;
	} else {
		mutableSource._workInProgressVersionSecondary = version_;
	}
	workInProgressSources.push(mutableSource);
}

/**
 * Warns (DEV only) when two renderers read the same mutable source
 * concurrently, which React does not support.
 *
 * @param mutableSource - The source being read.
 * @internal
 */
export function warnAboutMultipleRenderersDEV(mutableSource: MutableSource<unknown>): void {
	if (__DEV__) {
		if (isPrimaryRenderer()) {
			if (mutableSource._currentPrimaryRenderer === undefined) {
				mutableSource._currentPrimaryRenderer = rendererSigil;
			} else if (mutableSource._currentPrimaryRenderer !== rendererSigil) {
				console.error(
					'Detected multiple renderers concurrently rendering the ' +
						'same mutable source. This is currently unsupported.'
				);
			}
		} else {
			if (mutableSource._currentSecondaryRenderer === undefined) {
				mutableSource._currentSecondaryRenderer = rendererSigil;
			} else if (mutableSource._currentSecondaryRenderer !== rendererSigil) {
				console.error(
					'Detected multiple renderers concurrently rendering the ' +
						'same mutable source. This is currently unsupported.'
				);
			}
		}
	}
}

/**
 * Eagerly reads the version of a mutable source and stores it on the root.
 * This ensures the version used during hydration matches the one read on the
 * client; a mismatch means a tear and forces a full deopt render.
 *
 * @param root - The fiber root being hydrated.
 * @param mutableSource - The source to record.
 * @internal
 */
export function registerMutableSourceForHydration(root: FiberRoot, mutableSource: MutableSource<unknown>): void {
	const getVersion = mutableSource._getVersion;
	const version_ = getVersion(mutableSource._source);

	if (root.mutableSourceEagerHydrationData === undefined) {
		root.mutableSourceEagerHydrationData = [mutableSource, version_];
	}
}

export default {
	markSourceAsDirty,
	resetWorkInProgressVersions,
	getWorkInProgressVersion,
	setWorkInProgressVersion,
	warnAboutMultipleRenderersDEV,
	registerMutableSourceForHydration,
};
