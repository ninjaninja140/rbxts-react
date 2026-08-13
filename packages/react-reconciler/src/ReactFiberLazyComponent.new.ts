/**
 * Resolves `defaultProps` on lazy component types.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactFiberLazyComponent.new.lua`.
 *
 * @module ReactFiberLazyComponent
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

type Object_ = Record<string, defined | undefined>;

/**
 * Resolves a component's `defaultProps` against `baseProps`, filling in any
 * prop keys that are not already present.
 *
 * @param Component - The component type, which may define `defaultProps`.
 * @param baseProps - The props to resolve against.
 * @returns The resolved props object.
 * @internal
 */
function resolveDefaultProps(Component: defined, baseProps: Object_): Object_ {
	const component = Component as Object_;
	if (typeOf(Component) === 'table' && component.defaultProps) {
		// Resolve default props. Taken from ReactElement.
		const props = { ...baseProps };
		const defaultProps = component.defaultProps as Object_;
		for (const [propName] of pairs(defaultProps)) {
			if (props[propName] === undefined) {
				props[propName] = defaultProps[propName];
			}
		}
		return props;
	}
	return baseProps;
}

export { resolveDefaultProps };
