/**
 * Text element creation and capability checking.
 *
 * @module text/create-element
 * @packageDocumentation
 */

import { getTextOptions } from './config';

// Known text-capable Roblox classes

const TEXT_CAPABLE = new Set<string>(['TextLabel', 'TextButton', 'TextBox']);

/**
 * Checks whether a Roblox class natively supports displaying text
 * (has a `Text` property).
 *
 * @param className - The Roblox class name.
 * @returns `true` if the class accepts a `Text` property.
 */
export function isTextCapableParent(className: string): boolean {
	return TEXT_CAPABLE.has(className);
}

// createTextElement

/**
 * Creates a props table for a `TextLabel` configured by the text-as-children
 * system. The label has `BackgroundTransparency = 1` and is set up with
 * the configured font, size, color, and alignment.
 *
 * @param text - The text content (string or number — numbers are stringified).
 * @param parentClassName - The class name of the parent, for override lookup.
 * @returns A props table suitable for passing to `React.createElement("TextLabel", ...)`.
 *
 * @example
 * ```ts
 * const props = createTextElement("Hello!", "Frame");
 * // => { Text: "Hello!", Font: Gotham, TextSize: 14, BackgroundTransparency: 1, ... }
 * ```
 */
export function createTextElement(text: string | number, parentClassName = 'Frame'): Record<string, unknown> {
	const options = getTextOptions(parentClassName);
	const textStr = tostring(text);

	const props: Record<string, unknown> = {
		Text: textStr,
		Font: options.font,
		TextSize: options.textSize,
		TextColor3: options.textColor,
		BackgroundTransparency: 1,
		BorderSizePixel: 0,
		TextXAlignment: options.textXAlignment,
		TextYAlignment: options.textYAlignment,
		TextWrapped: options.textWrapped,
	};

	if (options.fontWeight) {
		// FontFace requires a string family name; use Font.fromEnum or similar
		// in practice. For now we just set the Font property.
	}

	if (options.autoSize) {
		props.AutomaticSize = Enum.AutomaticSize.XY;
	}

	return props;
}
