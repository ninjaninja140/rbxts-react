/**
 * Strict-mode developer warnings for legacy and unsafe lifecycles.
 *
 * Ported from `react-lua/modules/react-reconciler/src/ReactStrictModeWarnings.new.lua`.
 *
 * The warnings are recorded per-fiber and flushed in batches so a single
 * component appears once even when several of its fibers trigger the same
 * warning. All behaviour is compiled out of production builds via `__DEV__`.
 *
 * @module ReactStrictModeWarnings
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { __DEV__ } from '@nrbx/react-globals';
import { console, getComponentName } from '@nrbx/react-shared';
import type { Fiber } from './types';
import { resetCurrentFiber, setCurrentFiber } from './ReactCurrentFiber';
import { StrictMode } from './ReactTypeOfMode';

interface ReactStrictModeWarnings {
	recordUnsafeLifecycleWarnings: (fiber: Fiber, instance: Record<string, unknown> | undefined) => void;
	flushPendingUnsafeLifecycleWarnings: () => void;
	recordLegacyContextWarning: (fiber: Fiber, instance: Record<string, unknown> | undefined) => void;
	flushLegacyContextWarning: () => void;
	discardPendingWarnings: () => void;
}

const ReactStrictModeWarnings: ReactStrictModeWarnings = {
	recordUnsafeLifecycleWarnings: () => {},
	flushPendingUnsafeLifecycleWarnings: () => {},
	recordLegacyContextWarning: () => {},
	flushLegacyContextWarning: () => {},
	discardPendingWarnings: () => {},
};

if (__DEV__) {
	const findStrictRoot = (fiber: Fiber): Fiber | undefined => {
		let maybeStrictRoot: Fiber | undefined;

		let node: Fiber | undefined = fiber;
		while (node !== undefined) {
			if (bit32.band(node.mode, StrictMode) !== 0) {
				maybeStrictRoot = node;
			}
			node = node.return_;
		}

		return maybeStrictRoot;
	};

	const setToSortedString = (set: Map<string, boolean>): string => {
		const array: Array<string> = [];
		for (const [key] of set) {
			array.push(key);
		}
		table.sort(array);
		return array.join(', ');
	};

	const pendingComponentWillMountWarnings: Array<Fiber> = [];
	const pendingUNSAFE_ComponentWillMountWarnings: Array<Fiber> = [];
	const pendingComponentWillReceivePropsWarnings: Array<Fiber> = [];
	const pendingUNSAFE_ComponentWillReceivePropsWarnings: Array<Fiber> = [];
	const pendingComponentWillUpdateWarnings: Array<Fiber> = [];
	const pendingUNSAFE_ComponentWillUpdateWarnings: Array<Fiber> = [];

	// Tracks components we have already warned about.
	const didWarnAboutUnsafeLifecycles = new Map<defined, boolean>();

	ReactStrictModeWarnings.recordUnsafeLifecycleWarnings = (fiber, instance) => {
		// Dedupe strategy: Warn once per component.
		if (didWarnAboutUnsafeLifecycles.has(fiber.type)) {
			return;
		}

		if (instance !== undefined && typeOf(instance.componentWillMount) === 'function') {
			pendingComponentWillMountWarnings.push(fiber);
		}

		if (
			instance !== undefined &&
			bit32.band(fiber.mode, StrictMode) !== 0 &&
			typeOf(instance.UNSAFE_componentWillMount) === 'function'
		) {
			pendingUNSAFE_ComponentWillMountWarnings.push(fiber);
		}

		if (instance !== undefined && typeOf(instance.componentWillReceiveProps) === 'function') {
			pendingComponentWillReceivePropsWarnings.push(fiber);
		}

		if (
			instance !== undefined &&
			bit32.band(fiber.mode, StrictMode) !== 0 &&
			typeOf(instance.UNSAFE_componentWillReceiveProps) === 'function'
		) {
			pendingUNSAFE_ComponentWillReceivePropsWarnings.push(fiber);
		}

		if (instance !== undefined && typeOf(instance.componentWillUpdate) === 'function') {
			pendingComponentWillUpdateWarnings.push(fiber);
		}

		if (
			instance !== undefined &&
			bit32.band(fiber.mode, StrictMode) !== 0 &&
			typeOf(instance.UNSAFE_componentWillUpdate) === 'function'
		) {
			pendingUNSAFE_ComponentWillUpdateWarnings.push(fiber);
		}
	};

	ReactStrictModeWarnings.flushPendingUnsafeLifecycleWarnings = () => {
		// We do an initial pass to gather component names.
		const componentWillMountUniqueNames = new Map<string, boolean>();
		if (pendingComponentWillMountWarnings.size() > 0) {
			for (const fiber of pendingComponentWillMountWarnings) {
				componentWillMountUniqueNames.set(getComponentName(fiber.type) ?? 'Component', true);
				didWarnAboutUnsafeLifecycles.set(fiber.type, true);
			}
			table.clear(pendingComponentWillMountWarnings);
		}

		const UNSAFE_componentWillMountUniqueNames = new Map<string, boolean>();
		if (pendingUNSAFE_ComponentWillMountWarnings.size() > 0) {
			for (const fiber of pendingUNSAFE_ComponentWillMountWarnings) {
				UNSAFE_componentWillMountUniqueNames.set(getComponentName(fiber.type) ?? 'Component', true);
				didWarnAboutUnsafeLifecycles.set(fiber.type, true);
			}
			table.clear(pendingUNSAFE_ComponentWillMountWarnings);
		}

		const componentWillReceivePropsUniqueNames = new Map<string, boolean>();
		if (pendingComponentWillReceivePropsWarnings.size() > 0) {
			for (const fiber of pendingComponentWillReceivePropsWarnings) {
				componentWillReceivePropsUniqueNames.set(getComponentName(fiber.type) ?? 'Component', true);
				didWarnAboutUnsafeLifecycles.set(fiber.type, true);
			}
			table.clear(pendingComponentWillReceivePropsWarnings);
		}

		const UNSAFE_componentWillReceivePropsUniqueNames = new Map<string, boolean>();
		if (pendingUNSAFE_ComponentWillReceivePropsWarnings.size() > 0) {
			for (const fiber of pendingUNSAFE_ComponentWillReceivePropsWarnings) {
				UNSAFE_componentWillReceivePropsUniqueNames.set(getComponentName(fiber.type) ?? 'Component', true);
				didWarnAboutUnsafeLifecycles.set(fiber.type, true);
			}
			table.clear(pendingUNSAFE_ComponentWillReceivePropsWarnings);
		}

		const componentWillUpdateUniqueNames = new Map<string, boolean>();
		if (pendingComponentWillUpdateWarnings.size() > 0) {
			for (const fiber of pendingComponentWillUpdateWarnings) {
				componentWillUpdateUniqueNames.set(getComponentName(fiber.type) ?? 'Component', true);
				didWarnAboutUnsafeLifecycles.set(fiber.type, true);
			}
			table.clear(pendingComponentWillUpdateWarnings);
		}

		const UNSAFE_componentWillUpdateUniqueNames = new Map<string, boolean>();
		if (pendingUNSAFE_ComponentWillUpdateWarnings.size() > 0) {
			for (const fiber of pendingUNSAFE_ComponentWillUpdateWarnings) {
				UNSAFE_componentWillUpdateUniqueNames.set(getComponentName(fiber.type) ?? 'Component', true);
				didWarnAboutUnsafeLifecycles.set(fiber.type, true);
			}
			table.clear(pendingUNSAFE_ComponentWillUpdateWarnings);
		}

		// Finally, we flush all the warnings. UNSAFE_ ones go before the
		// deprecated ones, since they'll be 'louder'.
		if (!UNSAFE_componentWillMountUniqueNames.isEmpty()) {
			const sortedNames = setToSortedString(UNSAFE_componentWillMountUniqueNames);
			console.error(
				'Using UNSAFE_componentWillMount in strict mode is not recommended and may indicate bugs in your code. ' +
					'See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n' +
					'* Move code with side effects to componentDidMount, and set initial state in the constructor.\n' +
					'\nPlease update the following components: ' +
					sortedNames
			);
		}

		if (!UNSAFE_componentWillReceivePropsUniqueNames.isEmpty()) {
			const sortedNames = setToSortedString(UNSAFE_componentWillReceivePropsUniqueNames);
			console.error(
				'Using UNSAFE_componentWillReceiveProps in strict mode is not recommended ' +
					'and may indicate bugs in your code. ' +
					'See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n' +
					'* Move data fetching code or side effects to componentDidUpdate.\n' +
					"* If you're updating state whenever props change, " +
					'refactor your code to use memoization techniques or move it to ' +
					'static getDerivedStateFromProps. Learn more at: https://reactjs.org/link/derived-state\n' +
					'\nPlease update the following components: ' +
					sortedNames
			);
		}

		if (!UNSAFE_componentWillUpdateUniqueNames.isEmpty()) {
			const sortedNames = setToSortedString(UNSAFE_componentWillUpdateUniqueNames);
			console.error(
				'Using UNSAFE_componentWillUpdate in strict mode is not recommended ' +
					'and may indicate bugs in your code. ' +
					'See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n' +
					'* Move data fetching code or side effects to componentDidUpdate.\n' +
					'\nPlease update the following components: ' +
					sortedNames
			);
		}

		if (!componentWillMountUniqueNames.isEmpty()) {
			const sortedNames = setToSortedString(componentWillMountUniqueNames);
			console.warn(
				'componentWillMount has been renamed, and is not recommended for use. ' +
					'See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n' +
					'* Move code with side effects to componentDidMount, and set initial state in the constructor.\n' +
					'* Rename componentWillMount to UNSAFE_componentWillMount to suppress ' +
					'this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work.\n' +
					'\nPlease update the following components: ' +
					sortedNames
			);
		}

		if (!componentWillReceivePropsUniqueNames.isEmpty()) {
			const sortedNames = setToSortedString(componentWillReceivePropsUniqueNames);
			console.warn(
				'componentWillReceiveProps has been renamed, and is not recommended for use. ' +
					'See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n' +
					'* Move data fetching code or side effects to componentDidUpdate.\n' +
					"* If you're updating state whenever props change, refactor your " +
					'code to use memoization techniques or move it to ' +
					'static getDerivedStateFromProps. Learn more at: https://reactjs.org/link/derived-state\n' +
					'* Rename componentWillReceiveProps to UNSAFE_componentWillReceiveProps to suppress ' +
					'this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work.\n' +
					'\nPlease update the following components: ' +
					sortedNames
			);
		}

		if (!componentWillUpdateUniqueNames.isEmpty()) {
			const sortedNames = setToSortedString(componentWillUpdateUniqueNames);
			console.warn(
				'componentWillUpdate has been renamed, and is not recommended for use. ' +
					'See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n' +
					'* Move data fetching code or side effects to componentDidUpdate.\n' +
					'* Rename componentWillUpdate to UNSAFE_componentWillUpdate to suppress ' +
					'this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work.\n' +
					'\nPlease update the following components: ' +
					sortedNames
			);
		}
	};

	const pendingLegacyContextWarning = new Map<Fiber, Array<Fiber>>();

	// Tracks components we have already warned about.
	const didWarnAboutLegacyContext = new Map<defined, boolean>();

	ReactStrictModeWarnings.recordLegacyContextWarning = (fiber, instance) => {
		const strictRoot = findStrictRoot(fiber);
		if (strictRoot === undefined) {
			console.error(
				'Expected to find a StrictMode component in a strict mode tree. ' +
					'This error is likely caused by a bug in React. Please file an issue.'
			);
			return;
		}

		// Dedup strategy: Warn once per component.
		if (didWarnAboutLegacyContext.has(fiber.type)) {
			return;
		}

		const type_ = fiber.type as { contextTypes?: unknown; childContextTypes?: unknown };
		let warningsForRoot = pendingLegacyContextWarning.get(strictRoot);

		if (
			typeOf(fiber.type) !== 'function' &&
			(type_.contextTypes !== undefined ||
				type_.childContextTypes !== undefined ||
				(instance !== undefined && typeOf(instance.getChildContext) === 'function'))
		) {
			if (warningsForRoot === undefined) {
				warningsForRoot = [];
				pendingLegacyContextWarning.set(strictRoot, warningsForRoot);
			}
			warningsForRoot.push(fiber);
		}
	};

	ReactStrictModeWarnings.flushLegacyContextWarning = () => {
		for (const [_strictRoot, fiberArray] of pendingLegacyContextWarning) {
			if (fiberArray.size() === 0) {
				return;
			}
			const firstFiber = fiberArray[0];

			const uniqueNames = new Map<string, boolean>();
			for (const fiber of fiberArray) {
				uniqueNames.set(getComponentName(fiber.type) ?? 'Component', true);
				didWarnAboutLegacyContext.set(fiber.type, true);
			}

			const sortedNames = setToSortedString(uniqueNames);

			const [ok, error_] = pcall(() => {
				setCurrentFiber(firstFiber);
				console.error(
					'Legacy context API has been detected within a strict-mode tree.' +
						'\n\nThe old API will be supported in all 16.x releases, but applications ' +
						'using it should migrate to the new version.' +
						'\n\nPlease update the following components: ' +
						sortedNames +
						'\n\nLearn more about this warning here: https://reactjs.org/link/legacy-context'
				);
			});

			// finally
			resetCurrentFiber();

			if (!ok) {
				error(error_);
			}
		}
	};

	ReactStrictModeWarnings.discardPendingWarnings = () => {
		table.clear(pendingComponentWillMountWarnings);
		table.clear(pendingUNSAFE_ComponentWillMountWarnings);
		table.clear(pendingComponentWillReceivePropsWarnings);
		table.clear(pendingUNSAFE_ComponentWillReceivePropsWarnings);
		table.clear(pendingComponentWillUpdateWarnings);
		table.clear(pendingUNSAFE_ComponentWillUpdateWarnings);
		pendingLegacyContextWarning.clear();
	};
}

export default ReactStrictModeWarnings;
