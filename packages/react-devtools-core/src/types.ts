/**
 * Shared value types for the React DevTools backend.
 *
 * Ported from `react-devtools-shared/src/types.js` (React 17).
 *
 * @module types
 * @packageDocumentation
 */

/**
 * A wall is the transport abstraction used by the {@link Bridge}. The
 * backend supplies a `send` implementation and receives incoming messages
 * through the `listen` callback.
 */
export interface Wall {
	/** Register a listener for incoming messages. Returns an unsubscribe fn. */
	listen: (listener: (message: { event: string; payload: unknown }) => void) => () => void;
	/** Send a message (event + payload) to the other side of the wall. */
	send: (event: string, payload: unknown, transferable?: Array<defined>) => void;
}

// WARNING
// The values below are referenced by ComponentFilters (which are saved via localStorage).
// Do not change them or it will break previously saved user customizations.
//
// If new element types are added, use new numbers rather than re-ordering existing ones.

export const ElementTypeClass = 1;
export const ElementTypeContext = 2;
export const ElementTypeFunction = 5;
export const ElementTypeForwardRef = 6;
export const ElementTypeHostComponent = 7;
export const ElementTypeMemo = 8;
export const ElementTypeOtherOrUnknown = 9;
export const ElementTypeProfiler = 10;
export const ElementTypeRoot = 11;
export const ElementTypeSuspense = 12;
export const ElementTypeSuspenseList = 13;

/** Element type id used to visually distinguish and gate functionality. */
export type ElementType = number;

export const ComponentFilterElementType = 1;
export const ComponentFilterDisplayName = 2;
export const ComponentFilterLocation = 3;
export const ComponentFilterHOC = 4;

/** Component filter type id. */
export type ComponentFilterType = number;

/** Hide all elements of this type (e.g. host components). */
export interface ElementTypeComponentFilter {
	isEnabled: boolean;
	type: typeof ComponentFilterElementType;
	value: ElementType;
}

/** Hide elements whose display name or path matches this string. */
export interface RegExpComponentFilter {
	isEnabled: boolean;
	isValid: boolean;
	type: typeof ComponentFilterDisplayName | typeof ComponentFilterLocation;
	value: string;
}

/** Hide elements created by higher-order components. */
export interface BooleanComponentFilter {
	isEnabled: boolean;
	isValid: boolean;
	type: typeof ComponentFilterHOC;
}

/** Union of all component filter shapes. */
export type ComponentFilter = BooleanComponentFilter | ElementTypeComponentFilter | RegExpComponentFilter;
