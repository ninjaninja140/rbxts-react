/**
 * Core class-name → Roblox props resolver.
 *
 * Parses a space-separated list of Tailwind-style class names and produces
 * a table of Roblox GUI properties. This is the engine behind `tw()` and
 * the `className` prop resolution.
 *
 * @module styles/parser
 * @packageDocumentation
 */

import type { ResolvedStyleConfig } from './types';
import { resolveColor, parseArbitraryColor, parseArbitraryLength } from './colors';
import type { CSSRules, CustomResolver, ExperimentalFlags } from './custom-store';
import { getCustomCSSRules, getCustomResolver, getExperimentalFlags } from './custom-store';
import {
	resolveTransform,
	resolveScaleArbitrary,
	resolveRotate,
	resolveRotateArbitrary,
	resolveTranslate,
	resolveTranslateArbitrary,
	resolveSkew,
} from './transforms';
import {
	isGradientDirection,
	getGradientDirection,
	createGradientBuilder,
	applyGradientColor,
	buildGradient,
	type GradientBuilder,
} from './gradients';
import { isAnimationClass, resolveAnimation } from './animations';

// resolveSpacing

/**
 * Resolves a spacing value from a string key to pixels.
 *
 * @param value - The spacing key (e.g. `"4"`, `"8"`, `"0.5"`).
 * @param spacingMap - The spacing scale to look up.
 * @returns Pixels, or `undefined` if not found.
 */
function resolveSpacing(value: string, spacingMap: Record<number, number>): number | undefined {
	const numKey = tonumber(value);
	if (numKey !== undefined && spacingMap[numKey] !== undefined) {
		return spacingMap[numKey];
	}
	// Approximate fractional values
	const floatKey = tonumber(value);
	if (floatKey !== undefined) {
		return math.floor(floatKey * 4);
	}
	return undefined;
}

// parseArbitraryValue — handles bg-[#ff0000], w-[100px], etc.

/**
 * Result of parsing an arbitrary Tailwind value (`[...]` syntax).
 */
interface ArbitraryValueResult {
	/** The Roblox property name(s) → value mapping to merge into props. */
	props?: Record<string, unknown>;
	/** Virtual children (e.g. UICorner for rounded-[12px]). */
	styleChildren?: Record<string, unknown>[];
	/** A JSX.Element-style child to append (e.g. for UIGradient). */
	childElements?: Record<string, unknown>[];
}

/**
 * Parse a `[...]-wrapped arbitrary value` against a Tailwind utility prefix.
 *
 * Handles:
 * - Colors: `bg-[#ff0000]`, `text-[rgb(255,0,0)]`, `border-[rgba(0,0,0,0.2)]`
 * - Lengths: `w-[100px]`, `h-[50px]`, `p-[8px]`, `m-[4px]`, `gap-[12px]`
 * - Opacity: `opacity-[50]`
 * - Border radius: `rounded-[12px]`
 *
 * @param new_str prefix - The utility prefix (e.g. `"bg"`, `"text"`, `"w"`).
 * @param value - The bracket contents (e.g. `"#ff0000"`, `"100px"`).
 * @param cfg - The resolved style configuration.
 * @returns Resolved props and style children, or `undefined`.
 * @internal
 */
function parseArbitraryValue(
	prefix: string,
	value: string,
	_cfg: ResolvedStyleConfig
): ArbitraryValueResult | undefined {
	const colorResult = parseArbitraryColor(value);

	if (colorResult) {
		const result: ArbitraryValueResult = { props: {} };
		if (prefix === 'bg') {
			result.props!.BackgroundColor3 = colorResult.color;
			result.props!.BackgroundTransparency = colorResult.transparency ?? 0;
		} else if (prefix === 'text') {
			result.props!.TextColor3 = colorResult.color;
			if (colorResult.transparency !== undefined) {
				result.props!.TextTransparency = colorResult.transparency;
			}
		} else if (prefix === 'border') {
			result.props!.BorderColor3 = colorResult.color;
			result.props!.BorderSizePixel = 1;
			if (colorResult.transparency !== undefined) {
				// Roblox doesn't have BorderTransparency per-se; approximate with color darkening
				// Actually, UIStroke has Transparency. For simple borders, just set the color.
				result.props!.BorderColor3 = colorResult.color;
			}
		} else if (prefix === 'shadow') {
			// shadow-[color] → subtle border
			result.props!.BorderSizePixel = 1;
			result.props!.BorderColor3 = colorResult.color;
		}
		return result;
	}

	const lengthPx = parseArbitraryLength(value);
	if (lengthPx !== undefined) {
		const result: ArbitraryValueResult = { props: {} };
		if (prefix === 'w') {
			result.props!.Size = new UDim2(0, lengthPx, 0, 0);
		} else if (prefix === 'h') {
			result.props!.Size = new UDim2(0, 0, 0, lengthPx);
		} else if (
			prefix === 'p' ||
			prefix === 'px' ||
			prefix === 'py' ||
			prefix === 'pt' ||
			prefix === 'pr' ||
			prefix === 'pb' ||
			prefix === 'pl'
		) {
			result.styleChildren = [
				{
					__className: 'UIPadding',
					[`Padding${prefix.sub(2).upper()}`]: new UDim(0, lengthPx),
				},
			];
		} else if (
			prefix === 'm' ||
			prefix === 'mx' ||
			prefix === 'my' ||
			prefix === 'mt' ||
			prefix === 'mr' ||
			prefix === 'mb' ||
			prefix === 'ml'
		) {
			result.styleChildren = [
				{
					__className: 'UIPadding',
					[`Padding${prefix.sub(2).upper()}`]: new UDim(0, lengthPx),
				},
			];
		} else if (prefix === 'gap') {
			result.styleChildren = [
				{
					__className: 'UIPadding',
					PaddingTop: new UDim(0, lengthPx),
				},
			];
		} else if (prefix === 'rounded') {
			result.styleChildren = [
				{
					__className: 'UICorner',
					CornerRadius: new UDim(0, lengthPx),
				},
			];
		} else if (prefix === 'opacity') {
			// opacity-[50] means 50% opacity
			result.props!.BackgroundTransparency = 1 - lengthPx / 100;
		}
		return result;
	}

	return undefined;
}

// resolveClassNameWithConfig — the core resolver

/**
 * Resolves a space-separated Tailwind class-name string to a table of
 * Roblox GUI style properties, using a specific style configuration.
 *
 * @param className - The raw class-name string (e.g. `"flex p-4 bg-blue-500"`).
 * @param cfg - The resolved style configuration to use.
 * @returns A table mapping Roblox property names to their values.
 *
 * @internal
 */
export function resolveClassNameWithConfig(className: string, cfg: ResolvedStyleConfig): Record<string, unknown> {
	const props: Record<string, unknown> = {};
	const styleChildren: Record<string, unknown>[] = [];
	let hasFlex = false;

	// Normalize whitespace and split
	const normalized = className.gsub('%s+', ' ')[0].gsub('^%s+', '')[0].gsub('%s+$', '')[0];

	const classes = normalized.split(' ');

	const customRules: CSSRules = getCustomCSSRules();
	const customResolverFn: CustomResolver | undefined = getCustomResolver();
	const expFlags: ExperimentalFlags = getExperimentalFlags();

	// Accumulate hover props separately (for `hover:` prefix)
	let hoverProps: Record<string, unknown> | undefined;
	let hoverStyleChildren: Record<string, unknown>[] | undefined;

	// Gradient builder — accumulates from→to→via across class names
	const gradientBuilder: GradientBuilder = createGradientBuilder();

	for (const cls of classes) {
		if (cls === '') continue;

		// Strip `hover:` and resolve the remainder into hover-specific props.
		{
			const hoverMatch = (cls as unknown as string).match('^hover:(.+)$');
			if (hoverMatch[0] !== undefined) {
				const inner = hoverMatch[0] as string;
				// Resolve the inner class in a mini-recursive call (limited: single inner class)
				const hoverResolved = resolveClassNameWithConfig(inner, cfg);
				if (hoverResolved) {
					if (!hoverProps) hoverProps = {};
					for (const [k, v] of pairs(hoverResolved)) {
						const key = k as string;
						if (key !== '__styleChildren' && key !== '__className') {
							hoverProps[key] = v;
						}
					}
					const hsc = hoverResolved.__styleChildren as Record<string, unknown>[] | undefined;
					if (hsc) {
						if (!hoverStyleChildren) hoverStyleChildren = [];
						for (const sc of hsc) {
							hoverStyleChildren.push(sc);
						}
					}
				}
				continue;
			}
		}

		{
			const ghMatch = (cls as unknown as string).match('^group%-hover:(.+)$');
			if (ghMatch[0] !== undefined) {
				const inner = ghMatch[0] as string;
				const hoverResolved = resolveClassNameWithConfig(inner, cfg);
				if (hoverResolved) {
					if (!hoverProps) hoverProps = {};
					for (const [k, v] of pairs(hoverResolved)) {
						const key = k as string;
						if (key !== '__styleChildren' && key !== '__className') {
							hoverProps[key] = v;
						}
					}
					const hsc = hoverResolved.__styleChildren as Record<string, unknown>[] | undefined;
					if (hsc) {
						if (!hoverStyleChildren) hoverStyleChildren = [];
						for (const sc of hsc) {
							hoverStyleChildren.push(sc);
						}
					}
				}
				continue;
			}
		}

		if (customResolverFn) {
			const customResult = customResolverFn(cls);
			if (customResult !== undefined) {
				for (const [k, v] of pairs(customResult)) {
					const key = k as string;
					if (key !== '__styleChildren' && key !== '__className') {
						props[key] = v;
					}
				}
				const customStyleChildren = customResult.__styleChildren as Record<string, unknown>[] | undefined;
				if (customStyleChildren) {
					for (const sc of customStyleChildren) {
						styleChildren.push(sc);
					}
				}
				continue;
			}
		}

		const customRule = customRules[cls];
		if (customRule !== undefined) {
			for (const [k, v] of pairs(customRule)) {
				const key = k as string;
				if (key !== '__styleChildren' && key !== '__className') {
					props[key] = v;
				}
			}
			const ruleStyleChildren = customRule.__styleChildren as Record<string, unknown>[] | undefined;
			if (ruleStyleChildren) {
				for (const sc of ruleStyleChildren) {
					styleChildren.push(sc);
				}
			}
			continue;
		}

		{
			const arbMatch = cls.match('^([a-z]+)%-(%[.+%])$');
			if (arbMatch[0] !== undefined) {
				const arbPrefix = arbMatch[0] as string;
				let rawValue = arbMatch[1] as string;
				// Strip the brackets
				rawValue = (rawValue as unknown as string).gsub('^%[', '')[0] as string;
				rawValue = (rawValue as unknown as string).gsub('%]$', '')[0] as string;

				const arbResult = parseArbitraryValue(arbPrefix, rawValue, cfg);
				if (arbResult) {
					if (arbResult.props) {
						for (const [k, v] of pairs(arbResult.props)) {
							props[k as string] = v;
						}
					}
					if (arbResult.styleChildren) {
						for (const sc of arbResult.styleChildren) {
							styleChildren.push(sc);
						}
					}
					continue;
				}
			}
		}

		if (isGradientDirection(cls)) {
			gradientBuilder.active = true;
			gradientBuilder.rotation = getGradientDirection(cls) ?? 270;
			// Apply default black→white if no from/to specified
			gradientBuilder.fromColor = new Color3(0, 0, 0);
			gradientBuilder.toColor = new Color3(1, 1, 1);
			continue;
		}

		{
			const gfm = (cls as unknown as string).match('^(from)%-(%[.+%])$');
			if (gfm[0] !== undefined) {
				let raw = gfm[1] as string;
				raw = (raw as unknown as string).gsub('^%[', '')[0] as string;
				raw = (raw as unknown as string).gsub('%]$', '')[0] as string;
				applyGradientColor(gfm[0] as string, raw, gradientBuilder, cfg.colors);
				continue;
			}
			const gtm = (cls as unknown as string).match('^(to)%-(%[.+%])$');
			if (gtm[0] !== undefined) {
				let raw = gtm[1] as string;
				raw = (raw as unknown as string).gsub('^%[', '')[0] as string;
				raw = (raw as unknown as string).gsub('%]$', '')[0] as string;
				applyGradientColor(gtm[0] as string, raw, gradientBuilder, cfg.colors);
				continue;
			}
			const gvm = (cls as unknown as string).match('^(via)%-(%[.+%])$');
			if (gvm[0] !== undefined) {
				let raw = gvm[1] as string;
				raw = (raw as unknown as string).gsub('^%[', '')[0] as string;
				raw = (raw as unknown as string).gsub('%]$', '')[0] as string;
				applyGradientColor(gvm[0] as string, raw, gradientBuilder, cfg.colors);
				continue;
			}
		}

		if (cls === 'flex') {
			hasFlex = true;
			props.UIFlexItem = { FillDirection: Enum.FillDirection.Horizontal };
			continue;
		}
		if (cls === 'flex-col') {
			hasFlex = true;
			props.UIFlexItem = { FillDirection: Enum.FillDirection.Vertical };
			continue;
		}
		if (cls === 'flex-row') {
			hasFlex = true;
			props.UIFlexItem = { FillDirection: Enum.FillDirection.Horizontal };
			continue;
		}
		if (cls === 'hidden') {
			props.Visible = false;
			continue;
		}
		if (cls === 'block' || cls === 'inline' || cls === 'inline-block' || cls === 'inline-flex') {
			// No-op: Roblox doesn't have CSS display modes
			continue;
		}

		if (expFlags.position) {
			if (cls === 'relative') {
				// "relative" in Roblox terms means the instance can be a positioning
				// anchor for its children. We set up a UIGridLayout by default.
				continue;
			}
			if (cls === 'absolute') {
				// Set size to fill parent (absolute => fill available space)
				props.Size = new UDim2(1, 0, 1, 0);
				props.BackgroundTransparency = 1;
				continue;
			}
			if (cls === 'fixed') {
				// "fixed" → anchored to screen; in Roblox this is just top-level with ignoreGuiInset
				props.IgnoreGuiInset = true;
				continue;
			}

			// Experimental: Grid
			if (expFlags.grid) {
				if (cls === 'grid') {
					hasFlex = true;
					props.UIFlexItem = { FillDirection: Enum.FillDirection.Horizontal };
					// UIGridLayout would be a style child, but it's complex to set up
					continue;
				}
				{
					const gcMatch = cls.match('^grid%-cols%-(%d+)$');
					if (gcMatch) {
						const cols = tonumber(gcMatch[0] as string);
						if (cols !== undefined) {
							styleChildren.push({
								__className: 'UIGridLayout',
								AbsoluteContentSize: new Vector2(0, 0),
								CellPadding: new UDim2(0, 4, 0, 4),
								CellSize: new UDim2(1 / cols, 0, 1, 0),
								FillDirectionMaxCells: cols,
							});
						}
						continue;
					}
				}
				{
					const grMatch = cls.match('^grid%-rows%-(%d+)$');
					if (grMatch) {
						// grid-rows is informational in Roblox since UIListLayout handles scrolling
						continue;
					}
				}
			}
		}

		if (cls === 'items-center') {
			if (!hasFlex) {
				hasFlex = true;
				props.UIFlexItem = {};
			}
			(props.UIFlexItem as Record<string, unknown>).HorizontalAlignment = Enum.HorizontalAlignment.Center;
			continue;
		}
		if (cls === 'items-start') {
			if (!hasFlex) {
				hasFlex = true;
				props.UIFlexItem = {};
			}
			(props.UIFlexItem as Record<string, unknown>).HorizontalAlignment = Enum.HorizontalAlignment.Left;
			continue;
		}
		if (cls === 'items-end') {
			if (!hasFlex) {
				hasFlex = true;
				props.UIFlexItem = {};
			}
			(props.UIFlexItem as Record<string, unknown>).HorizontalAlignment = Enum.HorizontalAlignment.Right;
			continue;
		}
		if (cls === 'justify-center') {
			if (!hasFlex) {
				hasFlex = true;
				props.UIFlexItem = {};
			}
			(props.UIFlexItem as Record<string, unknown>).VerticalAlignment = Enum.VerticalAlignment.Center;
			continue;
		}
		if (cls === 'justify-start') {
			if (!hasFlex) {
				hasFlex = true;
				props.UIFlexItem = {};
			}
			(props.UIFlexItem as Record<string, unknown>).VerticalAlignment = Enum.VerticalAlignment.Top;
			continue;
		}
		if (cls === 'justify-end') {
			if (!hasFlex) {
				hasFlex = true;
				props.UIFlexItem = {};
			}
			(props.UIFlexItem as Record<string, unknown>).VerticalAlignment = Enum.VerticalAlignment.Bottom;
			continue;
		}
		if (cls === 'justify-between') {
			if (!hasFlex) {
				hasFlex = true;
				props.UIFlexItem = {};
			}
			(props.UIFlexItem as Record<string, unknown>).VerticalAlignment = Enum.VerticalAlignment.Center;
			continue;
		}

		{
			const match = (cls as unknown as string).match('^gap%-(.+)$');
			if (match) {
				const gap = resolveSpacing(match[0] as string, cfg.spacing);
				if (gap !== undefined) {
					if (!hasFlex) {
						hasFlex = true;
						props.UIFlexItem = {};
					}
					const flexItem = props.UIFlexItem as Record<string, unknown>;
					flexItem.HorizontalFlex = Enum.UIFlexAlignment.Fill;
					styleChildren.push({
						__className: 'UIPadding',
						PaddingTop: new UDim(0, gap),
					});
				}
				continue;
			}
		}

		const padAll = cls.match('^p%-(.+)$');
		if (padAll) {
			const pad = resolveSpacing(padAll[0] as string, cfg.spacing);
			if (pad !== undefined) {
				styleChildren.push({
					__className: 'UIPadding',
					PaddingTop: new UDim(0, pad),
					PaddingBottom: new UDim(0, pad),
					PaddingLeft: new UDim(0, pad),
					PaddingRight: new UDim(0, pad),
				});
			}
			continue;
		}
		const padX = cls.match('^px%-(.+)$');
		if (padX) {
			const pad = resolveSpacing(padX[0] as string, cfg.spacing);
			if (pad !== undefined) {
				styleChildren.push({
					__className: 'UIPadding',
					PaddingLeft: new UDim(0, pad),
					PaddingRight: new UDim(0, pad),
				});
			}
			continue;
		}
		const padY = cls.match('^py%-(.+)$');
		if (padY) {
			const pad = resolveSpacing(padY[0] as string, cfg.spacing);
			if (pad !== undefined) {
				styleChildren.push({
					__className: 'UIPadding',
					PaddingTop: new UDim(0, pad),
					PaddingBottom: new UDim(0, pad),
				});
			}
			continue;
		}

		for (const side of [
			['pt', 'PaddingTop'],
			['pr', 'PaddingRight'],
			['pb', 'PaddingBottom'],
			['pl', 'PaddingLeft'],
		] as [string, string][]) {
			const m = cls.match(`^${side[0]}%-(.+)$`);
			if (m) {
				const pad = resolveSpacing(m[0] as string, cfg.spacing);
				if (pad !== undefined) {
					styleChildren.push({
						__className: 'UIPadding',
						[side[1]]: new UDim(0, pad),
					});
				}
				break;
			}
		}

		const mAll = cls.match('^m%-(.+)$');
		if (mAll) {
			const m = resolveSpacing(mAll[0] as string, cfg.spacing);
			if (m !== undefined) {
				styleChildren.push({
					__className: 'UIPadding',
					PaddingTop: new UDim(0, m),
					PaddingBottom: new UDim(0, m),
					PaddingLeft: new UDim(0, m),
					PaddingRight: new UDim(0, m),
				});
			}
			continue;
		}
		const mX = cls.match('^mx%-(.+)$');
		if (mX) {
			const m = resolveSpacing(mX[0] as string, cfg.spacing);
			if (m !== undefined) {
				styleChildren.push({
					__className: 'UIPadding',
					PaddingLeft: new UDim(0, m),
					PaddingRight: new UDim(0, m),
				});
			}
			continue;
		}
		const mY = cls.match('^my%-(.+)$');
		if (mY) {
			const m = resolveSpacing(mY[0] as string, cfg.spacing);
			if (m !== undefined) {
				styleChildren.push({
					__className: 'UIPadding',
					PaddingTop: new UDim(0, m),
					PaddingBottom: new UDim(0, m),
				});
			}
			continue;
		}

		if (cls === 'w-full' || cls === 'w-screen') {
			props.Size = new UDim2(1, 0, (props.Size as UDim2)?.Y.Scale ?? 0, (props.Size as UDim2)?.Y.Offset ?? 0);
			continue;
		}
		if (cls === 'w-px') {
			props.Size = new UDim2(0, 1, (props.Size as UDim2)?.Y.Scale ?? 0, (props.Size as UDim2)?.Y.Offset ?? 0);
			continue;
		}
		{
			const wm = cls.match('^w%-(%d+)$');
			if (wm) {
				const px = tonumber(wm[0] as string);
				if (px !== undefined) {
					const currentY = (props.Size as UDim2)?.Y.Scale ?? 0;
					const currentYOff = (props.Size as UDim2)?.Y.Offset ?? 0;
					props.Size = new UDim2(0, px, currentY, currentYOff);
				}
				continue;
			}
		}
		if (cls === 'h-full' || cls === 'h-screen') {
			props.Size = new UDim2((props.Size as UDim2)?.X.Scale ?? 0, (props.Size as UDim2)?.X.Offset ?? 0, 1, 0);
			continue;
		}
		if (cls === 'h-px') {
			props.Size = new UDim2((props.Size as UDim2)?.X.Scale ?? 0, (props.Size as UDim2)?.X.Offset ?? 0, 0, 1);
			continue;
		}
		{
			const hm = cls.match('^h%-(%d+)$');
			if (hm) {
				const px = tonumber(hm[0] as string);
				if (px !== undefined) {
					const currentX = (props.Size as UDim2)?.X.Scale ?? 0;
					const currentXOff = (props.Size as UDim2)?.X.Offset ?? 0;
					props.Size = new UDim2(currentX, currentXOff, 0, px);
				}
				continue;
			}
		}

		{
			const bgm = cls.match('^bg%-(.+)$');
			if (bgm) {
				const c3 = resolveColor(bgm[0] as string, cfg.colors);
				if (c3) {
					props.BackgroundColor3 = c3;
					props.BackgroundTransparency = 0;
				}
				continue;
			}
		}

		{
			const tm = cls.match('^text%-(.+)$');
			if (tm) {
				const colorKey = tm[0] as string;
				const c3 = resolveColor(colorKey, cfg.colors);
				if (c3) {
					props.TextColor3 = c3;
					continue;
				}
				const fontSize = cfg.fontSizes[colorKey];
				if (fontSize !== undefined) {
					props.TextSize = fontSize;
					continue;
				}
				if (colorKey === 'left') props.TextXAlignment = Enum.TextXAlignment.Left;
				else if (colorKey === 'center') props.TextXAlignment = Enum.TextXAlignment.Center;
				else if (colorKey === 'right') props.TextXAlignment = Enum.TextXAlignment.Right;
				continue;
			}
		}

		{
			const fm = cls.match('^font%-(.+)$');
			if (fm) {
				const fontKey = fm[0] as string;
				if (fontKey === 'bold') {
					props.Font = Enum.Font.GothamBold;
				} else if (fontKey === 'normal') {
					props.Font = Enum.Font.Gotham;
				} else {
					const font = cfg.fontFamilies[fontKey];
					if (font !== undefined) props.Font = font;
				}
				continue;
			}
		}
		if (cls === 'italic') {
			// No native italic; RichText could be used but is out of scope
			continue;
		}

		{
			const rm = cls.match('^rounded%-?(.*)$');
			if (rm) {
				const key = rm[0] as string;
				const radius = (key !== '' ? cfg.borderRadii[key] : undefined) ?? cfg.borderRadii.DEFAULT;
				if (radius !== undefined) {
					styleChildren.push({
						__className: 'UICorner',
						CornerRadius: new UDim(0, radius),
					});
				}
				continue;
			}
		}

		if (cls === 'border') {
			props.BorderSizePixel = 1;
			continue;
		}
		{
			const bm = cls.match('^border%-(.+)$');
			if (bm) {
				const borderVal = bm[0] as string;
				const bw = tonumber(borderVal);
				if (bw !== undefined) {
					props.BorderSizePixel = bw;
				} else {
					const c3 = resolveColor(borderVal, cfg.colors);
					if (c3) {
						props.BorderColor3 = c3;
						props.BorderSizePixel = 1;
					}
				}
				continue;
			}
		}

		{
			const om = cls.match('^opacity%-(%d+)$');
			if (om) {
				const val = tonumber(om[0] as string);
				if (val !== undefined) {
					props.BackgroundTransparency = 1 - val / 100;
				}
				continue;
			}
		}

		{
			const zm = cls.match('^z%-(%d+)$');
			if (zm) {
				const zi = tonumber(zm[0] as string);
				if (zi !== undefined && cfg.zIndex[zi] !== undefined) {
					props.ZIndex = cfg.zIndex[zi];
				}
				continue;
			}
		}

		if (cls === 'shadow' || cls === 'shadow-sm' || cls === 'shadow-md' || cls === 'shadow-lg') {
			props.BorderSizePixel = 1;
			props.BorderColor3 = new Color3(0, 0, 0);
			continue;
		}

		if (cls === 'overflow-hidden') {
			props.ClipsDescendants = true;
			continue;
		}
		if (cls === 'overflow-visible') {
			props.ClipsDescendants = false;
			continue;
		}

		if (cls === 'pointer-events-none') {
			props.Active = false;
			continue;
		}

		{
			// scale-50, scale-x-75, scale-y-90
			const sm = cls.match('^scale%-?(.-)%-(%d+)$');
			if (sm && sm[0] !== undefined && sm[1] !== undefined) {
				const val = tonumber(sm[1] as string);
				if (val !== undefined) {
					const result = resolveTransform(cls, val);
					if (result) {
						const sc = result.__styleChildren as Record<string, unknown>[] | undefined;
						if (sc) {
							for (const c of sc) styleChildren.push(c);
							(result as unknown as Record<string, unknown>).__styleChildren = undefined;
						}
						for (const [k, v] of pairs(result)) {
							const key = k as string;
							if (key !== '__styleChildren' && key !== '__className') {
								props[key] = v;
							}
						}
					}
					continue;
				}
			}

			// scale-[1.5]
			const saMatch = (cls as unknown as string).match('^scale%-(%[.+%])$');
			if (saMatch && saMatch[0] !== undefined) {
				let raw = saMatch[0] as string;
				raw = (raw as unknown as string).gsub('^%[', '')[0] as string;
				raw = (raw as unknown as string).gsub('%]$', '')[0] as string;
				const result = resolveScaleArbitrary(raw);
				if (result) {
					const sc = result.__styleChildren as Record<string, unknown>[] | undefined;
					if (sc) {
						for (const c of sc) styleChildren.push(c);
					}
				}
				continue;
			}

			// rotate-45, -rotate-12
			const rm = cls.match('^(-?)rotate%-(%d+)$');
			if (rm && rm[1] !== undefined && rm[2] !== undefined) {
				const sign = (rm[1] as string) === '-' ? -1 : 1;
				const deg = tonumber(rm[2] as string);
				if (deg !== undefined) {
					const result = resolveRotate(sign * deg);
					for (const [k, v] of pairs(result)) {
						props[k as string] = v;
					}
					continue;
				}
			}

			// rotate-[30deg]
			const raMatch = (cls as unknown as string).match('^(-?)rotate%-(%[.+%])$');
			if (raMatch && raMatch[1] !== undefined) {
				let raw = raMatch[1] as string;
				raw = (raw as unknown as string).gsub('^%[', '')[0] as string;
				raw = (raw as unknown as string).gsub('%]$', '')[0] as string;
				const result = resolveRotateArbitrary(raw);
				if (result) {
					for (const [k, v] of pairs(result)) {
						props[k as string] = v;
					}
				}
				continue;
			}

			// translate-x-4, -translate-x-4, translate-y-2, -translate-y-2
			const tm = cls.match('^(-?)translate%-([xy])%-(.+)$');
			if (tm && tm[1] !== undefined && tm[2] !== undefined && tm[3] !== undefined) {
				const sign = (tm[1] as string) === '-' ? -1 : 1;
				const axis = tm[2] as string;
				const val = tm[3] as string;
				const prefix = `${sign === -1 ? '-' : ''}translate-${axis}-`;
				const result = resolveTranslate(prefix, val, cfg.spacing);
				if (result) {
					// Merge position offset with existing position
					const existingPos = props.Position as UDim2;
					if (existingPos) {
						const newPos = result.Position as UDim2;
						const newX = newPos ? newPos.X : existingPos.X;
						const newY = newPos ? newPos.Y : existingPos.Y;
						const xScale = axis === 'x' ? newX.Scale : existingPos.X.Scale;
						const xOff = axis === 'x' ? newX.Offset * sign + existingPos.X.Offset : existingPos.X.Offset;
						const yScale = axis === 'y' ? newY.Scale : existingPos.Y.Scale;
						const yOff = axis === 'y' ? newY.Offset * sign + existingPos.Y.Offset : existingPos.Y.Offset;
						props.Position = new UDim2(xScale, xOff, yScale, yOff);
					} else {
						for (const [k, v] of pairs(result)) {
							props[k as string] = v;
						}
					}
					continue;
				}
			}

			// translate-x-[100px], translate-y-[100px]
			const taMatch = (cls as unknown as string).match('^translate%-([xy])%-(%[.+%])$');
			if (taMatch && taMatch[0] !== undefined && taMatch[1] !== undefined) {
				const axis = taMatch[0] as string;
				let raw = taMatch[1] as string;
				raw = (raw as unknown as string).gsub('^%[', '')[0] as string;
				raw = (raw as unknown as string).gsub('%]$', '')[0] as string;
				const result = resolveTranslateArbitrary(axis, raw);
				if (result) {
					const existingPos = props.Position as UDim2;
					const newPos = result.Position as UDim2;
					if (existingPos && newPos) {
						props.Position = new UDim2(
							axis === 'x' ? newPos.X.Scale : existingPos.X.Scale,
							axis === 'x' ? newPos.X.Offset : existingPos.X.Offset,
							axis === 'y' ? newPos.Y.Scale : existingPos.Y.Scale,
							axis === 'y' ? newPos.Y.Offset : existingPos.Y.Offset
						);
					} else {
						for (const [k, v] of pairs(result)) {
							props[k as string] = v;
						}
					}
					continue;
				}
			}

			// skew-x-12, skew-y-6
			const skm = cls.match('^skew%-([xy])%-(%d+)$');
			if (skm && skm[0] !== undefined && skm[1] !== undefined) {
				const val = tonumber(skm[1] as string);
				if (val !== undefined) {
					const result = resolveSkew(cls, val);
					for (const [k, v] of pairs(result)) {
						props[k as string] = v;
					}
					continue;
				}
			}
		}

		if (isAnimationClass(cls)) {
			const anim = resolveAnimation(cls);
			if (anim) {
				props.__animationName = anim.name;
				props.__animationDuration = anim.duration;
				props.__animationIterationCount = anim.iterationCount;
				props.__animationTimingFunction = anim.timingFunction;
				props.__animationDelay = anim.delay;
			} else {
				// animate-none
				props.__animationName = 'none';
			}
		}
	}

	if (gradientBuilder.active) {
		const gradientChild = buildGradient(gradientBuilder);
		if (gradientChild) {
			styleChildren.push(gradientChild);
		}
	}

	if (hoverProps) {
		props.__hoverProps = hoverProps;
		if (hoverStyleChildren && hoverStyleChildren.size() > 0) {
			props.__hoverStyleChildren = hoverStyleChildren;
		}
	}

	if (styleChildren.size() > 0) {
		(props as unknown as Record<string, unknown>).__className = className;
		props.__styleChildren = styleChildren;
	}

	return props;
}

// resolveClassName — public API (uses global config)

/**
 * Resolves a space-separated Tailwind class-name string to a table of
 * Roblox GUI style properties.
 *
 * ```ts
 * const styleProps = resolveClassName("flex p-4 bg-blue-500 rounded");
 * // => { UIFlexItem: {...}, BackgroundColor3: Color3(...), __styleChildren: [...] }
 * ```
 *
 * @param className - A space-separated Tailwind class name string.
 * @returns A table of resolved Roblox style properties, including virtual
 *          `__styleChildren` for UIPadding and UICorner elements.
 */
export function resolveClassName(className: string): Record<string, unknown> {
	const { getStyleConfig } = (require as unknown as (path: string) => unknown)('./config') as {
		getStyleConfig: () => ResolvedStyleConfig;
	};
	return resolveClassNameWithConfig(className, getStyleConfig());
}
