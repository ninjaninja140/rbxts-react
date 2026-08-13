/**
 * `memo` — lets you skip re-rendering a component when its props are unchanged.
 *
 * ```ts
 * const Memoized = React.memo(MyComponent, (prev, next) => prev.id === next.id);
 * ```
 *
 * @module ReactMemo
 * @packageDocumentation
 */

import { __DEV__ } from '@nrbx/react-globals';
import { console, getComponentName, isValidElementType, ReactSymbols } from '@nrbx/react-shared';
import inspect from './inspect';

const REACT_MEMO_TYPE = ReactSymbols.REACT_MEMO_TYPE;
const REACT_ELEMENT_TYPE = ReactSymbols.REACT_ELEMENT_TYPE;

/** Luau has no `Array.isArray`; a table whose first key is numeric (or absent) is an array. */
function isArray(value: unknown): boolean {
	if (typeOf(value) !== 'table') {
		return false;
	}
	const [firstKey] = next(value as object);
	return firstKey === undefined || type(firstKey) === 'number';
}

/**
 * A memoized component wrapper.
 */
export interface MemoComponent<Props> {
	$$typeof: number;
	type: unknown;
	compare: ((oldProps: Props, newProps: Props) => boolean) | undefined;
}

/**
 * Memoizes a component, skipping re-renders when props compare equal.
 *
 * @param type_ - The component to memoize.
 * @param compare - Optional custom equality function. Defaults to shallow
 * equality.
 */
function memo<Props>(type_: unknown, compare?: (oldProps: Props, newProps: Props) => boolean): MemoComponent<Props> {
	if (__DEV__) {
		if (!isValidElementType(type_)) {
			let info = '';
			if (type_ === undefined || (typeOf(type_) === 'table' && next(type_ as object)[0] === undefined)) {
				info +=
					' You likely forgot to export your component from the file ' +
					"it's defined in, or you might have mixed up default and named imports.";
			}

			let typeString: string;
			if (type_ === undefined) {
				typeString = 'nil';
			} else if (typeOf(type_) === 'table' && isArray(type_)) {
				typeString = 'array';
			} else if (
				typeOf(type_) === 'table' &&
				(type_ as Record<string, defined>).$$typeof === REACT_ELEMENT_TYPE
			) {
				typeString = string.format('<%s />', getComponentName((type_ as { type: unknown }).type) ?? 'UNKNOWN');
				info = ' Did you accidentally export a JSX literal or Element instead of a component?';
			} else {
				typeString = typeOf(type_);
				if (type_ !== undefined) {
					info = `\n${inspect(type_)}`;
				}
			}

			console.error('memo: The first argument must be a component. Instead received: `%s`.%s', typeString, info);
		}
	}

	const elementType: MemoComponent<Props> = {
		$$typeof: REACT_MEMO_TYPE,
		type: type_,
		compare: compare !== undefined ? compare : undefined,
	};

	if (__DEV__) {
		let name: string | undefined;
		setmetatable(elementType, {
			__index: (self_: object, key: string) => {
				if (key === 'displayName') {
					return name;
				}
				return rawget(self_, key);
			},
			__newindex: (self_: object, key: string, value: defined) => {
				if (key === 'displayName') {
					name = value as string;
					if (typeOf(type_) === 'table' && (type_ as Record<string, defined>).displayName === undefined) {
						(type_ as Record<string, defined>).displayName = name;
					}
				} else {
					rawset(self_, key, value);
				}
			},
		} as LuaMetatable<MemoComponent<Props>>);
	}

	return elementType;
}

export default { memo };
