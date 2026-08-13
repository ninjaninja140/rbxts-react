/**
 * Builds human-readable component stack frames for dev warnings and errors.
 *
 * Roblox cannot reproduce the V8 `Error.prepareStackTrace` behaviour that
 * upstream React relies on, so this port instead captures two Luau
 * `debug.traceback()` snapshots and diffs them to find the frame that
 * originated inside the component.
 *
 * @module ReactComponentStackFrame
 * @internal
 * @packageDocumentation
 */

import { __DEV__ } from '@nrbx/react-globals';

import type { Source } from './types/ReactElementType';
import type { ReactComponentType, ReactStatelessFunctionalComponent } from './types/flowtypes';

import {
	REACT_BLOCK_TYPE,
	REACT_FORWARD_REF_TYPE,
	REACT_LAZY_TYPE,
	REACT_MEMO_TYPE,
	REACT_SUSPENSE_LIST_TYPE,
	REACT_SUSPENSE_TYPE,
} from './ReactSymbols';
import { disableLogs, reenableLogs } from './ConsolePatchingDev';
import ReactSharedInternals from './ReactSharedInternals';
import type { Dispatcher } from './ReactSharedInternals';

const { ReactCurrentDispatcher } = ReactSharedInternals;

type ReactComponent<P> = ReactStatelessFunctionalComponent<P> | ReactComponentType<P>;

// Luau prints every stack frame the same way regardless of platform, so the
// prefix is constant.
const prefix = '    in ';

// Cache of previously computed frames, keyed by component. A Luau table cannot
// be weak-keyed through the `Record` index type, so a `Map` is used instead;
// its keys are the component functions/tables themselves.
const componentFrameCache = new Map<defined, string>();

let reentry = false;

/**
 * Luau arrays are 1-based, while roblox-ts exposes them as 0-based. The index
 * values below are kept identical to the upstream Lua source and converted
 * here, so the port stays line-for-line verifiable against the original.
 */
function lineAt(lines: Array<string>, luaIndex: number): string {
	return lines[luaIndex - 1];
}

function describeOwner(owner?: ReactComponent<unknown>): string | undefined {
	if (type(owner) === 'function') {
		const [name] = debug.info(owner as Callback, 'n');
		return name;
	} else if (type(owner) === 'table') {
		return tostring(owner);
	}
	return undefined;
}

export function describeBuiltInComponentFrame(name: string, source?: Source, owner?: ReactComponent<unknown>): string {
	const ownerName = __DEV__ && owner ? describeOwner(owner) : undefined;
	return describeComponentFrame(name, source, ownerName);
}

export function describeNativeComponentFrame(fn: ReactComponent<unknown> | undefined, construct: boolean): string {
	// If something asked for a stack inside a fake render, it should get ignored.
	if (!fn || reentry) {
		return '';
	}

	if (__DEV__) {
		const frame = componentFrameCache.get(fn);
		if (frame !== undefined) {
			return frame;
		}
	}

	let control: { stack?: string } | undefined;
	reentry = true;

	const previousDispatcher: Dispatcher | undefined = __DEV__ ? ReactCurrentDispatcher.current : undefined;

	if (__DEV__) {
		// Clear the dispatcher in DEV because this may be called in the render
		// function for warnings.
		ReactCurrentDispatcher.current = undefined;
		disableLogs();
	}

	let traceback: string | undefined;

	// Luau has no stack traces attached to errors, so we capture two
	// `debug.traceback()` snapshots and diff them below. The first (control) is
	// taken before invoking the component; the second (sample) is taken through
	// the error handler after the component throws.
	const [, sample] = xpcall(
		() => {
			if (construct) {
				// Constructing a class component cannot locate the component
				// definition, so there is no meaningful stack to produce.
			} else {
				const [, x] = pcall(() => {
					traceback = debug.traceback();
					error({ stack: traceback });
					return undefined;
				});
				control = x as { stack?: string };
				// This should throw.
				(fn as Callback)();
			}
		},
		(message: unknown) => ({
			message: message as defined,
			stack: traceback,
		})
	);

	let earlyOutValue: string | undefined;

	if (sample !== undefined && control !== undefined && type((sample as { stack?: defined }).stack) === 'string') {
		const sampleLines = string.split((sample as { stack: string }).stack, '\n');
		const controlLines = string.split((control as { stack: string }).stack, '\n');

		// The trailing newline produces one empty string at the end, so we
		// start from the last real line.
		let sampleIndex = sampleLines.size() - 1;
		let controlIndex = controlLines.size() - 1;

		while (
			sampleIndex >= 2 &&
			controlIndex >= 0 &&
			lineAt(sampleLines, sampleIndex) !== lineAt(controlLines, controlIndex)
		) {
			// At least one frame should be shared; keep searching down the
			// control stack for it.
			controlIndex -= 1;
		}

		while (sampleIndex >= 3 && controlIndex >= 1) {
			sampleIndex -= 1;
			controlIndex -= 1;

			// Find the first frame that differs, which should be the frame
			// that called the sample function and the control.
			if (lineAt(sampleLines, sampleIndex) !== lineAt(controlLines, controlIndex)) {
				if (sampleIndex !== 1 || controlIndex !== 1) {
					do {
						sampleIndex -= 1;
						controlIndex -= 1;

						// There may still be similar intermediate frames;
						// the next differing one is the match.
						if (
							controlIndex < 0 ||
							lineAt(sampleLines, sampleIndex) !== lineAt(controlLines, controlIndex)
						) {
							const frame = `\n${prefix}${lineAt(sampleLines, sampleIndex)}`;
							if (__DEV__) {
								componentFrameCache.set(fn, frame);
							}
							earlyOutValue = frame;
						}
					} while (sampleIndex >= 3 && controlIndex >= 1);
				}
				break;
			}
		}
	}

	reentry = false;
	if (__DEV__) {
		ReactCurrentDispatcher.current = previousDispatcher;
		reenableLogs();
	}

	if (earlyOutValue !== undefined) {
		return earlyOutValue;
	}

	// Fall back to the component name when no meaningful frame was found.
	let name: string | undefined;
	if (type(fn) === 'function') {
		const [fnName] = debug.info(fn as Callback, 'n');
		name = fnName;
	} else if (type(fn) === 'table') {
		name = tostring(fn);
	} else {
		name = '';
	}

	let syntheticFrame = '';
	if (name !== undefined && name !== '') {
		syntheticFrame = describeBuiltInComponentFrame(name);
	}

	if (__DEV__) {
		componentFrameCache.set(fn, syntheticFrame);
	}

	return syntheticFrame;
}

// Lua patterns work slightly differently from JavaScript regular expressions.
const BEFORE_SLASH_PATTERN = '^(.*)[\\/]';

export function describeComponentFrame(name: string | undefined, source?: Source, ownerName?: string): string {
	let sourceInfo = '';

	if (__DEV__ && source) {
		const path = source.fileName;
		const [fileName] = string.gsub(path, BEFORE_SLASH_PATTERN, '');

		// Prefer "folder/init.luau" instead of just "init.luau".
		let displayName = fileName;
		if (string.match(displayName, '^init%.') !== undefined) {
			const [pathBeforeSlash] = string.match(path, BEFORE_SLASH_PATTERN) as LuaTuple<[string | undefined]>;
			if (pathBeforeSlash !== undefined && pathBeforeSlash.size() !== 0) {
				const [folderName] = string.gsub(pathBeforeSlash, BEFORE_SLASH_PATTERN, '');
				displayName = `${folderName}/${displayName}`;
			}
		}

		sourceInfo = ` (at ${displayName}:${source.lineNumber})`;
	} else if (ownerName) {
		sourceInfo = ` (created by ${ownerName})`;
	}

	return `\n    in ${name ?? 'Unknown'}${sourceInfo}`;
}

export function describeClassComponentFrame(ctor: defined, source?: Source, owner?: ReactComponent<unknown>): string {
	// Roact class components are tables, so we jump directly to the basic
	// component description.
	const name = tostring(ctor);
	const ownerName = __DEV__ && owner ? describeOwner(owner) : undefined;
	return describeComponentFrame(name, source, ownerName);
}

export function describeFunctionComponentFrame(
	fn: Callback | undefined,
	source?: Source,
	ownerFn?: ReactComponent<unknown>
): string {
	if (!fn) {
		return '';
	}

	let name: string | undefined;
	if (type(fn) === 'function') {
		const [fnName] = debug.info(fn as Callback, 'n');
		name = fnName;
	} else {
		name = tostring(fn);
	}

	const ownerName = __DEV__ && ownerFn ? describeOwner(ownerFn) : undefined;
	return describeComponentFrame(name, source, ownerName);
}

export function describeUnknownElementTypeFrameInDEV(
	componentType: defined,
	source?: Source,
	ownerFn?: ReactComponent<unknown>
): string {
	if (!__DEV__) {
		return '';
	}
	if (componentType === undefined) {
		return '';
	}

	// In Lua, a class component is a table with a __ctor function, not a
	// function, so it must be detected explicitly.
	if (type(componentType) === 'table' && type((componentType as Record<string, defined>).__ctor) === 'function') {
		return describeClassComponentFrame(componentType, source, ownerFn);
	}

	if (type(componentType) === 'function') {
		return describeFunctionComponentFrame(componentType as Callback, source, ownerFn);
	}

	if (type(componentType) === 'string') {
		return describeBuiltInComponentFrame(componentType as string, source, ownerFn);
	}

	if (componentType === REACT_SUSPENSE_TYPE) {
		return describeBuiltInComponentFrame('Suspense', source, ownerFn);
	} else if (componentType === REACT_SUSPENSE_LIST_TYPE) {
		return describeBuiltInComponentFrame('SuspenseList', source, ownerFn);
	}

	if (type(componentType) === 'table') {
		const tableValue = componentType as Record<string, defined>;
		const typeProp = tableValue.$$typeof;

		if (typeProp === REACT_FORWARD_REF_TYPE) {
			return describeFunctionComponentFrame(tableValue.render as Callback, source, ownerFn);
		} else if (typeProp === REACT_MEMO_TYPE) {
			// Memo may contain any component type so we recursively resolve it.
			return describeUnknownElementTypeFrameInDEV(tableValue.type, source, ownerFn);
		} else if (typeProp === REACT_BLOCK_TYPE) {
			return describeFunctionComponentFrame(tableValue._render as Callback, source, ownerFn);
		} else if (typeProp === REACT_LAZY_TYPE) {
			const payload = tableValue._payload;
			const init = tableValue._init as Callback;

			const [ok, result] = pcall(() => {
				describeUnknownElementTypeFrameInDEV(
					// Lazy may contain any component type so we recursively resolve it.
					init(payload),
					source,
					ownerFn
				);
			});

			if (ok) {
				// The upstream Lua source also returns the pcall result here,
				// which is nil on success because the wrapped call discards its
				// own return value.
				return result as unknown as string;
			}
		}
	}

	return '';
}

export default {
	describeComponentFrame,
	describeBuiltInComponentFrame,
	describeNativeComponentFrame,
	describeClassComponentFrame,
	describeFunctionComponentFrame,
	describeUnknownElementTypeFrameInDEV,
};
