/**
 * HTML element alias system for `@nrbx/react`.
 *
 * Allows using familiar HTML tag names (`div`, `span`, `h1`, `button`,
 * etc.) in JSX. Each HTML tag maps to a semantically equivalent Roblox
 * `ClassName`, with sensible default styles for headings and text content.
 *
 * ## Quick Start
 *
 * ```tsx
 * import React from "@nrbx/react";
 *
 * const App = () => (
 *   <div className="flex flex-col p-4">
 *     <h1>Hello World</h1>
 *     <p>This is a paragraph of text.</p>
 *     <button className="bg-blue-500 rounded p-2">
 *       <span>Click me</span>
 *     </button>
 *   </div>
 * );
 * ```
 *
 * ## Supported Elements
 *
 * | HTML Tag        | Roblox Equivalent |
 * | :-------------- | :---------------- |
 * | `div`           | `Frame`           |
 * | `span`          | `TextLabel`       |
 * | `p`             | `TextLabel`       |
 * | `h1` – `h6`     | `TextLabel`       |
 * | `a`             | `TextButton`      |
 * | `button`        | `TextButton`      |
 * | `img`           | `ImageLabel`      |
 * | `input`         | `TextBox`         |
 * | `textarea`      | `TextBox`         |
 * | `ul`, `ol`      | `ScrollingFrame`  |
 * | `li`            | `TextLabel`       |
 * | `code`          | `TextLabel`       |
 * | `pre`           | `TextLabel`       |
 * | `strong`, `b`   | `TextLabel`       |
 * | `em`, `i`       | `TextLabel`       |
 *
 * @module html-elements
 * @packageDocumentation
 */

export type { HeadingConfig, HeadingOverrides, SpecialElementConfig } from './types';
export type { HTMLElementMap } from './map';
export { DEFAULT_HTML_ELEMENT_MAP } from './map';
export {
	configureHeadings,
	getHeadingConfig,
	getSpecialElementConfig,
	setSpecialElementConfig,
	DEFAULT_HEADINGS,
	DEFAULT_SPECIAL_ELEMENTS,
} from './config';
export {
	mapHTMLToRoblox,
	isHTMLElement,
	setHTMLElementMap,
	resolveHTMLElementDefaults,
} from './resolve';
