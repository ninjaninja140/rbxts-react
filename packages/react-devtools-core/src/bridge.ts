/**
 * The message bridge between the DevTools backend and the frontend.
 *
 * Outgoing messages are queued and flushed in batches (all messages produced
 * within the same tick are sent together). A `wall` abstracts the transport —
 * on Roblox this is a WebSocket connection wrapped by `backend.ts`.
 *
 * Ported from `react-devtools-shared/src/bridge.js` (React 17).
 *
 * @module bridge
 * @packageDocumentation
 */

import { EventEmitter } from './events';
import type { Wall } from './types';
import type { RendererID } from './backend/types';

/** How long (ms) to wait between batch flushes once messages are flowing. */
const BATCH_DURATION = 100;

/** A queued outgoing message. */
export interface Message {
	event: string;
	payload: unknown;
}

/** Identifies a fiber plus the renderer that owns it. */
export interface ElementAndRendererID {
	id: number;
	rendererID: RendererID;
}

export interface OverrideValue extends ElementAndRendererID {
	path: Array<string | number>;
	wasForwarded?: boolean;
	value: unknown;
}

export interface OverrideHookState extends OverrideValue {
	hookID: number;
}

/** One of "props" | "hooks" | "state" | "context". */
export type PathType = string;

export interface DeletePath extends ElementAndRendererID {
	type: PathType;
	hookID?: number;
	path: Array<string | number>;
}

export interface RenamePath extends ElementAndRendererID {
	type: PathType;
	hookID?: number;
	oldPath: Array<string | number>;
	newPath: Array<string | number>;
}

export interface OverrideValueAtPath extends ElementAndRendererID {
	type: PathType;
	hookID?: number;
	path: Array<string | number>;
	value: unknown;
}

export interface OverrideSuspense extends ElementAndRendererID {
	forceFallback: boolean;
}

export interface CopyElementPathParams extends ElementAndRendererID {
	path: Array<string | number>;
}

export interface ViewAttributeSourceParams extends ElementAndRendererID {
	path: Array<string | number>;
}

export interface InspectElementParams extends ElementAndRendererID {
	path?: Array<string | number>;
}

export interface StoreAsGlobalParams extends ElementAndRendererID {
	count: number;
	path: Array<string | number>;
}

export interface HighlightElementInDOM extends ElementAndRendererID {
	displayName?: string;
	hideAfterTimeout: boolean;
	openNativeElementsPanel: boolean;
	scrollIntoView: boolean;
}

export interface IsSupported {
	isSupported: boolean;
	validAttributes: Array<string>;
}

/**
 * The bridge used by the backend (agent) side of DevTools.
 */
export class Bridge extends EventEmitter {
	private _isShutdown = false;
	private _messageQueue = [] as Message[];
	private _timeoutID: thread | undefined;
	private _wall: Wall;
	private _wallUnlisten: (() => void) | undefined;

	/** The underlying transport. Exposed for the backend's convenience. */
	public wall: Wall;

	constructor(wall: Wall) {
		super();
		this._wall = wall;
		this._wallUnlisten = wall.listen((message: { event: string; payload: unknown }) => {
			this.emit(message.event, message.payload);
		});

		// Temporarily support older standalone frontends sending commands to
		// newer embedded backends.
		this.addListener('overrideValueAtPath', (payload: unknown) => {
			this.overrideValueAtPath(payload as OverrideValueAtPath);
		});

		this.wall = wall;
	}

	/** Queues an outgoing message for the next flush. */
	public send(event: string, payload: unknown): void {
		if (this._isShutdown) {
			warn(`Cannot send message "${event}" through a Bridge that has been shutdown.`);
			return;
		}

		this._messageQueue.push({ event, payload });

		if (this._timeoutID === undefined) {
			this._timeoutID = task.delay(0, () => {
				this._flush();
			});
		}
	}

	/** Permanently disables the bridge and synchronously drains the queue. */
	public shutdown(): void {
		if (this._isShutdown) {
			warn('Bridge was already shutdown.');
			return;
		}

		// Queue the shutdown outgoing message for subscribers.
		this.send('shutdown', undefined);

		// Mark this bridge as destroyed and disable its public API.
		this._isShutdown = true;
		this.addListener = () => {};
		this.emit = () => {};

		// Unsubscribe from the wall.
		this.removeAllListeners();
		if (this._wallUnlisten !== undefined) {
			this._wallUnlisten();
			this._wallUnlisten = undefined;
		}

		// Synchronously flush all queued outgoing messages.
		while (this._messageQueue.size() > 0) {
			this._flush();
		}

		if (this._timeoutID !== undefined) {
			task.cancel(this._timeoutID);
			this._timeoutID = undefined;
		}
	}

	private _flush(): void {
		// Clear any pending timer; we re-arm below if messages keep flowing.
		if (this._timeoutID !== undefined) {
			task.cancel(this._timeoutID);
			this._timeoutID = undefined;
		}

		if (this._messageQueue.size() > 0) {
			for (const message of this._messageQueue) {
				this._wall.send(message.event, message.payload);
			}
			this._messageQueue.clear();

			// Check again for queued messages in BATCH_DURATION ms.
			this._timeoutID = task.delay(BATCH_DURATION, () => {
				this._flush();
			});
		}
	}

	/**
	 * Forwards modern `overrideValueAtPath` commands to the legacy
	 * `overrideContext` / `overrideHookState` / `overrideProps` /
	 * `overrideState` messages that older embedded backends expect.
	 */
	public overrideValueAtPath(ref: OverrideValueAtPath): void {
		const { id, path, rendererID, type: pathType, value } = ref;

		if (pathType === 'context') {
			this.send('overrideContext', { id, path, rendererID, wasForwarded: true, value });
		} else if (pathType === 'hooks') {
			this.send('overrideHookState', { id, path, rendererID, wasForwarded: true, value });
		} else if (pathType === 'props') {
			this.send('overrideProps', { id, path, rendererID, wasForwarded: true, value });
		} else if (pathType === 'state') {
			this.send('overrideState', { id, path, rendererID, wasForwarded: true, value });
		}
	}
}

/** Type alias for the backend-facing bridge. */
export type BackendBridge = Bridge;

export default Bridge;
