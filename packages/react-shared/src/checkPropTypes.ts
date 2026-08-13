/**
 * Validates a component's `propTypes` (and the legacy Roact `validateProps`)
 * during render, warning or throwing in DEV as appropriate.
 *
 * @module checkPropTypes
 * @internal
 * @packageDocumentation
 */

import { __DEV__, __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__ } from '@nrbx/react-globals';

import { consoleTable as console } from './console';
import { describeUnknownElementTypeFrameInDEV } from './ReactComponentStackFrame';
import { describeError } from './ErrorHandling';
import type { ReactError } from './ErrorHandling';
import ReactSharedInternals from './ReactSharedInternals';
import type { Source } from './types/ReactElementType';
import type { ReactComponentType } from './types/flowtypes';

const { ReactDebugCurrentFrame } = ReactSharedInternals;

const loggedTypeFailures: Record<string, boolean> = {};

interface ValidatingElement {
	_owner?: { type?: defined };
	_source?: Source;
	type?: defined;
}

function setCurrentlyValidatingElement(element?: ValidatingElement): void {
	if (__DEV__) {
		if (element) {
			const owner = element._owner;
			const stack = describeUnknownElementTypeFrameInDEV(
				element.type as defined,
				element._source,
				owner !== undefined ? (owner.type as unknown as ReactComponentType<unknown>) : undefined
			);
			ReactDebugCurrentFrame.setExtraStackFrame(stack);
		} else {
			ReactDebugCurrentFrame.setExtraStackFrame(undefined);
		}
	}
}

export default function checkPropTypes<P>(
	propTypes?: Record<string, defined>,
	validateProps?: (props: P) => LuaTuple<[boolean, string?]>,
	props?: P,
	location?: string,
	componentName?: string,
	element?: ValidatingElement
): void {
	if (__DEV__ || __DISABLE_ALL_WARNINGS_EXCEPT_PROP_VALIDATION__) {
		// Warns when both propTypes and validateProps are defined.
		if (propTypes && validateProps) {
			console.warn(`You've defined both propTypes and validateProps on ${componentName ?? 'a component'}`);
		}

		// The legacy Roact validateProps hook.
		if (validateProps) {
			if (typeOf(validateProps) !== 'function') {
				console.error(
					`validateProps must be a function, but it is a ${typeOf(validateProps)}.\nCheck the definition of the component "${componentName ?? ''}".`
				);
			} else {
				const [success, rawFailureReason] = validateProps(props as P);

				if (!success) {
					const failureReason = rawFailureReason ?? '<Validator function did not supply a message>';
					const message = string.format(
						'validateProps failed on a %s type in %s: %s',
						location ?? '<unknown>',
						componentName ?? '<UNKNOWN Component>',
						tostring(failureReason)
					);
					// Legacy Roact threw on prop validation failure, so we keep
					// that behaviour even though propTypes only warns.
					error(message);
				}
			}
		}

		if (propTypes) {
			for (const [rawTypeSpecName] of pairs(propTypes)) {
				const typeSpecName = rawTypeSpecName as string;

				// Prop type validation may throw. In case it does, we don't want
				// to fail the render phase where it didn't fail before, so we log
				// it instead.
				const [, result] = xpcall(() => {
					const typeSpec = propTypes[typeSpecName];

					// Intentionally an invariant that gets caught — same behaviour
					// as without this statement, except with a better message.
					if (typeOf(typeSpec) !== 'function') {
						const err = {
							message:
								(componentName ?? 'React class') +
								': ' +
								(location ?? '<unknown>') +
								' type `' +
								typeSpecName +
								'` is invalid; ' +
								'it must be a function, usually from the `prop-types` package, but received `' +
								typeOf(typeSpec) +
								'`.' +
								'This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.',
							stack: undefined,
							name: 'Invariant Violation',
						} as ReactError & { name: string };
						error(err);
					}

					return (typeSpec as Callback)(
						props,
						typeSpecName,
						componentName,
						location,
						undefined,
						'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED'
					) as unknown;
				}, describeError);

				const isErrorObject = typeOf(result) === 'table';

				if (result !== undefined && !isErrorObject) {
					setCurrentlyValidatingElement(element);
					console.error(
						string.format(
							'%s: type specification of %s `%s` is invalid; the type checker function must return `nil` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).',
							componentName ?? 'React class',
							location ?? '<unknown>',
							typeSpecName,
							typeOf(result)
						)
					);
					setCurrentlyValidatingElement(undefined);
				}

				if (isErrorObject) {
					const resultAsError = result as ReactError;
					const message = resultAsError.message ?? '';

					// Only report each failure once, because the same error tends
					// to repeat a lot.
					if (loggedTypeFailures[message] === undefined) {
						loggedTypeFailures[tostring(message)] = true;
						setCurrentlyValidatingElement(element);
						console.warn(string.format('Failed %s type: %s', location ?? '<unknown>', tostring(message)));
						setCurrentlyValidatingElement(undefined);
					}
				}
			}
		}
	}
}
