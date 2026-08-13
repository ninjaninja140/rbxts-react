/**
 * A minimal signal implementation (the `subscribe`/`fire` pair backing Roact
 * bindings).
 *
 * The API is deliberately tiny:
 *
 * ```ts
 * const [subscribe, fire] = createSignal();
 * const disconnect = subscribe((value) => print(value));
 * fire("hello"); // prints "hello"
 * disconnect();
 * ```
 *
 * @module createSignal
 * @internal
 * @packageDocumentation
 */

type Callback = (...args: Array<unknown>) => unknown;

interface Connection {
	callback: Callback;
	disconnected: boolean;
}

/**
 * Creates a signal with a `subscribe`/`fire` pair.
 *
 * Subscriptions registered while the signal is firing are deferred to the next
 * `fire` call, and listeners may only be disconnected once.
 *
 * @internal
 */
function createSignal(): [(callback: Callback) => () => void, (...args: Array<unknown>) => void] {
	const connections = new Map<Callback, Connection>();
	const suspendedConnections = new Map<Callback, Connection>();
	let firing = false;

	function subscribe(callback: Callback): () => void {
		assert(typeOf(callback) === 'function', 'Can only subscribe to signals with a function.');

		const connection: Connection = {
			callback,
			disconnected: false,
		};

		// If the callback is already registered, don't add it to the suspended
		// set; otherwise we would disable the existing connection.
		if (firing && !connections.has(callback)) {
			suspendedConnections.set(callback, connection);
		}

		connections.set(callback, connection);

		return () => {
			assert(!connection.disconnected, 'Listeners can only be disconnected once.');
			connection.disconnected = true;
			connections.delete(callback);
			suspendedConnections.delete(callback);
		};
	}

	function fire(...args: Array<unknown>): void {
		firing = true;
		for (const [callback, connection] of connections) {
			if (!connection.disconnected && !suspendedConnections.has(callback)) {
				callback(...args);
			}
		}
		firing = false;
		suspendedConnections.clear();
	}

	return [subscribe, fire];
}

export default createSignal;
