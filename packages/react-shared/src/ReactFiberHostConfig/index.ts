/**
 * Renderer-agnostic host config singletons.
 *
 * The Roblox renderer (and test renderers) import the "WithNo*" variants for
 * features they do not implement, and provide real implementations for the
 * rest.
 *
 * @module ReactFiberHostConfig
 * @internal
 * @packageDocumentation
 */

import * as WithNoHydration from './WithNoHydration';
import * as WithNoPersistence from './WithNoPersistence';
import * as WithNoTestSelectors from './WithNoTestSelectors';

// Types that are common across ReactFiberHostConfig files, moved here to avoid
// circular dependencies.
type Object = { [key: string]: defined };
export type OpaqueIDType = string | Object;

export { WithNoHydration, WithNoPersistence, WithNoTestSelectors };
export default { WithNoHydration, WithNoPersistence, WithNoTestSelectors };
