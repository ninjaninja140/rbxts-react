/**
 * `forwardRef` — lets a component expose a host instance to its parent via a
 * ref.
 *
 * ```ts
 * const FancyButton = React.forwardRef<TextButton, { text: string }>(
 *     (props, ref) => <textbutton ref={ref} Text={props.text} />,
 * );
 * ```
 *
 * @module ReactForwardRef
 * @packageDocumentation
 */

import { __DEV__ } from '@nrbx/react-globals';
import { console, ReactSymbols } from '@nrbx/react-shared';

const REACT_FORWARD_REF_TYPE = ReactSymbols.REACT_FORWARD_REF_TYPE;
const REACT_MEMO_TYPE = ReactSymbols.REACT_MEMO_TYPE;

/**
 * A component that forwards its ref to a child component.
 */
export interface ForwardRefComponent<Props, Instance> {
	$$typeof: number;
	render: (props: Props, ref: Instance) => unknown;
}

/**
 * Creates a `forwardRef` component.
 *
 * @param render - A function taking `props` and `ref` and returning a child.
 */
function forwardRef<Props, Instance>(
	render: (props: Props, ref: Instance) => unknown
): ForwardRefComponent<Props, Instance> {
	if (__DEV__) {
		if (typeOf(render) === 'table' && (render as unknown as Record<string, defined>).$$typeof === REACT_MEMO_TYPE) {
			console.error(
				'forwardRef requires a render function but received a `memo` component. ' +
					'Instead of forwardRef(memo(...)), use memo(forwardRef(...)).'
			);
		} else if (typeOf(render) !== 'function') {
			console.error('forwardRef requires a render function but was given %s.', typeOf(render));
		} else {
			const [argumentCount] = debug.info(render as Callback, 'a');
			if (argumentCount !== 0 && argumentCount !== 2) {
				console.error(
					'forwardRef render functions accept exactly two parameters: props and ref. %s',
					argumentCount === 1
						? 'Did you forget to use the ref parameter?'
						: 'Any additional parameter will be undefined.'
				);
			}
		}
	}

	const elementType: ForwardRefComponent<Props, Instance> = {
		$$typeof: REACT_FORWARD_REF_TYPE,
		render,
	};

	if (__DEV__) {
		// Luau functions cannot carry fields, so we approximate
		// `Object.defineProperty(elementType, "displayName", ...)` with a
		// metatable that traps reads/writes to `displayName`.
		let ownName: string | undefined;
		setmetatable(elementType, {
			__index: (self_: object, key: string) => {
				if (key === 'displayName') {
					return ownName;
				}
				return rawget(self_, key);
			},
			__newindex: (self_: object, key: string, value: defined) => {
				if (key === 'displayName') {
					ownName = value as string;
				} else {
					rawset(self_, key, value);
				}
			},
		} as LuaMetatable<ForwardRefComponent<Props, Instance>>);
	}

	return elementType;
}

export default { forwardRef };
