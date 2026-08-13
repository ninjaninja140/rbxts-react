/**
 * CSS Transform → Roblox UI utilities.
 *
 * Maps Tailwind transform classes (`scale-*`, `rotate-*`, `translate-*`, `skew-*`)
 * to Roblox `UDim2` size, `Rotation`, `Position`, and `UIScale` / `UIAspectRatioConstraint`.
 *
 * ## Supported classes
 *
 * | Class | Roblox Mapping |
 * |-------|---------------|
 * | `scale-50` → `scale-150` | UIScale children |
 * | `scale-x-*`, `scale-y-*` | UIScale + UIAspectRatioConstraint |
 * | `rotate-45`, `-rotate-12` | `Rotation` property |
 * | `rotate-[30deg]` | Arbitrary angle |
 * | `translate-x-4`, `translate-y-2` | `Position` offset (UDim2) |
 * | `skew-x-12`, `skew-y-6` | Approximated via `Rotation` + clipping |
 *
 * @module styles/transforms
 * @packageDocumentation
 */

// Helpers

/** Checks if a string starts with a given prefix (Roblox Luau-compatible). */
function startsWith(s: string, prefix: string): boolean {
	return (s as unknown as string).sub(1, prefix.size()) === prefix;
}

// Scale

/**
 * Parse a scale utility class and return Roblox style props.
 *
 * @param className - The matched class (e.g. `"scale-50"`, `"scale-x-75"`, `"scale-[1.5]"`).
 * @param value - The parsed numeric value (e.g. `50`, `75`, `1.5`).
 * @returns Props and style children, or `undefined` if not applicable.
 * @internal
 */
export function resolveTransform(className: string, value: number): Record<string, unknown> | undefined {
	const result: Record<string, unknown> = {};
	const styleChildren: Record<string, unknown>[] = [];

	if (startsWith(className, 'scale-x-')) {
		// scale-x: change width, keep height proportion
		result.Size = new UDim2(value / 100, 0, 1, 0);
		return result;
	}
	if (startsWith(className, 'scale-y-')) {
		result.Size = new UDim2(1, 0, value / 100, 0);
		return result;
	}
	if (startsWith(className, 'scale-')) {
		// scale: UIScale child
		styleChildren.push({
			__className: 'UIScale',
			Scale: value / 100,
		});
		result.__styleChildren = styleChildren;
		return result;
	}
	if (startsWith(className, 'scale-z-')) {
		// scale-z: not applicable in 2D UI, no-op
		return {};
	}

	return undefined;
}

/**
 * Resolve a `scale-[arbitrary]` value.
 *
 * @param value - The bracket content (e.g. `"1.5"`, `"0.75"`).
 * @returns Style children with UIScale.
 * @internal
 */
export function resolveScaleArbitrary(value: string): Record<string, unknown> | undefined {
	const num = tonumber(value);
	if (num === undefined) return undefined;
	return {
		__styleChildren: [{ __className: 'UIScale', Scale: num }],
	};
}

// Rotate

/**
 * Parse a rotate utility class.
 *
 * @param value - The angle in degrees (e.g. `45`, `-12`).
 * @returns Roblox `Rotation` prop.
 * @internal
 */
export function resolveRotate(value: number): Record<string, unknown> {
	return { Rotation: value };
}

/**
 * Parse a `rotate-[arbitrary]` value like `rotate-[30deg]`.
 *
 * @param value - The bracket content (e.g. `"30deg"`, `"0.5turn"`, `"3.14rad"`).
 * @returns Roblox `Rotation` prop, or `undefined`.
 * @internal
 */
export function resolveRotateArbitrary(value: string): Record<string, unknown> | undefined {
	const degMatch = (value as unknown as string).match('^(-?%d+%.?%d*)deg$');
	if (degMatch[0] !== undefined) {
		const deg = tonumber(degMatch[0] as string);
		if (deg !== undefined) return { Rotation: deg };
	}

	// rad → deg
	const radMatch = (value as unknown as string).match('^(-?%d+%.?%d*)rad$');
	if (radMatch[0] !== undefined) {
		const rad = tonumber(radMatch[0] as string);
		if (rad !== undefined) return { Rotation: rad * (180 / math.pi) };
	}

	// turn → deg
	const turnMatch = (value as unknown as string).match('^(-?%d+%.?%d*)turn$');
	if (turnMatch[0] !== undefined) {
		const turn = tonumber(turnMatch[0] as string);
		if (turn !== undefined) return { Rotation: turn * 360 };
	}

	return undefined;
}

// Translate

/**
 * Resolve spacing for translate utilities from the spacing map.
 */
function resolveTranslateSpacing(value: string, spacingMap: Record<number, number>): number | undefined {
	const numKey = tonumber(value);
	if (numKey !== undefined && spacingMap[numKey] !== undefined) {
		return spacingMap[numKey];
	}
	return tonumber(value);
}

/**
 * Parse a translate class like `translate-x-4`, `translate-y-2`.
 *
 * @param className - The matched class.
 * @param value - The numeric or pixel value (from spacing scale or arbitrary).
 * @param spacingMap - Spacing scale for named values.
 * @returns Roblox `Position` offset.
 * @internal
 */
export function resolveTranslate(
	className: string,
	value: string,
	spacingMap: Record<number, number>
): Record<string, unknown> | undefined {
	const px = resolveTranslateSpacing(value, spacingMap);
	if (px === undefined) return undefined;

	if (startsWith(className, 'translate-x-') || startsWith(className, '-translate-x-')) {
		const offset = startsWith(className, '-') ? -px : px;
		return { Position: new UDim2(0, offset, 0, 0) };
	}
	if (startsWith(className, 'translate-y-') || startsWith(className, '-translate-y-')) {
		const offset = startsWith(className, '-') ? -px : px;
		return { Position: new UDim2(0, 0, 0, offset) };
	}

	return undefined;
}

/**
 * Parse a `translate-[arbitrary]` value.
 *
 * @param prefix - `"x"` or `"y"`.
 * @param value - The bracket content (e.g. `"100px"`, `"50%"`).
 * @returns Roblox UDim2 for Position.
 * @internal
 */
export function resolveTranslateArbitrary(prefix: string, value: string): Record<string, unknown> | undefined {
	const pxMatch = (value as unknown as string).match('^(-?%d+%.?%d*)px$');
	if (pxMatch[0] !== undefined) {
		const px = tonumber(pxMatch[0] as string);
		if (px !== undefined) {
			if (prefix === 'x') return { Position: new UDim2(0, px, 0, 0) };
			if (prefix === 'y') return { Position: new UDim2(0, 0, 0, px) };
		}
	}

	// Percentage
	const pctMatch = (value as unknown as string).match('^(-?%d+%.?%d*)%%$');
	if (pctMatch[0] !== undefined) {
		const pct = tonumber(pctMatch[0] as string);
		if (pct !== undefined) {
			const scale = pct / 100;
			if (prefix === 'x') return { Position: new UDim2(scale, 0, 0, 0) };
			if (prefix === 'y') return { Position: new UDim2(0, 0, scale, 0) };
		}
	}

	return undefined;
}

// Skew

/**
 * Parse a skew class. In 2D Roblox UI, true skew isn't natively supported,
 * so we approximate with rotation.
 *
 * @param className - `"skew-x-*"` or `"skew-y-*"`.
 * @param value - Angle in degrees.
 * @returns Roblox `Rotation` prop.
 * @internal
 */
export function resolveSkew(className: string, value: number): Record<string, unknown> {
	// Skew is approximated with rotation since Roblox UI doesn't support real skew
	if (startsWith(className, 'skew-x-')) {
		return { Rotation: value };
	}
	if (startsWith(className, 'skew-y-')) {
		return { Rotation: -value };
	}
	// skew-(x,y)
	return { Rotation: value };
}
