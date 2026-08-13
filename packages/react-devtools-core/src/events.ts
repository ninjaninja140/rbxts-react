/**
 * A minimal event emitter used by the bridge and agent.
 *
 * Ported from `react-devtools-shared/src/events.js` (React 17).
 *
 * @module events
 * @packageDocumentation
 */

type Listener = (...args: Array<unknown>) => void;

/**
 * A simple synchronous event emitter. Listeners are stored per-event-name in
 * insertion order, and are invoked in order when the event is emitted.
 *
 * Emitting with a single listener avoids cloning the listener list; with
 * multiple listeners each listener is wrapped in `pcall` so that a throwing
 * listener does not prevent the others from running.
 */
export class EventEmitter<_Events extends object = Record<string, never>> {
	private listenersMap = new Map<string, Array<Listener>>();

	/** Register a listener for `event`. */
	public addListener(event: string, listener: Listener): void {
		const listeners = this.listenersMap.get(event);
		if (listeners === undefined) {
			this.listenersMap.set(event, [listener]);
			return;
		}
		if (listeners.indexOf(listener) < 0) {
			listeners.push(listener);
		}
	}

	/** Remove a previously registered listener for `event`. */
	public removeListener(event: string, listener: Listener): void {
		const listeners = this.listenersMap.get(event);
		if (listeners === undefined) {
			return;
		}
		const index = listeners.indexOf(listener);
		if (index >= 0) {
			listeners.remove(index);
		}
	}

	/** Remove every listener for every event. */
	public removeAllListeners(): void {
		this.listenersMap.clear();
	}

	/** Emit `event`, forwarding all remaining arguments to each listener. */
	public emit(event: string, ...args: Array<unknown>): void {
		const listeners = this.listenersMap.get(event);
		if (listeners === undefined) {
			return;
		}
		if (listeners.size() === 1) {
			// Fast path: no cloning or pcall needed for a single listener.
			listeners[0](...args);
			return;
		}

		let didThrow = false;
		let caughtError: unknown;
		const cloned = table.clone(listeners);
		for (const listener of cloned) {
			const [ok, err] = pcall(() => {
				listener(...args);
			});
			if (!ok) {
				didThrow = true;
				caughtError = err;
			}
		}
		if (didThrow) {
			error(tostring(caughtError));
		}
	}
}

export default EventEmitter;
