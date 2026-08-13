/**
 * Named-color and hex-string resolution for builder shorthand methods.
 *
 * Lets you write `builder.setBackground("white")` instead of building a
 * `Color3` by hand. Accepts:
 *
 * - CSS color names (`"white"`, `"black"`, `"red"`, `"dodgerblue"`, ...)
 * - Hex strings (`"#fff"`, `"#ff0000"`, `"ff0000"`)
 * - `rgb(...)` / `rgba(...)` strings
 *
 * @module colors
 * @packageDocumentation
 */

// Named color table

/** A subset of CSS color names mapped to their 0-255 RGB components. */
const NAMED_COLORS: Readonly<Record<string, readonly [number, number, number]>> = {
	aliceblue: [240, 248, 255],
	antiquewhite: [250, 235, 215],
	aqua: [0, 255, 255],
	aquamarine: [127, 255, 212],
	azure: [240, 255, 255],
	beige: [245, 245, 220],
	bisque: [255, 228, 196],
	black: [0, 0, 0],
	blanchedalmond: [255, 235, 205],
	blue: [0, 0, 255],
	blueviolet: [138, 43, 226],
	brown: [165, 42, 42],
	burlywood: [222, 184, 135],
	cadetblue: [95, 158, 160],
	chartreuse: [127, 255, 0],
	chocolate: [210, 105, 30],
	coral: [255, 127, 80],
	cornflowerblue: [100, 149, 237],
	cornsilk: [255, 248, 220],
	crimson: [220, 20, 60],
	cyan: [0, 255, 255],
	darkblue: [0, 0, 139],
	darkcyan: [0, 139, 139],
	darkgoldenrod: [184, 134, 11],
	darkgray: [169, 169, 169],
	darkgreen: [0, 100, 0],
	darkgrey: [169, 169, 169],
	darkkhaki: [189, 183, 107],
	darkmagenta: [139, 0, 139],
	darkolivegreen: [85, 107, 47],
	darkorange: [255, 140, 0],
	darkorchid: [153, 50, 204],
	darkred: [139, 0, 0],
	darksalmon: [233, 150, 122],
	darkseagreen: [143, 188, 143],
	darkslateblue: [72, 61, 139],
	darkslategray: [47, 79, 79],
	darkslategrey: [47, 79, 79],
	darkturquoise: [0, 206, 209],
	darkviolet: [148, 0, 211],
	deeppink: [255, 20, 147],
	deepskyblue: [0, 191, 255],
	dimgray: [105, 105, 105],
	dimgrey: [105, 105, 105],
	dodgerblue: [30, 144, 255],
	firebrick: [178, 34, 34],
	floralwhite: [255, 250, 240],
	forestgreen: [34, 139, 34],
	fuchsia: [255, 0, 255],
	gainsboro: [220, 220, 220],
	ghostwhite: [248, 248, 255],
	gold: [255, 215, 0],
	goldenrod: [218, 165, 32],
	gray: [128, 128, 128],
	green: [0, 128, 0],
	greenyellow: [173, 255, 47],
	grey: [128, 128, 128],
	honeydew: [240, 255, 240],
	hotpink: [255, 105, 180],
	indianred: [205, 92, 92],
	indigo: [75, 0, 130],
	ivory: [255, 255, 240],
	khaki: [240, 230, 140],
	lavender: [230, 230, 250],
	lavenderblush: [255, 240, 245],
	lawngreen: [124, 252, 0],
	lemonchiffon: [255, 250, 205],
	lightblue: [173, 216, 230],
	lightcoral: [240, 128, 128],
	lightcyan: [224, 255, 255],
	lightgoldenrodyellow: [250, 250, 210],
	lightgray: [211, 211, 211],
	lightgreen: [144, 238, 144],
	lightgrey: [211, 211, 211],
	lightpink: [255, 182, 193],
	lightsalmon: [255, 160, 122],
	lightseagreen: [32, 178, 170],
	lightskyblue: [135, 206, 250],
	lightslategray: [119, 136, 153],
	lightslategrey: [119, 136, 153],
	lightsteelblue: [176, 196, 222],
	lightyellow: [255, 255, 224],
	lime: [0, 255, 0],
	limegreen: [50, 205, 50],
	linen: [250, 240, 230],
	magenta: [255, 0, 255],
	maroon: [128, 0, 0],
	mediumaquamarine: [102, 205, 170],
	mediumblue: [0, 0, 205],
	mediumorchid: [186, 85, 211],
	mediumpurple: [147, 112, 219],
	mediumseagreen: [60, 179, 113],
	mediumslateblue: [123, 104, 238],
	mediumspringgreen: [0, 250, 154],
	mediumturquoise: [72, 209, 204],
	mediumvioletred: [199, 21, 133],
	midnightblue: [25, 25, 112],
	mintcream: [245, 255, 250],
	mistyrose: [255, 228, 225],
	moccasin: [255, 228, 181],
	navajowhite: [255, 222, 173],
	navy: [0, 0, 128],
	oldlace: [253, 245, 230],
	olive: [128, 128, 0],
	olivedrab: [107, 142, 35],
	orange: [255, 165, 0],
	orangered: [255, 69, 0],
	orchid: [218, 112, 214],
	palegoldenrod: [238, 232, 170],
	palegreen: [152, 251, 152],
	paleturquoise: [175, 238, 238],
	palevioletred: [219, 112, 147],
	papayawhip: [255, 239, 213],
	peachpuff: [255, 218, 185],
	peru: [205, 133, 63],
	pink: [255, 192, 203],
	plum: [221, 160, 221],
	powderblue: [176, 224, 230],
	purple: [128, 0, 128],
	rebeccapurple: [102, 51, 153],
	red: [255, 0, 0],
	rosybrown: [188, 143, 143],
	royalblue: [65, 105, 225],
	saddlebrown: [139, 69, 19],
	salmon: [250, 128, 114],
	sandybrown: [244, 164, 96],
	seagreen: [46, 139, 87],
	seashell: [255, 245, 238],
	sienna: [160, 82, 45],
	silver: [192, 192, 192],
	skyblue: [135, 206, 235],
	slateblue: [106, 90, 205],
	slategray: [112, 128, 144],
	slategrey: [112, 128, 144],
	snow: [255, 250, 250],
	springgreen: [0, 255, 127],
	steelblue: [70, 130, 180],
	tan: [210, 180, 140],
	teal: [0, 128, 128],
	thistle: [216, 191, 216],
	tomato: [255, 99, 71],
	turquoise: [64, 224, 208],
	violet: [238, 130, 238],
	wheat: [245, 222, 179],
	white: [255, 255, 255],
	whitesmoke: [245, 245, 245],
	yellow: [255, 255, 0],
	yellowgreen: [154, 205, 50],
};

// Parsing helpers

/**
 * Parses a hex string (`"#fff"`, `"#ff0000"`, `"ff0000"`) into RGB
 * components. Returns `undefined` when the string is not valid hex.
 */
function parseHex(input: string): [number, number, number] | undefined {
	let hex = input;
	if (hex.sub(1, 1) === '#') {
		hex = hex.sub(2);
	}

	if (hex.size() === 3) {
		const r = tonumber(hex.sub(1, 1) + hex.sub(1, 1), 16);
		const g = tonumber(hex.sub(2, 2) + hex.sub(2, 2), 16);
		const b = tonumber(hex.sub(3, 3) + hex.sub(3, 3), 16);
		if (r === undefined || g === undefined || b === undefined) return undefined;
		return [r, g, b];
	}

	if (hex.size() === 6) {
		const r = tonumber(hex.sub(1, 2), 16);
		const g = tonumber(hex.sub(3, 4), 16);
		const b = tonumber(hex.sub(5, 6), 16);
		if (r === undefined || g === undefined || b === undefined) return undefined;
		return [r, g, b];
	}

	return undefined;
}

/**
 * Parses `rgb(r, g, b)` / `rgba(r, g, b, a)` strings into RGB components.
 * The alpha channel is ignored (Roblox `Color3` has no alpha). Returns
 * `undefined` when the string does not match.
 */
function parseRgb(input: string): [number, number, number] | undefined {
	const match = input.match('^rgba?%(%s*(%d+)%s*,%s*(%d+)%s*,%s*(%d+)');
	if (match.size() < 1) return undefined;

	const r = tonumber(match[0]);
	const g = tonumber(match[1]);
	const b = tonumber(match[2]);
	if (r === undefined || g === undefined || b === undefined) return undefined;

	return [math.clamp(r, 0, 255), math.clamp(g, 0, 255), math.clamp(b, 0, 255)];
}

// Public API

/**
 * Resolves a color description to a `Color3`.
 *
 * Accepts a CSS color name, a hex string, or an `rgb()`/`rgba()` string.
 * Throws on unrecognized input so typos fail loudly at build time of the
 * component tree rather than silently rendering the wrong color.
 *
 * @param input - A named color, hex string, or `rgb()`/`rgba()` string.
 * @returns The resolved `Color3`.
 * @throws If the input cannot be parsed as a color.
 */
export function resolveColor(input: string): Color3 {
	const lower = input.lower();

	const named = NAMED_COLORS[lower];
	if (named !== undefined) {
		return Color3.fromRGB(named[0], named[1], named[2]);
	}

	const hex = parseHex(lower);
	if (hex !== undefined) {
		return Color3.fromRGB(hex[0], hex[1], hex[2]);
	}

	const rgb = parseRgb(lower);
	if (rgb !== undefined) {
		return Color3.fromRGB(rgb[0], rgb[1], rgb[2]);
	}

	throw `Unknown color: "${input}"`;
}

/**
 * Normalizes a `Color3 | string` into a `Color3`.
 *
 * `Color3` values pass through untouched; strings are resolved through
 * `resolveColor()`. This is the single entry point used by the shorthand
 * color setters (`setBackground`, `setTextColor`, ...).
 *
 * @param value - A `Color3` or a color description string.
 * @returns The resolved `Color3`.
 */
export function resolveColorValue(value: Color3 | string): Color3 {
	if (typeIs(value, 'string')) {
		return resolveColor(value);
	}
	return value;
}
