/**
 * Mapping table: HTML element names → Roblox class names.
 *
 * Each entry maps a lower-case HTML tag to the Roblox `ClassName`
 * that should be created when the tag is used in JSX.
 *
 * @module html-elements/map
 * @packageDocumentation
 */

export type HTMLElementMap = Record<string, string>;

/**
 * The default HTML → Roblox element mapping.
 *
 * | HTML Tag      | Roblox Class         |
 * | :------------ | :------------------- |
 * | `div`         | `Frame`              |
 * | `span`        | `TextLabel`          |
 * | `p`           | `TextLabel`          |
 * | `h1` – `h6`   | `TextLabel`          |
 * | `a`           | `TextButton`         |
 * | `button`      | `TextButton`         |
 * | `img`         | `ImageLabel`         |
 * | `input`       | `TextBox`            |
 * | `textarea`    | `TextBox`            |
 * | `ul` / `ol`   | `ScrollingFrame`     |
 * | `li`          | `TextLabel`          |
 * | `code`        | `TextLabel`          |
 * | `pre`         | `TextLabel`          |
 * | `strong` / `b`| `TextLabel`          |
 * | `em` / `i`    | `TextLabel`          |
 * | `header`      | `Frame`              |
 * | `footer`      | `Frame`              |
 * | `main`        | `Frame`              |
 * | `nav`         | `Frame`              |
 * | `section`     | `Frame`              |
 * | `article`     | `Frame`              |
 * | `aside`       | `Frame`              |
 * | `form`        | `Frame`              |
 * | `table`       | `Frame`              |
 * | `label`       | `TextLabel`          |
 */
export const DEFAULT_HTML_ELEMENT_MAP: HTMLElementMap = {
	div: 'Frame',
	span: 'TextLabel',
	p: 'TextLabel',
	h1: 'TextLabel',
	h2: 'TextLabel',
	h3: 'TextLabel',
	h4: 'TextLabel',
	h5: 'TextLabel',
	h6: 'TextLabel',
	a: 'TextButton',
	button: 'TextButton',
	img: 'ImageLabel',
	input: 'TextBox',
	textarea: 'TextBox',
	ul: 'ScrollingFrame',
	ol: 'ScrollingFrame',
	li: 'TextLabel',
	code: 'TextLabel',
	pre: 'TextLabel',
	strong: 'TextLabel',
	b: 'TextLabel',
	em: 'TextLabel',
	i: 'TextLabel',
	header: 'Frame',
	footer: 'Frame',
	main: 'Frame',
	nav: 'Frame',
	section: 'Frame',
	article: 'Frame',
	aside: 'Frame',
	form: 'Frame',
	table: 'Frame',
	label: 'TextLabel',
};
