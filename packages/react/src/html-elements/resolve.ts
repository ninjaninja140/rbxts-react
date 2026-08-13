/**
 * Resolution helpers for HTML→Roblox element mapping.
 *
 * @module html-elements/resolve
 * @packageDocumentation
 */

import { DEFAULT_HTML_ELEMENT_MAP, type HTMLElementMap } from './map';
import { getHeadingConfig, getSpecialElementConfig } from './config';

// Mutable state — allows user to override the map

const elementMap: HTMLElementMap = { ...DEFAULT_HTML_ELEMENT_MAP };

// Public API

/**
 * Returns the Roblox `ClassName` for an HTML tag, or `undefined` if
 * the tag is not in the map.
 *
 * ```ts
 * mapHTMLToRoblox("div");  // => "Frame"
 * mapHTMLToRoblox("span"); // => "TextLabel"
 * mapHTMLToRoblox("article"); // => "Frame"
 * ```
 *
 * @param htmlTag - The lowercase HTML tag name.
 * @returns The Roblox ClassName, or `undefined`.
 */
export function mapHTMLToRoblox(htmlTag: string): string | undefined {
	return elementMap[htmlTag];
}

/**
 * Returns `true` if the tag is a known HTML element (not a native
 * Roblox class).
 *
 * @param tag - The case-sensitive tag from JSX.
 * @returns Whether this tag maps to an HTML element.
 */
export function isHTMLElement(tag: string): boolean {
	return elementMap[tag.lower()] !== undefined;
}

/**
 * Override all or part of the HTML→Roblox element map.
 *
 * ```ts
 * import { setHTMLElementMap } from "@nrbx/react";
 *
 * setHTMLElementMap({ div: "ScrollingFrame", custom: "Frame" });
 * ```
 *
 * @param partialMap - Entries to merge into the existing map.
 */
export function setHTMLElementMap(partialMap: HTMLElementMap): void {
	for (const [key, value] of pairs(partialMap)) {
		elementMap[key] = value;
	}
}

/**
 * Resolves the default props for a heading or special HTML element.
 *
 * Applied when an HTML tag is used in JSX and no explicit prop
 * overrides the default. Heading tags (h1-h6) will have their
 * font and text size set automatically.
 *
 * @param tag - The lowercase HTML tag.
 * @returns A props table, or `undefined`
 */
export function resolveHTMLElementDefaults(tag: string): Record<string, unknown> | undefined {
	const heading = getHeadingConfig(tag);
	if (heading) {
		return {
			Font: heading.font,
			TextSize: heading.size,
			...(heading.color ? { TextColor3: heading.color } : {}),
		};
	}

	const special = getSpecialElementConfig(tag);
	if (special) {
		const props: Record<string, unknown> = {};
		if (special.font !== undefined) props.Font = special.font;
		if (special.textSize !== undefined) props.TextSize = special.textSize;
		if (special.backgroundTransparency !== undefined) props.BackgroundTransparency = special.backgroundTransparency;
		return props;
	}

	return undefined;
}
