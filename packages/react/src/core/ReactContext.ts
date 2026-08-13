/**
 * Context creation.
 *
 * A context is a tiny object with a `Provider` and a `Consumer`. The
 * reconciler reads the `$$typeof` sentinel to recognise contexts and providers
 * while reconciling. In production the `Consumer` is the context itself; in
 * development we install a proxy so that common mistakes (like setting
 * `displayName` on the Consumer) can be caught and explained.
 *
 * @module ReactContext
 * @packageDocumentation
 */

import { __DEV__ } from '@nrbx/react-globals';
import { console, ReactSymbols } from '@nrbx/react-shared';
import type { ReactContext, ReactProviderType } from '@nrbx/react-shared';

const { REACT_CONTEXT_TYPE, REACT_PROVIDER_TYPE } = ReactSymbols;

/**
 * Lets you create a context that components can provide or read.
 *
 * ```tsx
 * const Theme = React.createContext("light");
 *
 * <Theme.Provider value="dark">
 *     <Label />
 * </Theme.Provider>
 * ```
 *
 * @param defaultValue - The value used when no matching `Provider` sits above
 *   the reading component. Treat this as a last-resort fallback.
 */
export function createContext<T>(defaultValue: T, calculateChangedBits?: (a: T, b: T) => number): ReactContext<T> {
	const context = {
		$$typeof: REACT_CONTEXT_TYPE,
		_calculateChangedBits: calculateChangedBits,
		// Primary/secondary fields exist to support multiple concurrent
		// renderers. Roblox typically uses a single renderer, but the fields are
		// kept so the reconciler's internal reads never hit nil.
		_currentValue: defaultValue,
		_currentValue2: defaultValue,
		_threadCount: 0,
		// Circular references are patched in after the object exists.
		Provider: undefined as unknown as ReactProviderType<T>,
		Consumer: undefined as unknown as ReactContext<T>,
		displayName: undefined as string | undefined,
		_currentRenderer: undefined as unknown | undefined,
		_currentRenderer2: undefined as unknown | undefined,
	} as ReactContext<T>;

	context.Provider = {
		$$typeof: REACT_PROVIDER_TYPE,
		_context: context,
	};

	if (__DEV__) {
		let hasWarnedAboutDisplayNameOnConsumer = false;

		const Consumer = {
			$$typeof: REACT_CONTEXT_TYPE,
			_context: context,
			_calculateChangedBits: context._calculateChangedBits,
		};

		// A proxy table that forwards reads/writes of the context fields back to
		// the real context, while warning on deprecated operations.
		const proxy = setmetatable(Consumer, {
			__index: (_target: Record<string, unknown>, key: unknown) => {
				if (key === '_currentValue') {
					return context._currentValue;
				} else if (key === '_currentValue2') {
					return context._currentValue2;
				} else if (key === '_threadCount') {
					return context._threadCount;
				} else if (key === 'displayName') {
					return context.displayName;
				}
				return undefined;
			},
			__newindex: (_target: Record<string, unknown>, key: unknown, value: unknown) => {
				if (key === '_currentValue') {
					context._currentValue = value as T;
				} else if (key === '_currentValue2') {
					context._currentValue2 = value as T;
				} else if (key === '_threadCount') {
					context._threadCount = value as number;
				} else if (key === 'displayName') {
					if (!hasWarnedAboutDisplayNameOnConsumer) {
						console.warn(
							'Setting `displayName` on Context.Consumer has no effect. ' +
								'You should set it directly on the context with Context.displayName = %s.',
							tostring(value)
						);
						hasWarnedAboutDisplayNameOnConsumer = true;
					}
				}
			},
		});

		context.Consumer = proxy as unknown as ReactContext<T>;
	} else {
		context.Consumer = context;
	}

	return context;
}
