/**
 * An inlined `Object.is` polyfill, avoiding the need for consumers to ship
 * their own.
 *
 * @module objectIs
 * @internal
 * @packageDocumentation
 */

function is(x: unknown, y: unknown): boolean {
	return (x === y && (x !== 0 || 1 / (x as number) === 1 / (y as number))) || (x !== x && y !== y);
}

/**
 * Strict equality matching `Object.is` semantics.
 *
 * @internal
 */
export default is;
