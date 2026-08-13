/**
 * Types for the text-as-children system.
 *
 * @module text/types
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

/** Options for auto-created TextLabel elements. */
export interface TextChildOptions {
	/** Font face. Default: `Enum.Font.Gotham`. */
	font: Enum.Font;
	/** Text size in points. Default: `14`. */
	textSize: number;
	/** Text color. Default: white. */
	textColor: Color3;
	/** Whether the label auto-sizes. Default: `true`. */
	autoSize: boolean;
	/** Font weight (for FontFace styling). */
	fontWeight?: Enum.FontWeight;
	/** Horizontal text alignment. */
	textXAlignment: Enum.TextXAlignment;
	/** Vertical text alignment. */
	textYAlignment: Enum.TextYAlignment;
	/** Whether text wraps for multi-line content. Default: `true`. */
	textWrapped: boolean;
}

/** Per-Roblox-class text option overrides. */
export type TextChildOverrides = Partial<Record<string, Partial<TextChildOptions>>>;

/** Global text-as-children configuration. */
export interface TextChildConfig {
	defaults: TextChildOptions;
	overrides: TextChildOverrides;
}
