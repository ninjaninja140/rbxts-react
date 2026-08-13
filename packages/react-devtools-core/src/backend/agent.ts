/**
 * Backend DevTools agent that coordinates frontend bridge messages and renderers.
 *
 * Ported from `react-devtools-shared/src/backend/agent.lua` (React 17).
 *
 * @module backend/agent
 * @packageDocumentation
 */

import { Console } from './console';
import * as ReactGlobals from '@nrbx/react-globals';
import type {
	InstanceAndStyle,
	NativeType,
	OwnersList,
	PathFrame,
	PathMatch,
	RendererID,
	RendererInterface,
} from './types';
import { EventEmitter } from '../events';
import {
	SESSION_STORAGE_LAST_SELECTION_KEY,
	SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY,
	SESSION_STORAGE_RELOAD_AND_PROFILE_KEY,
	__DEBUG__,
} from '../constants';
import type {
	BackendBridge,
	CopyElementPathParams,
	DeletePath,
	ElementAndRendererID,
	InspectElementParams,
	OverrideHookState,
	OverrideSuspense,
	OverrideValue,
	OverrideValueAtPath,
	RenamePath,
	StoreAsGlobalParams,
	ViewAttributeSourceParams,
} from '../bridge';
import { sessionStorageGetItem, sessionStorageRemoveItem, sessionStorageSetItem } from '../storage';
import type { ComponentFilter } from '../types';
import { setupHighlighter } from './views/Highlighter';

const JSON = game.GetService('HttpService');

type Callback<TArgs extends Array<unknown>> = (...args: TArgs) => void;

type PersistedSelection = {
	rendererID: number;
	path: Array<PathFrame>;
};

/** Pass-through throttle stub for Roblox. */
const throttle = <TArgs extends Array<unknown>>(fn: Callback<TArgs>, _limit: number): Callback<TArgs> => fn;

/** Trace-updates setup stub for Roblox. */
const setupTraceUpdates = (_agent: unknown): void => {};

/** Trace-updates toggle stub for Roblox. */
const setTraceUpdatesEnabled = (_enabled: boolean): void => {};

/** Console patching stub for Roblox. */
const patchConsole = (_obj: unknown): void => {};

/** Console unpatching stub for Roblox. */
const unpatchConsole = (): void => {};

function debug_(methodName: string, ...args: Array<unknown>): void {
	if (__DEBUG__) {
		print(methodName, ...args);
	}
}

/**
 * Coordinates bridge commands and per-renderer DevTools interfaces.
 */
export class Agent extends EventEmitter {
	private readonly _bridge: BackendBridge;
	private _isProfiling: boolean;
	private _recordChangeDescriptions: boolean;
	public _rendererInterfaces: Record<number, RendererInterface>;
	private _persistedSelection: PersistedSelection | undefined;
	private _persistedSelectionMatch: PathMatch | undefined;
	private _traceUpdatesEnabled: boolean;

	private readonly _throttledPersistSelection: (rendererID: number, id: number) => void;

	public constructor(bridge: BackendBridge) {
		super();

		this._bridge = bridge;
		this._isProfiling = false;
		this._recordChangeDescriptions = false;
		this._rendererInterfaces = {};
		this._persistedSelection = undefined;
		this._persistedSelectionMatch = undefined;
		this._traceUpdatesEnabled = false;

		this._throttledPersistSelection = throttle((rendererID: number, id: number) => {
			const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;
			const path = renderer !== undefined ? renderer.getPathForElement(id) : undefined;

			if (path !== undefined) {
				sessionStorageSetItem(
					SESSION_STORAGE_LAST_SELECTION_KEY,
					JSON.JSONEncode({
						rendererID,
						path,
					})
				);
			} else {
				sessionStorageRemoveItem(SESSION_STORAGE_LAST_SELECTION_KEY);
			}
		}, 1000);

		if (sessionStorageGetItem(SESSION_STORAGE_RELOAD_AND_PROFILE_KEY) === 'true') {
			this._recordChangeDescriptions =
				sessionStorageGetItem(SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY) === 'true';
			this._isProfiling = true;

			sessionStorageRemoveItem(SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY);
			sessionStorageRemoveItem(SESSION_STORAGE_RELOAD_AND_PROFILE_KEY);
		}

		const persistedSelectionString = sessionStorageGetItem(SESSION_STORAGE_LAST_SELECTION_KEY);
		if (persistedSelectionString !== undefined) {
			this._persistedSelection = JSON.JSONDecode(persistedSelectionString as string) as PersistedSelection;
		}

		const wrapSelf = (method: (...args: Array<unknown>) => void) => {
			return (...args: Array<unknown>): void => {
				method(...args);
			};
		};

		bridge.addListener(
			'copyElementPath',
			wrapSelf((payload) => this.copyElementPath(payload as CopyElementPathParams))
		);
		bridge.addListener(
			'deletePath',
			wrapSelf((payload) => this.deletePath(payload as DeletePath))
		);
		bridge.addListener(
			'getProfilingData',
			wrapSelf((payload) => this.getProfilingData(payload as { rendererID: RendererID }))
		);
		bridge.addListener(
			'getProfilingStatus',
			wrapSelf(() => this.getProfilingStatus())
		);
		bridge.addListener(
			'getOwnersList',
			wrapSelf((payload) => this.getOwnersList(payload as ElementAndRendererID))
		);
		bridge.addListener(
			'inspectElement',
			wrapSelf((payload) => this.inspectElement(payload as InspectElementParams))
		);
		bridge.addListener(
			'logElementToConsole',
			wrapSelf((payload) => this.logElementToConsole(payload as ElementAndRendererID))
		);
		bridge.addListener(
			'overrideSuspense',
			wrapSelf((payload) => this.overrideSuspense(payload as OverrideSuspense))
		);
		bridge.addListener(
			'overrideValueAtPath',
			wrapSelf((payload) => this.overrideValueAtPath(payload as OverrideValueAtPath))
		);
		bridge.addListener(
			'reloadAndProfile',
			wrapSelf((payload) => this.reloadAndProfile(payload as boolean))
		);
		bridge.addListener(
			'renamePath',
			wrapSelf((payload) => this.renamePath(payload as RenamePath))
		);
		bridge.addListener(
			'setTraceUpdatesEnabled',
			wrapSelf((payload) => this.setTraceUpdatesEnabled(payload as boolean))
		);
		bridge.addListener(
			'startProfiling',
			wrapSelf((payload) => this.startProfiling(payload as boolean))
		);
		bridge.addListener(
			'stopProfiling',
			wrapSelf(() => this.stopProfiling())
		);
		bridge.addListener(
			'storeAsGlobal',
			wrapSelf((payload) => this.storeAsGlobal(payload as StoreAsGlobalParams))
		);
		bridge.addListener(
			'syncSelectionFromNativeElementsPanel',
			wrapSelf(() => this.syncSelectionFromNativeElementsPanel())
		);
		bridge.addListener(
			'shutdown',
			wrapSelf(() => this.shutdown())
		);
		bridge.addListener(
			'updateConsolePatchSettings',
			wrapSelf((payload) =>
				this.updateConsolePatchSettings(
					payload as {
						appendComponentStack: boolean;
						breakOnConsoleErrors: boolean;
					}
				)
			)
		);
		bridge.addListener(
			'updateComponentFilters',
			wrapSelf((payload) => this.updateComponentFilters(payload as Array<ComponentFilter>))
		);
		bridge.addListener(
			'viewAttributeSource',
			wrapSelf((payload) => this.viewAttributeSource(payload as ViewAttributeSourceParams))
		);
		bridge.addListener(
			'viewElementSource',
			wrapSelf((payload) => this.viewElementSource(payload as ElementAndRendererID))
		);

		// Temporarily support older standalone front-ends sending commands to newer embedded backends.
		bridge.addListener(
			'overrideContext',
			wrapSelf((payload) => this.overrideContext(payload as OverrideValue))
		);
		bridge.addListener(
			'overrideHookState',
			wrapSelf((payload) => this.overrideHookState(payload as OverrideHookState))
		);
		bridge.addListener(
			'overrideProps',
			wrapSelf((payload) => this.overrideProps(payload as OverrideValue))
		);
		bridge.addListener(
			'overrideState',
			wrapSelf((payload) => this.overrideState(payload as OverrideValue))
		);

		if (this._isProfiling) {
			bridge.send('profilingStatus', true);
		}

		const isBackendStorageAPISupported = true;
		bridge.send('isBackendStorageAPISupported', isBackendStorageAPISupported);

		setupHighlighter(bridge, this);
		setupTraceUpdates(this);
	}

	/** Returns renderer interfaces keyed by renderer ID. */
	public getRendererInterfaces(): Record<number, RendererInterface> {
		return this._rendererInterfaces;
	}

	/** Copies a value from the selected element path. */
	public copyElementPath(copyElementParams: CopyElementPathParams): void {
		const { id, path, rendererID } = copyElementParams;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d" for element "%d"', rendererID, id));
		} else {
			renderer.copyElementPath(id, path);
		}
	}

	/** Deletes an editable value at a specific path. */
	public deletePath(deletePathParams: DeletePath): void {
		const { hookID, id, path, rendererID, type: pathType } = deletePathParams;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d" for element "%d"', rendererID, id));
		} else {
			renderer.deletePath(pathType, id, hookID, path);
		}
	}

	/** Returns the inspected native instance and style for an element. */
	public getInstanceAndStyle(elementAndRendererId: ElementAndRendererID): InstanceAndStyle | undefined {
		const { id, rendererID } = elementAndRendererId;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d"', rendererID));
			return undefined;
		}

		return renderer.getInstanceAndStyle(id);
	}

	/** Finds the DevTools element ID for a native node. */
	public getIDForNode(node: object): number | undefined {
		for (const [, renderer] of pairs(this._rendererInterfaces as Record<number, RendererInterface | undefined>)) {
			if (renderer !== undefined) {
				const [ok, result] = pcall(() => renderer.getFiberIDForNative(node, true));
				if (ok && result !== undefined) {
					return result as number;
				}
			}
		}

		return undefined;
	}

	/** Sends profiling data for the requested renderer. */
	public getProfilingData(rendererIdObject: { rendererID: RendererID }): void {
		const { rendererID } = rendererIdObject;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d"', rendererID));
		}

		this._bridge.send('profilingData', (renderer as RendererInterface).getProfilingData());
	}

	/** Sends current profiling status to the frontend. */
	public getProfilingStatus(): void {
		this._bridge.send('profilingStatus', this._isProfiling);
	}

	/** Sends owner list information for an element. */
	public getOwnersList(elementAndRendererID: ElementAndRendererID): void {
		const { id, rendererID } = elementAndRendererID;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d" for element "%d"', rendererID, id));
		} else {
			const owners = renderer.getOwnersList(id);
			const payload: OwnersList = { id, owners };
			this._bridge.send('ownersList', payload);
		}
	}

	/** Sends inspected element data and persists selection state. */
	public inspectElement(inspectElementParams: InspectElementParams): void {
		const { id, path, rendererID } = inspectElementParams;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d" for element "%d"', rendererID, id));
		} else {
			this._bridge.send('inspectedElement', renderer.inspectElement(id, path));

			if (this._persistedSelectionMatch === undefined || this._persistedSelectionMatch.id !== id) {
				this._persistedSelection = undefined;
				this._persistedSelectionMatch = undefined;

				renderer.setTrackedPath(undefined);
				this._throttledPersistSelection(rendererID, id);
			}
		}
	}

	/** Logs an element to the console. */
	public logElementToConsole(elementAndRendererID: ElementAndRendererID): void {
		const { id, rendererID } = elementAndRendererID;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d" for element "%d"', rendererID, id));
		} else {
			renderer.logElementToConsole(id);
		}
	}

	/** Overrides suspense fallback state for an element. */
	public overrideSuspense(overrideSuspenseParams: OverrideSuspense): void {
		const { id, rendererID, forceFallback } = overrideSuspenseParams;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d" for element "%d"', rendererID, id));
		} else {
			renderer.overrideSuspense(id, forceFallback);
		}
	}

	/** Overrides a value at a specific element path. */
	public overrideValueAtPath(overrideValueAtPathParams: OverrideValueAtPath): void {
		const { hookID, id, path, rendererID, type: pathType, value } = overrideValueAtPathParams;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d" for element "%d"', rendererID, id));
		} else {
			renderer.overrideValueAtPath(pathType, id, hookID, path, value);
		}
	}

	/** Forwards legacy context override messages. */
	public overrideContext(setInParams: OverrideValue): void {
		const { id, path, rendererID, wasForwarded, value } = setInParams;

		if (!wasForwarded) {
			this.overrideValueAtPath({
				id,
				path,
				rendererID,
				type: 'context',
				value,
			});
		}
	}

	/** Forwards legacy hook override messages. */
	public overrideHookState(overrideHookParams: OverrideHookState): void {
		const { id, path, rendererID, wasForwarded, value } = overrideHookParams;

		if (!wasForwarded) {
			this.overrideValueAtPath({
				id,
				path,
				rendererID,
				type: 'hooks',
				value,
			});
		}
	}

	/** Forwards legacy props override messages. */
	public overrideProps(setInParams: OverrideValue): void {
		const { id, path, rendererID, wasForwarded, value } = setInParams;

		if (!wasForwarded) {
			this.overrideValueAtPath({
				id,
				path,
				rendererID,
				type: 'props',
				value,
			});
		}
	}

	/** Forwards legacy state override messages. */
	public overrideState(setInParams: OverrideValue): void {
		const { id, path, rendererID, wasForwarded, value } = setInParams;

		if (!wasForwarded) {
			this.overrideValueAtPath({
				id,
				path,
				rendererID,
				type: 'state',
				value,
			});
		}
	}

	/** Enables reload-and-profile mode and asks host to reload. */
	public reloadAndProfile(recordChangeDescriptions: boolean): void {
		sessionStorageSetItem(SESSION_STORAGE_RELOAD_AND_PROFILE_KEY, 'true');
		sessionStorageSetItem(
			SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY,
			recordChangeDescriptions ? 'true' : 'false'
		);

		this._bridge.send('reloadAppForProfiling', undefined);
	}

	/** Renames a value path on the selected element. */
	public renamePath(renamePathParams: RenamePath): void {
		const { hookID, id, newPath, oldPath, rendererID, type: pathType } = renamePathParams;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d" for element "%d"', rendererID, id));
		} else {
			renderer.renamePath(pathType, id, hookID, oldPath, newPath);
		}
	}

	/** Selects a native node in DevTools by resolving its element ID. */
	public selectNode(target: object): void {
		const id = this.getIDForNode(target);
		if (id !== undefined) {
			this._bridge.send('selectFiber', id);
		}
	}

	/** Registers a renderer interface with the agent. */
	public setRendererInterface(rendererID: number, rendererInterface: RendererInterface): void {
		this._rendererInterfaces[rendererID] = rendererInterface;

		if (this._isProfiling) {
			rendererInterface.startProfiling(this._recordChangeDescriptions);
		}

		rendererInterface.setTraceUpdatesEnabled(this._traceUpdatesEnabled);

		const selection = this._persistedSelection;
		if (selection !== undefined && selection.rendererID === rendererID) {
			rendererInterface.setTrackedPath(selection.path);
		}
	}

	/** Enables or disables trace updates mode. */
	public setTraceUpdatesEnabled(traceUpdatesEnabled: boolean): void {
		this._traceUpdatesEnabled = traceUpdatesEnabled;
		setTraceUpdatesEnabled(traceUpdatesEnabled);

		for (const [, renderer] of pairs(this._rendererInterfaces as Record<number, RendererInterface | undefined>)) {
			if (renderer !== undefined) {
				renderer.setTraceUpdatesEnabled(traceUpdatesEnabled);
			}
		}
	}

	/** Syncs selection from the native elements panel ($0). */
	public syncSelectionFromNativeElementsPanel(): void {
		const hook = ReactGlobals.__REACT_DEVTOOLS_GLOBAL_HOOK__ as Record<string, unknown> | undefined;
		const target = hook?.$0;

		if (target === undefined) {
			return;
		}

		this.selectNode(target as object);
	}

	/** Emits shutdown to clean up overlays and listeners. */
	public shutdown(): void {
		this.emit('shutdown');
	}

	/** Starts profiling across all attached renderers. */
	public startProfiling(recordChangeDescriptions = false): void {
		this._recordChangeDescriptions = recordChangeDescriptions;
		this._isProfiling = true;

		for (const [, renderer] of pairs(this._rendererInterfaces as Record<number, RendererInterface | undefined>)) {
			if (renderer !== undefined) {
				renderer.startProfiling(recordChangeDescriptions);
			}
		}

		this._bridge.send('profilingStatus', this._isProfiling);
	}

	/** Stops profiling across all attached renderers. */
	public stopProfiling(): void {
		this._isProfiling = false;
		this._recordChangeDescriptions = false;

		for (const [, renderer] of pairs(this._rendererInterfaces as Record<number, RendererInterface | undefined>)) {
			if (renderer !== undefined) {
				renderer.stopProfiling();
			}
		}

		this._bridge.send('profilingStatus', this._isProfiling);
	}

	/** Stores a selected path as a global value. */
	public storeAsGlobal(storeAsGlobalParams: StoreAsGlobalParams): void {
		const { count, id, path, rendererID } = storeAsGlobalParams;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d" for element "%d"', rendererID, id));
		} else {
			renderer.storeAsGlobal(id, path, count);
		}
	}

	/** Updates console patch settings for append-stack and break-on-error behavior. */
	public updateConsolePatchSettings(settings: {
		appendComponentStack: boolean;
		breakOnConsoleErrors: boolean;
	}): void {
		const { appendComponentStack, breakOnConsoleErrors } = settings;

		if (appendComponentStack || breakOnConsoleErrors) {
			patchConsole({
				appendComponentStack,
				breakOnConsoleErrors,
			});
		} else {
			unpatchConsole();
		}
	}

	/** Updates component filters for all attached renderers. */
	public updateComponentFilters(componentFilters: Array<ComponentFilter>): void {
		for (const [, renderer] of pairs(this._rendererInterfaces as Record<number, RendererInterface | undefined>)) {
			if (renderer !== undefined) {
				renderer.updateComponentFilters(componentFilters);
			}
		}
	}

	/** Prepares source view for a specific element attribute path. */
	public viewAttributeSource(copyElementParams: ViewAttributeSourceParams): void {
		const { id, path, rendererID } = copyElementParams;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d" for element "%d"', rendererID, id));
		} else {
			renderer.prepareViewAttributeSource(id, path);
		}
	}

	/** Prepares source view for a selected element. */
	public viewElementSource(elementAndRendererID: ElementAndRendererID): void {
		const { id, rendererID } = elementAndRendererID;
		const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;

		if (renderer === undefined) {
			Console.warn(string.format('Invalid renderer id "%d" for element "%d"', rendererID, id));
		} else {
			renderer.prepareViewElementSource(id);
		}
	}

	/** Emits trace update nodes for highlighting. */
	public onTraceUpdates(nodes: Set<NativeType>): void {
		this.emit('traceUpdates', nodes);
	}

	/** Handles operation payloads from renderers. */
	public onHookOperations(operations: Array<number>): void {
		if (ReactGlobals.__DEBUG__) {
			debug_('onHookOperations', operations);
		}

		this._bridge.send('operations', operations);

		if (this._persistedSelection !== undefined) {
			const rendererID = operations[0] as number;

			if (this._persistedSelection.rendererID === rendererID) {
				const renderer = this._rendererInterfaces[rendererID] as RendererInterface | undefined;
				if (renderer === undefined) {
					Console.warn(string.format('Invalid renderer id "%d"', rendererID));
				} else {
					const prevMatch = this._persistedSelectionMatch;
					const nextMatch = renderer.getBestMatchForTrackedPath();
					this._persistedSelectionMatch = nextMatch;

					const prevMatchID = prevMatch !== undefined ? prevMatch.id : undefined;
					const nextMatchID = nextMatch !== undefined ? nextMatch.id : undefined;

					if (prevMatchID !== nextMatchID) {
						if (nextMatchID !== undefined) {
							this._bridge.send('selectFiber', nextMatchID);
						}
					}

					if (nextMatch?.isFullMatch) {
						this._persistedSelection = undefined;
						this._persistedSelectionMatch = undefined;
						renderer.setTrackedPath(undefined);
					}
				}
			}
		}
	}

	/** Notifies frontend that a renderer version is unsupported. */
	public onUnsupportedRenderer(rendererID: number): void {
		this._bridge.send('unsupportedRendererVersion', rendererID);
	}
}

export default Agent;
