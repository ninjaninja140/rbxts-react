/**
 * `cn` — conditional class-name joiner.
 *
 * Utility function for combining Tailwind class names conditionally.
 * Falsy values (`undefined`, `false`, `0`) are ignored.
 *
 * ```tsx
 * <frame className={cn("flex p-4", isActive && "bg-blue-500", isDisabled && "opacity-50")} />
 * ```
 *
 * @module styles/cn
 * @packageDocumentation
 */

/**
 * Conditionally joins class names together, filtering out falsy values.
 *
 * **Tip:** Use this with the `className` prop on any JSX element. The
 * `className` will be resolved automatically by the styles system.
 *
 * ```tsx
 * <frame className={cn(
 *   "flex items-center",
 *   isSelected && "bg-blue-500",
 *   disabled && "opacity-50 pointer-events-none",
 * )} />
 * ```
 *
 * @param args - Class name strings and/or falsy values to filter.
 * @returns A space-separated class name string.
 */
export function cn(...args: (string | undefined | boolean | 0)[]): string {
	const classes: string[] = [];
	for (const arg of args) {
		if (arg && arg !== true) {
			classes.push(tostring(arg));
		}
	}
	return classes.join(' ');
}
