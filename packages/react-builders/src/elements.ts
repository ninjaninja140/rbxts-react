/**
 * Concrete builder classes for common Roblox GUI types.
 *
 * Each class pins the `BaseBuilder<T>` type parameter to a specific Roblox
 * class so `.set()` is fully type-checked, and adds ergonomic shorthand
 * methods for that class's most-used properties.
 *
 * ```ts
 * import { Frame, TextLabel, UIListLayout } from "@nrbx/react-builders";
 *
 * const panel = new Frame()
 *   .setBackground(Color3.fromRGB(255, 255, 255))
 *   .setSize(new UDim2(0, 300, 0, 200))
 *   .addChildComponent(c => c.setType("TextLabel").setText("Hello"));
 * ```
 *
 * @module elements
 * @packageDocumentation
 */

import { BaseBuilder } from './base';
import { resolveColorValue } from './colors';

// Basic GUI containers

/** Builder for a `Frame`. */
export class Frame extends BaseBuilder<'Frame'> {
	constructor() {
		super('Frame');
	}
}

/** Builder for a `CanvasGroup`. */
export class CanvasGroup extends BaseBuilder<'CanvasGroup'> {
	constructor() {
		super('CanvasGroup');
	}

	/** Sets `GroupColor3`. Accepts a `Color3` or a color string. */
	setGroupColor(value: Color3 | string): this {
		this.setProperty('GroupColor3', resolveColorValue(value));
		return this;
	}

	/** Sets `GroupTransparency`. */
	setGroupTransparency(value: number): this {
		this.setProperty('GroupTransparency', value);
		return this;
	}
}

/** Builder for a `ScrollingFrame`. */
export class ScrollingFrame extends BaseBuilder<'ScrollingFrame'> {
	constructor() {
		super('ScrollingFrame');
	}

	/** Sets `ScrollingDirection`. */
	setScrollingDirection(value: Enum.ScrollingDirection): this {
		this.setProperty('ScrollingDirection', value);
		return this;
	}

	/** Sets `ScrollBarThickness`. */
	setScrollBarThickness(value: number): this {
		this.setProperty('ScrollBarThickness', value);
		return this;
	}

	/** Sets `ScrollBarImageColor3`. Accepts a `Color3` or a color string. */
	setScrollBarImageColor(value: Color3 | string): this {
		this.setProperty('ScrollBarImageColor3', resolveColorValue(value));
		return this;
	}

	/** Sets `ScrollBarImageTransparency`. */
	setScrollBarImageTransparency(value: number): this {
		this.setProperty('ScrollBarImageTransparency', value);
		return this;
	}

	/** Sets `CanvasSize`. */
	setCanvasSize(value: UDim2): this {
		this.setProperty('CanvasSize', value);
		return this;
	}

	/** Sets `CanvasPosition`. */
	setCanvasPosition(value: Vector2): this {
		this.setProperty('CanvasPosition', value);
		return this;
	}

	/** Sets `VerticalScrollBarPosition`. */
	setVerticalScrollBarPosition(value: Enum.VerticalScrollBarPosition): this {
		this.setProperty('VerticalScrollBarPosition', value);
		return this;
	}

	/** Sets `HorizontalScrollBarInset`. */
	setHorizontalScrollBarInset(value: Enum.ScrollBarInset): this {
		this.setProperty('HorizontalScrollBarInset', value);
		return this;
	}
}

/** Builder for a `ViewportFrame`. */
export class ViewportFrame extends BaseBuilder<'ViewportFrame'> {
	constructor() {
		super('ViewportFrame');
	}

	/** Sets `CurrentCamera`. */
	setCurrentCamera(value: Camera): this {
		this.setProperty('CurrentCamera', value);
		return this;
	}
}

// Text elements

/** Builder for a `TextLabel`. */
export class TextLabel extends BaseBuilder<'TextLabel'> {
	constructor() {
		super('TextLabel');
	}
}

/** Builder for a `TextButton`. */
export class TextButton extends BaseBuilder<'TextButton'> {
	constructor() {
		super('TextButton');
	}
}

/** Builder for a `TextBox`. */
export class TextBox extends BaseBuilder<'TextBox'> {
	constructor() {
		super('TextBox');
	}

	/** Sets `PlaceholderText`. */
	setPlaceholderText(value: string): this {
		this.setProperty('PlaceholderText', value);
		return this;
	}

	/** Sets `PlaceholderColor3`. Accepts a `Color3` or a color string. */
	setPlaceholderColor(value: Color3 | string): this {
		this.setProperty('PlaceholderColor3', resolveColorValue(value));
		return this;
	}

	/** Sets `ClearTextOnFocus`. */
	setClearTextOnFocus(value: boolean): this {
		this.setProperty('ClearTextOnFocus', value);
		return this;
	}

	/** Sets `MultiLine`. */
	setMultiLine(value: boolean): this {
		this.setProperty('MultiLine', value);
		return this;
	}

	/** Sets `ShowNativeInput`. */
	setShowNativeInput(value: boolean): this {
		this.setProperty('ShowNativeInput', value);
		return this;
	}
}

// Image elements

/** Builder for an `ImageLabel`. */
export class ImageLabel extends BaseBuilder<'ImageLabel'> {
	constructor() {
		super('ImageLabel');
	}
}

/** Builder for an `ImageButton`. */
export class ImageButton extends BaseBuilder<'ImageButton'> {
	constructor() {
		super('ImageButton');
	}
}

// Layouts

/** Builder for a `UIListLayout`. */
export class UIListLayout extends BaseBuilder<'UIListLayout'> {
	constructor() {
		super('UIListLayout');
	}

	/** Sets `FillDirection`. */
	setFillDirection(value: Enum.FillDirection): this {
		this.setProperty('FillDirection', value);
		return this;
	}

	/** Sets `HorizontalAlignment`. */
	setHorizontalAlignment(value: Enum.HorizontalAlignment): this {
		this.setProperty('HorizontalAlignment', value);
		return this;
	}

	/** Sets `VerticalAlignment`. */
	setVerticalAlignment(value: Enum.VerticalAlignment): this {
		this.setProperty('VerticalAlignment', value);
		return this;
	}

	/** Sets `Padding`. */
	setPadding(value: UDim): this {
		this.setProperty('Padding', value);
		return this;
	}

	/** Sets `Wraps`. */
	setWraps(value: boolean): this {
		this.setProperty('Wraps', value);
		return this;
	}

	/** Sets `SortOrder`. */
	setSortOrder(value: Enum.SortOrder): this {
		this.setProperty('SortOrder', value);
		return this;
	}
}

/** Builder for a `UIGridLayout`. */
export class UIGridLayout extends BaseBuilder<'UIGridLayout'> {
	constructor() {
		super('UIGridLayout');
	}

	/** Sets `CellSize`. */
	setCellSize(value: UDim2): this {
		this.setProperty('CellSize', value);
		return this;
	}

	/** Sets `CellPadding`. */
	setCellPadding(value: UDim2): this {
		this.setProperty('CellPadding', value);
		return this;
	}

	/** Sets `FillDirectionMaxCells`. */
	setFillDirectionMaxCells(value: number): this {
		this.setProperty('FillDirectionMaxCells', value);
		return this;
	}

	/** Sets `HorizontalAlignment`. */
	setHorizontalAlignment(value: Enum.HorizontalAlignment): this {
		this.setProperty('HorizontalAlignment', value);
		return this;
	}

	/** Sets `VerticalAlignment`. */
	setVerticalAlignment(value: Enum.VerticalAlignment): this {
		this.setProperty('VerticalAlignment', value);
		return this;
	}

	/** Sets `SortOrder`. */
	setSortOrder(value: Enum.SortOrder): this {
		this.setProperty('SortOrder', value);
		return this;
	}
}

/** Builder for a `UIPageLayout`. */
export class UIPageLayout extends BaseBuilder<'UIPageLayout'> {
	constructor() {
		super('UIPageLayout');
	}
}

/** Builder for a `UITableLayout`. */
export class UITableLayout extends BaseBuilder<'UITableLayout'> {
	constructor() {
		super('UITableLayout');
	}
}

// Decorators

/** Builder for a `UIPadding`. */
export class UIPadding extends BaseBuilder<'UIPadding'> {
	constructor() {
		super('UIPadding');
	}

	/** Sets `PaddingLeft`. */
	setPaddingLeft(value: UDim): this {
		this.setProperty('PaddingLeft', value);
		return this;
	}

	/** Sets `PaddingRight`. */
	setPaddingRight(value: UDim): this {
		this.setProperty('PaddingRight', value);
		return this;
	}

	/** Sets `PaddingTop`. */
	setPaddingTop(value: UDim): this {
		this.setProperty('PaddingTop', value);
		return this;
	}

	/** Sets `PaddingBottom`. */
	setPaddingBottom(value: UDim): this {
		this.setProperty('PaddingBottom', value);
		return this;
	}
}

/** Builder for a `UICorner`. */
export class UICorner extends BaseBuilder<'UICorner'> {
	constructor() {
		super('UICorner');
	}

	/** Sets `CornerRadius`. */
	setCornerRadius(value: UDim): this {
		this.setProperty('CornerRadius', value);
		return this;
	}
}

/** Builder for a `UIStroke`. */
export class UIStroke extends BaseBuilder<'UIStroke'> {
	constructor() {
		super('UIStroke');
	}

	/** Sets `Color`. Accepts a `Color3` or a color string. */
	setStrokeColor(value: Color3 | string): this {
		this.setProperty('Color', resolveColorValue(value));
		return this;
	}

	/** Sets `Thickness`. */
	setStrokeThickness(value: number): this {
		this.setProperty('Thickness', value);
		return this;
	}

	/** Sets `Transparency`. */
	setStrokeTransparency(value: number): this {
		this.setProperty('Transparency', value);
		return this;
	}

	/** Sets `ApplyStrokeMode`. */
	setApplyStrokeMode(value: Enum.ApplyStrokeMode): this {
		this.setProperty('ApplyStrokeMode', value);
		return this;
	}

	/** Sets `LineJoinMode`. */
	setLineJoinMode(value: Enum.LineJoinMode): this {
		this.setProperty('LineJoinMode', value);
		return this;
	}
}

/** Builder for a `UIGradient`. */
export class UIGradient extends BaseBuilder<'UIGradient'> {
	constructor() {
		super('UIGradient');
	}

	/** Sets `Color`. */
	setGradientColor(value: ColorSequence): this {
		this.setProperty('Color', value);
		return this;
	}

	/** Sets `Rotation`. */
	setGradientRotation(value: number): this {
		this.setProperty('Rotation', value);
		return this;
	}

	/** Sets `Transparency`. */
	setGradientTransparency(value: NumberSequence): this {
		this.setProperty('Transparency', value);
		return this;
	}

	/** Sets `Offset`. */
	setGradientOffset(value: Vector2): this {
		this.setProperty('Offset', value);
		return this;
	}
}

// Constraints

/** Builder for a `UIAspectRatioConstraint`. */
export class UIAspectRatioConstraint extends BaseBuilder<'UIAspectRatioConstraint'> {
	constructor() {
		super('UIAspectRatioConstraint');
	}
}

/** Builder for a `UISizeConstraint`. */
export class UISizeConstraint extends BaseBuilder<'UISizeConstraint'> {
	constructor() {
		super('UISizeConstraint');
	}
}

/** Builder for a `UITextSizeConstraint`. */
export class UITextSizeConstraint extends BaseBuilder<'UITextSizeConstraint'> {
	constructor() {
		super('UITextSizeConstraint');
	}
}
