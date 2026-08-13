/**
 * Type-level contract for a single React element.
 *
 * @module ReactElementType
 * @internal
 * @packageDocumentation
 */

import type { ReactComponentType, ReactStatelessFunctionalComponent } from './flowtypes';

/** Debug location of an element's JSX source site. */
export interface Source {
	fileName: string;
	lineNumber: number;
}

type Key = string | number;

/**
 * The runtime shape of an element produced by `React.createElement`.
 *
 * @internal
 */
export interface ReactElement<P = Record<string, unknown>, _T = unknown> {
	/** @internal */ $$typeof: number;
	/** The host tag or component type. */
	type: ReactStatelessFunctionalComponent<P> | ReactComponentType<P> | string;
	key: Key | undefined;
	ref: unknown;
	props: P;
	/** The fiber owner, populated by the reconciler. */
	_owner: any;
	_store?: any;
	_self?: ReactElement;
	_shadowChildren?: any;
	_source?: Source;
}
