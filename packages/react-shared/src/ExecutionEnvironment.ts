/**
 * Environment capability checks.
 *
 * @module ExecutionEnvironment
 * @internal
 * @packageDocumentation
 */

/**
 * Whether a DOM is available. Always `false` in the Roblox runtime.
 *
 * @internal
 */
export function canUseDOM(): boolean {
	return false;
}
