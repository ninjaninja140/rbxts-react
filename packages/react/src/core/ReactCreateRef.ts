/**
 * Ref objects — boxed mutable values that hold a reference to an instance.
 *
 * In this runtime refs are implemented in terms of bindings: a ref is just a
 * binding with a `current` field that maps to the binding's value.
 *
 * @module ReactCreateRef
 * @packageDocumentation
 */

import type { RefObject } from '@nrbx/react-shared';
import { __DEV__ } from '@nrbx/react-globals';
import BindingInternalApi from './ReactBinding';

/**
 * Creates a ref object.
 *
 * ```ts
 * const ref = React.createRef<Frame>();
 * print(ref.current); // nil until a host instance is attached
 * ```
 */
function createRef<T = unknown>(): RefObject<T> {
	const [binding] = BindingInternalApi.create<T | undefined>(undefined);

	const ref: Record<string, defined> = {};

	// Since refs are used as bindings they can be assigned to fields of other
	// instances; we track the creation site in DEV to improve error messages.
	if (__DEV__) {
		(binding as unknown as { _source: string })._source = debug.traceback('Ref created at:', 1);
	}

	// A ref is redirected to its backing binding via a metatable.
	setmetatable(ref, {
		__index: (_self: Record<string, defined>, key: string) => {
			if (key === 'current') {
				return BindingInternalApi.getValue(binding) as defined;
			}
			return (binding as unknown as Record<string, defined>)[key];
		},
		__newindex: (_self: Record<string, defined>, key: string, value: defined) => {
			if (key === 'current') {
				// Unlike Roact, assigning `ref.current` is allowed in React.
				BindingInternalApi.update(binding, value as T);
			}
			(binding as unknown as Record<string, defined>)[key] = value;
		},
		__tostring: () => {
			return string.format('Ref(%s)', tostring(BindingInternalApi.getValue(binding)));
		},
	} as unknown as LuaMetatable<Record<string, defined>>);

	return ref as unknown as RefObject<T>;
}

export default { createRef };
