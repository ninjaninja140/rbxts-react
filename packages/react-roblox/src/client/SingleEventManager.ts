/**
 * Manager for event connections on a single Roblox `Instance`.
 *
 * React batch-updates events during the render phase — this manager queues
 * events when "suspended" and replays them when "resumed". This prevents
 * event-driven state changes from happening mid-render.
 *
 * The manager has three states:
 *
 * - **Disabled** — All events are silently discarded (initial state).
 * - **Suspended** — Events are queued for later replay.
 * - **Enabled** — Events fire listeners immediately.
 *
 * Typically the lifecycle is: `Disabled → Suspended → Enabled`.
 *
 * @module SingleEventManager
 */

type Listener = (instance: Instance, ...args: unknown[]) => void;

interface QueuedEvent {
	eventKey: string;
	argumentCount: number;
	args: unknown[];
}

interface ConnectionInfo {
	connection: RBXScriptConnection;
}

/** Prefix used for property-change event keys. */
const CHANGE_PREFIX = 'Change.';

enum EventStatus {
	Disabled = 'Disabled',
	Suspended = 'Suspended',
	Enabled = 'Enabled',
}

export class SingleEventManager {
	/** Queued events fired while we were suspended. */
	private suspendedEventQueue: QueuedEvent[] = [];

	/** Active Roblox signal connections, keyed by event identifier. */
	private connections: Map<string, ConnectionInfo> = new Map();

	/** Event listeners, keyed by event identifier. */
	private listeners: Map<string, Listener> = new Map();

	/** Current event processing status. */
	private status: EventStatus = EventStatus.Disabled;

	/** Guard to prevent re-entrant resumes. */
	private isResuming = false;

	/** The Roblox instance whose events we manage. */
	private instance: Instance;

	constructor(instance: Instance) {
		this.instance = instance;
	}

	/**
	 * Connect to a Roblox event (e.g. `Activated`, `MouseButton1Click`).
	 *
	 * @param key - The event name on the instance (e.g. `"Activated"`).
	 * @param listener - Callback invoked when the event fires. Pass `undefined` to disconnect.
	 */
	public connectEvent(key: string, listener: Listener | undefined): void {
		this.internalConnect(
			key,
			(this.instance as unknown as Record<string, unknown>)[key] as RBXScriptSignal | undefined,
			listener
		);
	}

	/**
	 * Connect to a property-changed signal on the instance.
	 *
	 * @param key - The property name (e.g. `"Position"`, `"Size"`).
	 * @param listener - Callback invoked when the property changes. Pass `undefined` to disconnect.
	 */
	public connectPropertyChange(key: string, listener: Listener | undefined): void {
		let event: RBXScriptSignal;
		try {
			event = (this.instance.GetPropertyChangedSignal as (prop: string) => RBXScriptSignal)(key);
		} catch (e) {
			throw `Cannot get changed signal on property "${key}": ${e}`;
		}
		this.internalConnect(CHANGE_PREFIX + key, event, listener);
	}

	/**
	 * Suspend event processing. New events will be queued instead of
	 * immediately dispat ched to listeners.
	 */
	public suspend(): void {
		this.status = EventStatus.Suspended;
	}

	/**
	 * Resume event processing. All queued events will be dispatched to their
	 * listeners in FIFO order. After the queue is drained the manager enters
	 * the Enabled state.
	 */
	public resume(): void {
		// Guard against re-entrancy
		if (this.isResuming) return;

		this.isResuming = true;

		for (const invocation of this.suspendedEventQueue) {
			const listener = this.listeners.get(invocation.eventKey);
			if (listener === undefined) {
				// Event was disconnected while suspended — drop it.
				continue;
			}

			// Fire the listener inside a coroutine so errors don't crash us.
			const co = coroutine.create(listener);
			const [success, result] = coroutine.resume(co, this.instance, ...invocation.args);

			if (!success) {
				warn(`${result}`);
			}
		}

		this.isResuming = false;
		this.status = EventStatus.Enabled;
		this.suspendedEventQueue = [];
	}

	// Internal helpers

	private internalConnect(
		eventKey: string,
		event: RBXScriptSignal | undefined,
		listener: Listener | undefined
	): void {
		if (listener === undefined) {
			// Disconnect
			const existing = this.connections.get(eventKey);
			if (existing) {
				existing.connection.Disconnect();
				this.connections.delete(eventKey);
			}
			this.listeners.delete(eventKey);
			return;
		}

		if (!this.connections.has(eventKey)) {
			if (!event) {
				throw `Event "${eventKey}" does not exist on Instance "${this.instance.ClassName}"`;
			}

			const connection = event.Connect((...args: unknown[]) => {
				if (this.status === EventStatus.Enabled) {
					const cb = this.listeners.get(eventKey);
					if (cb) cb(this.instance, ...args);
				} else if (this.status === EventStatus.Suspended) {
					this.suspendedEventQueue.push({
						eventKey,
						argumentCount: select('#', ...args) as number,
						args,
					});
				}
			});

			this.connections.set(eventKey, { connection });
		}

		this.listeners.set(eventKey, listener);
	}
}
