/**
 * Native style editor contracts.
 *
 * The native style editor is a React Native feature that has no Roblox
 * equivalent. The type shapes are kept so the rest of the backend can compile
 * against the same contracts, but no runtime implementation is provided.
 *
 * Ported from `react-devtools-shared/src/backend/NativeStyleEditor/types.js`.
 *
 * @module NativeStyleEditor
 * @packageDocumentation
 */

export interface BoxStyle {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

export interface Layout {
	x: number;
	y: number;
	width: number;
	height: number;
	left: number;
	top: number;
	margin: BoxStyle;
	padding: BoxStyle;
}

export type Style = Record<string, unknown>;

export interface StyleAndLayout {
	id: number;
	style: Style | undefined;
	layout: Layout | undefined;
}
