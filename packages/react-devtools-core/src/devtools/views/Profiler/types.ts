/**
 * Shared profiling types.
 *
 * The full `react-devtools-shared` Profiler view is not ported to Roblox; only
 * the `Interaction` contract is needed by the backend renderer when collecting
 * profiling data.
 *
 * Ported from `react-devtools-shared/src/devtools/views/Profiler/types.js`.
 *
 * @module devtools/views/Profiler/types
 * @packageDocumentation
 */

/** A single profiler interaction (e.g. a tracked update). */
export interface Interaction {
	id: number;
	name: string;
	timestamp: number;
}
