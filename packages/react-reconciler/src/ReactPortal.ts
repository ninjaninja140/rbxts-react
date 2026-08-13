/**
 * Creates React portal elements — a special element type used to render
 * children into a different container than their parent.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactPortal.lua`.
 *
 * @module ReactPortal
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { ReactSymbols } from '@nrbx/react-shared';
import type { ReactNodeList, ReactPortal } from '@nrbx/react-shared';

const { REACT_PORTAL_TYPE } = ReactSymbols;

/**
 * Creates a portal element that renders `children` into `containerInfo`.
 *
 * @param children - The children to render inside the portal.
 * @param containerInfo - The container to render into.
 * @param implementation - The renderer implementation (unused in this port).
 * @param key - Optional key.
 * @returns A new React portal element.
 * @internal
 */
export function createPortal(
	children: ReactNodeList,
	containerInfo: any,
	implementation: any,
	key?: string
): ReactPortal {
	let coercedKey = key;
	if (coercedKey !== undefined) {
		coercedKey = tostring(coercedKey);
	}
	return {
		// This tag allows us to uniquely identify this as a React Portal.
		$$typeof: REACT_PORTAL_TYPE,
		key: coercedKey,
		children,
		containerInfo,
		implementation,
	} as ReactPortal;
}

export default {
	createPortal,
};
