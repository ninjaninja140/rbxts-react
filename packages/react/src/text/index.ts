/**
 * Text-as-Children system for `@nrbx/react`.
 *
 * When `string` or `number` values appear as JSX children, the runtime
 * automatically wraps them in transparent `TextLabel` elements.
 *
 * ```tsx
 * <frame>
 *   {"Hello, world!"}
 *   {42}
 * </frame>
 * ```
 *
 * @module text
 * @packageDocumentation
 */

export type { TextChildOptions, TextChildConfig, TextChildOverrides } from './types';
export { configureTextChildren, getTextOptions, getTextConfig } from './config';
export { isTextCapableParent, createTextElement } from './create-element';
