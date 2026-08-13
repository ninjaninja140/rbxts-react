/**
 * `tw` — the Tailwind class-name resolver, usable as both a tagged
 * template literal and a function call.
 *
 * ```tsx
 * // Tagged template literal:
 * <frame {...tw`flex flex-col p-4 bg-blue-500 rounded`} />
 *
 * // Function call:
 * <frame {...tw("flex flex-col p-4 bg-blue-500 rounded")} />
 * ```
 *
 * @module styles/tw
 * @packageDocumentation
 */

import { resolveClassName } from './parser';

declare function type(value: unknown): string;

/**
 * Resolves Tailwind class names to Roblox GUI style props.
 *
 * When called as a tagged template literal:
 * ```tsx
 * <frame {...tw`flex p-4 bg-blue-500`} />
 * ```
 *
 * When called as a function:
 * ```tsx
 * <frame {...tw("flex p-4 bg-blue-500")} />
 * ```
 *
 * The returned props object can be spread directly onto a JSX element.
 *
 * @param strings - Template literal strings array, or a plain class-name string.
 * @param values - Template literal interpolation values.
 * @returns A table of Roblox GUI style properties.
 */
export function tw(strings: TemplateStringsArray | string, ...values: unknown[]): Record<string, unknown> {
	// Function-call form: tw("flex p-4")
	if (type(strings) === 'string') {
		return resolveClassName(strings as string);
	}

	// Tagged template literal form: tw`flex p-4`
	const parts: string[] = [];
	const strs = strings as TemplateStringsArray;
	for (let i = 0; i < strs.size(); i++) {
		parts.push(strs[i]);
		if (i < values.size()) {
			const v = values[i];
			if (v !== undefined && v !== false) {
				parts.push(tostring(v));
			}
		}
	}
	return resolveClassName(parts.join(' '));
}
