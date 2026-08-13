/**
 * Types for the experimental Offscreen component.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberOffscreenComponent.lua`.
 *
 * @module ReactFiberOffscreenComponent
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import type { ReactNodeList } from '@nrbx/react-shared';
import type { Lanes } from './types';

export type OffscreenProps = {
	// Default mode is visible.
	mode: string | undefined;
	children: ReactNodeList;
};

// We use the existence of the state object as an indicator that the component
// is hidden.
export type OffscreenState = {
	// The pending work that must be included in the render in order to unhide
	// the component. Always NoLanes for now.
	baseLanes: Lanes;
};

export default {};
