/**
 * Roblox class name resolution via `ReflectionService`.
 * Maps lowercase class name strings to their correct PascalCase Roblox equivalents.
 *
 * @module tags
 * @packageDocumentation
 */

/** Cache of known Roblox class names. Built lazily on first access. */
let classCache: Record<string, string> | undefined;

/**
 * Lazily builds a map of lowercase → PascalCase Roblox class names using
 * `ReflectionService.GetClasses()`.
 *
 * @internal
 */
function getClassCache(): Record<string, string> {
	if (classCache) return classCache;
	const result: Record<string, string> = {};
	const classes = (game.GetService('ReflectionService') as ReflectionService).GetClasses();
	for (const className of classes) {
		result[(className as string).lower()] = className as string;
	}
	classCache = result;
	return result;
}

/**
 * Resolves a lowercase tag name to its PascalCase Roblox class name.
 *
 * ```ts
 * resolveTag("textlabel"); // "TextLabel"
 * resolveTag("frame");     // "Frame"
 * resolveTag("div");       // "div" — returns nil for unknown tags
 * ```
 *
 * @param tag - A lowercase tag name string.
 * @returns The PascalCase Roblox class name, or `undefined` if not found.
 */
export function resolveTag(tag: string): string | undefined {
	return getClassCache()[tag];
}
