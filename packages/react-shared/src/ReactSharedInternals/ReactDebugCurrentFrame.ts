/**
 * Holds the current stack frame used for dev warnings and errors.
 *
 * @module ReactDebugCurrentFrame
 * @internal
 * @packageDocumentation
 */

import { __DEV__ } from '@nrbx/react-globals';

let currentExtraStackFrame: string | undefined;

interface ReactDebugCurrentFrame {
	setExtraStackFrame: (stack?: string) => void;
	getCurrentStack?: () => string;
	getStackAddendum?: () => string;
}

/**
 * Sets an extra top-of-stack frame while an element is being validated.
 *
 * @internal
 */
export function setExtraStackFrame(stack?: string): void {
	if (__DEV__) {
		currentExtraStackFrame = stack;
	}
}

const ReactDebugCurrentFrame: ReactDebugCurrentFrame = {
	setExtraStackFrame,
};

if (__DEV__) {
	/** Stack implementation injected by the current renderer. */
	ReactDebugCurrentFrame.getCurrentStack = undefined;

	/**
	 * Returns the current component stack addendum.
	 *
	 * @internal
	 */
	ReactDebugCurrentFrame.getStackAddendum = () => {
		let stack = '';

		if (currentExtraStackFrame !== undefined) {
			stack += currentExtraStackFrame;
		}

		const impl = ReactDebugCurrentFrame.getCurrentStack;
		if (impl !== undefined) {
			stack += impl() ?? '';
		}

		return stack;
	};
}

export default ReactDebugCurrentFrame;
