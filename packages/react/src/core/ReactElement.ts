/**
 * React element factory.
 *
 * This is the low-level implementation behind `React.createElement`,
 * `React.cloneElement`, and `React.isValidElement`. It builds the plain-table
 * "element" shape that the reconciler understands:
 *
 * ```text
 * { type, key, ref, props, _owner, "$$typeof" }
 * ```
 *
 * Elements are deliberately not class instances. React recognises them by the
 * numeric `$$typeof` tag instead of an `instanceof` check, because host
 * elements, fragments, providers, and function components all share the same
 * shape.
 *
 * @module ReactElement
 * @internal
 * @packageDocumentation
 */

import { __DEV__ } from '@nrbx/react-globals';
import { ReactSymbols, ReactSharedInternals, console, freeze, getComponentName } from '@nrbx/react-shared';

const { REACT_ELEMENT_TYPE } = ReactSymbols;
const ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;

/** The low-level element shape produced by this module. */
type ReactElementInternal = {
	type: unknown;
	key: unknown;
	ref: unknown;
	props: Record<string, unknown>;
	_owner: unknown;
	_self?: unknown;
	_source?: unknown;
	_store?: Record<string, unknown>;
	$$typeof: number;
};

/** Sentinel used to detect reads of `props.key`/`props.ref` in DEV. */
const reactWarning = { isReactWarning: true };

let specialPropKeyWarningShown = false;
let specialPropRefWarningShown = false;

/**
 * A `ref` counts as present when it is non-nil. In DEV we also ignore the
 * warning sentinel that `defineRefPropWarningGetter` hands back for reads of
 * `props.ref`.
 *
 * @internal
 */
function hasValidRef(config: Record<string, unknown>): boolean {
	if (__DEV__) {
		const ref = config.ref;
		if (ref !== undefined && type(ref) === 'table') {
			if ((ref as Record<string, unknown>).isReactWarning) {
				return false;
			}
		}
	}

	return config.ref !== undefined;
}

/**
 * A `key` counts as present when it is non-nil. In DEV we also ignore the
 * warning sentinel that `defineKeyPropWarningGetter` hands back.
 *
 * @internal
 */
function hasValidKey(config: Record<string, unknown>): boolean {
	if (__DEV__) {
		const key = config.key;
		if (key !== undefined && type(key) === 'table') {
			if ((key as Record<string, unknown>).isReactWarning) {
				return false;
			}
		}
	}

	return config.key !== undefined;
}

/**
 * Installs an `__index` metatable on `props` so that reading the removed
 * `key` field warns instead of silently returning nil. DEV only.
 *
 * @internal
 */
function defineKeyPropWarningGetter(props: Record<string, unknown>, displayName: string): void {
	const warnAboutAccessingKey = () => {
		if (!specialPropKeyWarningShown) {
			specialPropKeyWarningShown = true;
			console.error(
				'%s: `key` is not a prop. Trying to access it will result ' +
					'in `nil` being returned. If you need to access the same ' +
					'value within the child component, you should pass it as a different ' +
					'prop. (https://reactjs.org/link/special-props)',
				displayName
			);
		}
	};

	props.key = undefined;
	setmetatable(props, {
		__index: (_target, key) => {
			if (key === 'key') {
				warnAboutAccessingKey();
				return reactWarning;
			}
			return undefined;
		},
	});
}

/**
 * Installs an `__index` metatable on `props` so that reading the removed
 * `ref` field warns instead of silently returning nil. DEV only.
 *
 * @internal
 */
function defineRefPropWarningGetter(props: Record<string, unknown>, displayName: string): void {
	const warnAboutAccessingRef = () => {
		if (!specialPropRefWarningShown) {
			specialPropRefWarningShown = true;
			console.error(
				'%s: `ref` is not a prop. Trying to access it will result ' +
					'in `nil` being returned. If you need to access the same ' +
					'value within the child component, you should pass it as a different ' +
					'prop. (https://reactjs.org/link/special-props)',
				displayName
			);
		}
	};

	props.ref = undefined;
	setmetatable(props, {
		__index: (_target, key) => {
			if (key === 'ref') {
				warnAboutAccessingRef();
				return reactWarning;
			}
			return undefined;
		},
	});
}

/**
 * String refs were never supported on Roblox, so any string ref is a hard
 * error rather than a warning. DEV only.
 *
 * @internal
 */
function warnIfStringRefCannotBeAutoConverted(config: Record<string, unknown>): void {
	const currentOwner = ReactCurrentOwner.current as unknown;
	if (type(config.ref) === 'string' && currentOwner) {
		const componentName = getComponentName((currentOwner as Record<string, unknown>).type) ?? 'Unknown';
		error(
			string.format(
				'Component "%s" contains the string ref "%s". ' +
					'Support for string refs has been removed. ' +
					'We recommend using useRef() or createRef() instead. ' +
					'Learn more about using refs safely here: ' +
					'https://reactjs.org/link/strict-mode-string-ref',
				componentName,
				config.ref as string
			)
		);
	}
}

/**
 * Allocates the element table.
 *
 * @internal
 */
function ReactElement(
	type_: unknown,
	key: unknown,
	ref: unknown,
	self_: unknown,
	source: unknown,
	owner: unknown,
	props: Record<string, unknown>
): ReactElementInternal {
	const element: ReactElementInternal = {
		type: type_,
		key,
		ref,
		props,
		_owner: owner,
		$$typeof: REACT_ELEMENT_TYPE,
	};

	if (__DEV__) {
		// `_store` is a plain table so the reconciler can mark an element as
		// validated (see warnForMissingKey in the child fiber module).
		element._store = { validated: false };
		// `_self` and `_source` are DEV-only provenance fields. They are
		// stored directly; nothing iterates the element table itself.
		element._self = self_;
		element._source = source;
	}

	return element;
}

/** JSX automatic runtime is not used on Roblox; roblox-ts emits `createElement`. */
export function jsx(): never {
	error('JSX is currently unsupported');
}

/** JSX development runtime is not used on Roblox. */
export function jsxDEV(): never {
	error('JSX is currently unsupported');
}

/**
 * Creates a new React element for the given type.
 *
 * @param type_ - The element type: a host tag string, function/class
 * component, context, fragment, etc.
 * @param config - The props object (optional).
 * @param children - Zero or more child values, flattened onto `props.children`.
 * @internal
 */
export function createElement(type_: unknown, config: unknown, ...children: Array<unknown>): ReactElementInternal {
	const props: Record<string, unknown> =
		type(config) === 'table' ? table.clone(config as Record<string, unknown>) : {};

	let key: unknown;
	let ref: unknown;
	let self_: unknown;
	let source: unknown;

	if (config !== undefined) {
		const configRecord = config as Record<string, unknown>;

		if (hasValidRef(configRecord)) {
			ref = configRecord.ref;

			if (__DEV__) {
				warnIfStringRefCannotBeAutoConverted(configRecord);
			}
		}

		if (hasValidKey(configRecord)) {
			const configKey = configRecord.key;
			key = type(configKey) === 'number' ? configKey : tostring(configKey);
		}

		source = configRecord.__source;

		// Reserved props never reach the component. Unrolled for the hot path.
		if (props.key !== undefined) props.key = undefined;
		if (props.ref !== undefined) props.ref = undefined;
		if (props.__self !== undefined) props.__self = undefined;
		if (props.__source !== undefined) props.__source = undefined;
	}

	// Children can be passed as more than one argument; they are transferred
	// onto the newly allocated props object.
	const childrenLength = children.size();
	if (childrenLength === 1) {
		props.children = children[0];
	} else if (childrenLength > 1) {
		if (__DEV__) {
			freeze(children);
		}
		props.children = children;
	}

	// Resolve default props.
	if (type(type_) === 'table' && (type_ as Record<string, unknown>).defaultProps) {
		const defaultProps = (type_ as Record<string, unknown>).defaultProps as Record<string, unknown>;
		for (const [propName, propValue] of pairs(defaultProps)) {
			if (props[propName] === undefined) {
				props[propName] = propValue;
			}
		}
	}

	if (__DEV__) {
		if (key !== undefined || ref !== undefined) {
			const displayName = getComponentName(type_) ?? 'Unknown';

			if (key !== undefined) {
				defineKeyPropWarningGetter(props, displayName);
			}

			if (ref !== undefined) {
				defineRefPropWarningGetter(props, displayName);
			}
		}

		// roblox-ts has no JSX transform that annotates `__source`, so derive
		// it from the call site for better error messages.
		if (source === undefined) {
			const [fileName] = debug.info(3, 's');
			const [lineNumber] = debug.info(3, 'l');
			source = { fileName, lineNumber };
		}
	}

	return ReactElement(type_, key, ref, self_, source, ReactCurrentOwner.current, props);
}

/**
 * Clones an element with a new key, keeping every other field identical.
 *
 * @internal
 */
export function cloneAndReplaceKey(oldElement: ReactElementInternal, newKey: unknown): ReactElementInternal {
	return ReactElement(
		oldElement.type,
		newKey,
		oldElement.ref,
		oldElement._self,
		oldElement._source,
		oldElement._owner,
		oldElement.props
	);
}

/**
 * Clones and returns a new element using `element` as the starting point. The
 * resulting element has the original props with `config` merged over them,
 * and `children` replace the existing children.
 *
 * @param element - The element to clone.
 * @param config - Props to merge in (optional).
 * @param children - Replacement children (optional).
 * @internal
 */
export function cloneElement(
	element: ReactElementInternal,
	config: unknown,
	...children: Array<unknown>
): ReactElementInternal {
	if (element === undefined) {
		error(`React.cloneElement(...): The argument must be a React element, but you passed ${tostring(element)}`);
	}

	// Original props are copied.
	const elementProps = element.props;
	const props: Record<string, unknown> = elementProps !== undefined ? table.clone(elementProps) : {};

	// Reserved names are extracted.
	let key = element.key;
	let ref = element.ref;
	const source = element._source;
	let owner = element._owner;

	if (config !== undefined) {
		const configRecord = config as Record<string, unknown>;
		const configRef = configRecord.ref;

		if (configRef !== undefined) {
			// Silently steal the ref from the parent.
			ref = configRef;
			owner = ReactCurrentOwner.current;
		} else {
			hasValidRef(configRecord);
		}

		const configKey = configRecord.key;
		if (configKey !== undefined) {
			key = configKey;
		} else {
			hasValidKey(configRecord);
		}
	}

	// Remaining properties override existing props.
	if (config !== undefined) {
		const configRecord = config as Record<string, unknown>;
		for (const [propName, propValue] of pairs(configRecord)) {
			if (propValue === undefined) {
				continue;
			}
			if (propName === 'key' || propName === 'ref' || propName === '__self' || propName === '__source') {
				continue;
			}
			props[propName] = propValue;
		}
	}

	// Children can be more than one argument, and those are transferred onto
	// the newly allocated props object.
	const childrenLength = children.size();
	if (childrenLength === 1) {
		props.children = children[0];
	} else if (childrenLength > 1) {
		props.children = children;
	}

	return ReactElement(element.type, key, ref, undefined, source, owner, props);
}

/**
 * Verifies that a value is a React element.
 *
 * @param object - The value to test.
 * @returns `true` when the value is a React element.
 * @internal
 */
export function isValidElement(object: unknown): boolean {
	return type(object) === 'table' && (object as Record<string, unknown>).$$typeof === REACT_ELEMENT_TYPE;
}
