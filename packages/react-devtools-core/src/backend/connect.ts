/**
 * The DevTools backend entry point.
 *
 * `connectToDevtools` opens a WebSocket connection to a standalone DevTools
 * frontend and wires up the bridge, agent, and global hook. The global hook is
 * installed onto `_G` at module load time (before any renderer injects itself),
 * matching the reconciler's default `ReactGlobals` behavior.
 *
 * Ported from `react-devtools-core/src/backend.js` (React 17).
 *
 * @module backend
 * @packageDocumentation
 */

import { Agent } from './agent';
import { initBackend } from './index';
import { Bridge } from '../bridge';
import { __DEBUG__ } from '../constants';
import { installHook } from '../hook';
import { serializeTable } from '../serializeTable';
import { reportFailedDevtoolsConnection, reportNewDevtoolsConnection } from '../telemetry';
import type { ComponentFilter } from '../types';
import { getDefaultComponentFilters } from '../utils';

// Installs `__REACT_DEVTOOLS_ATTACH__` onto `_G` so renderers that start
// before DevTools connects can still be attached later.
import '../setupAttachHook';

const HttpService = game.GetService('HttpService');

// The global table the reconciler reads from. `_G` is declared as an empty
// interface, so cast it to a string-indexed record to write onto it.
const globalTable = _G as Record<string, unknown>;

/** Options for connecting to a standalone DevTools frontend. */
export interface ConnectOptions {
	/** WebSocket host. Defaults to `"localhost"`. */
	host?: string;
	/** WebSocket port. Defaults to `8097`. */
	port?: number;
	/** Use a secure `wss://` connection. Defaults to `false`. */
	useHttps?: boolean;
	/** Returns whether the app is currently active. Defaults to always true. */
	isAppActive?: () => boolean;
	/** Start profiling as soon as the hook is wired up. */
	profileOnStart?: boolean;
}

// The hook is installed exactly once at module load. If another module already
// installed it (or DevTools was injected into the wrong context), this is
// `undefined` and connecting is a no-op.
const hook = installHook(globalTable);

let savedComponentFilters: Array<ComponentFilter> = getDefaultComponentFilters();

function debugPrint(methodName: string, ...args: Array<unknown>): void {
	if (__DEBUG__) {
		print(`[core/backend] ${methodName}`, ...args);
	}
}

/** A single incoming-message listener registered by the bridge. */
type MessageListener = (message: { event: string; payload: unknown }) => void;

/**
 * Connect to a standalone DevTools frontend over WebSocket.
 *
 * On failure (inactive app, connection refused, or socket closed) the backend
 * schedules a retry in 2 seconds, mirroring the upstream behavior.
 */
export function connectToDevtools(options: ConnectOptions = {}): void {
	if (hook === undefined) {
		// DevTools wasn't injected into this context.
		return;
	}

	const host = options.host ?? 'localhost';
	const useHttps = options.useHttps ?? false;
	const port = options.port ?? 8097;
	const isAppActive = options.isAppActive ?? (() => true);

	const protocol = useHttps ? 'wss' : 'ws';
	const uri = `${protocol}://${host}:${port}`;

	let retryTimeoutThread: thread | undefined;

	const scheduleRetry = (): void => {
		if (retryTimeoutThread === undefined) {
			retryTimeoutThread = task.delay(2, () => {
				retryTimeoutThread = undefined;
				connectToDevtools(options);
			});
		}
	};

	if (!isAppActive()) {
		scheduleRetry();
		return;
	}

	let bridge: Bridge | undefined;
	let agent: Agent | undefined;

	const messageListeners: MessageListener[] = [];

	const handleClose = (): void => {
		debugPrint("Socket.on('close')");

		if (bridge !== undefined) {
			bridge.shutdown();
		}

		reportFailedDevtoolsConnection('socket_closed');
		scheduleRetry();
	};

	const handleMessage = (event: string): void => {
		const [success, data] = pcall(() => {
			const decoded = HttpService.JSONDecode(event);
			debugPrint("Socket.on('message')", decoded);
			return decoded;
		});

		if (!success) {
			error(`[React DevTools] Failed to parse JSON: ${event} (got error: ${tostring(data)})`);
		}

		for (const fn of messageListeners) {
			const [ok, result] = pcall(() => {
				fn(data as { event: string; payload: unknown });
			});

			if (!ok) {
				error(`[React DevTools] Error calling listener with data: ${tostring(data)}\n${tostring(result)}`);
			}
		}
	};

	const [connected, socketResult] = pcall(() => {
		// The upstream flag for the newer WebStream API is a fast flag that
		// always evaluates to `false` for a public package, so only the legacy
		// WebSocket path is kept.
		const WebSocketService = game.GetService('WebSocketService');
		return WebSocketService.CreateClient(uri);
	});

	if (!connected) {
		warn(
			`[React DevTools] Could not connect to DevTools. Attempted to connect to "${uri}" (${tostring(socketResult)})`
		);
		reportFailedDevtoolsConnection('create_client_failed');
		scheduleRetry();
		return;
	}

	const socket = socketResult as WebSocketClient;

	socket.Closed.Connect(handleClose);
	socket.MessageReceived.Connect(handleMessage);
	socket.Opened.Connect(() => {
		bridge = new Bridge({
			listen: (listener) => {
				messageListeners.push(listener);
				return () => {
					const index = messageListeners.indexOf(listener);
					if (index !== -1) {
						messageListeners.remove(index);
					}
				};
			},
			send: (event, payload) => {
				if (socket.ConnectionState === Enum.WebSocketState.Open) {
					debugPrint('wall.send()', event, payload);

					const serialized = serializeTable(payload as Record<string, unknown>) as {
						type?: unknown;
						value?: Record<string, unknown>;
					};

					// Upstream fills absent full-data fields with an
					// "encode to null" sentinel so the frontend can tell "no
					// data" apart from "empty data". Our serializer drops nil
					// keys, which is the closest Roblox equivalent, so nothing
					// further is required here beyond preserving the shape.
					if (event === 'inspectedElement' && serialized.type === 'full-data') {
						const value = serialized.value ?? {};
						const defaults = [
							'displayName',
							'context',
							'hooks',
							'props',
							'state',
							'key',
							'owners',
							'source',
							'rootType',
							'rendererPackageName',
							'rendererVersion',
						];
						for (const key of defaults) {
							if (value[key] === undefined) {
								value[key] = undefined;
							}
						}
					}

					socket.Send(
						HttpService.JSONEncode({
							event,
							payload: serialized,
						})
					);
				} else {
					debugPrint('wall.send()', 'Shutting down bridge because of closed WebSocket connection');

					if (bridge !== undefined) {
						bridge.shutdown();
					}

					scheduleRetry();
				}
			},
		});

		bridge.addListener('inspectElement', (data: unknown) => {
			const { id, rendererID } = data as { id: number; rendererID: number };

			if (agent !== undefined) {
				const renderer = agent._rendererInterfaces[rendererID];
				if (renderer !== undefined) {
					const nodes = renderer.findNativeNodesForFiberID(id);
					if (nodes !== undefined && !nodes.isEmpty()) {
						const node = nodes[0];
						agent.emit('showNativeHighlight', node);
					}
				}
			}
		});

		bridge.addListener('updateComponentFilters', (componentFilters: unknown) => {
			// Save filter changes in memory, in case DevTools is reloaded. The
			// renderer will already be using the updated values.
			savedComponentFilters = componentFilters as Array<ComponentFilter>;
		});

		// The renderer interface relies on the frontend passing filters, but
		// the standalone DevTools backend persists its own copy. Only inject
		// ours when the host hasn't supplied its own.
		if (globalTable.__REACT_DEVTOOLS_COMPONENT_FILTERS__ === undefined) {
			bridge.send('overrideComponentFilters', savedComponentFilters);
		}

		agent = new Agent(bridge);
		agent.addListener('shutdown', () => {
			// The `shutdown` event on the agent means the bridge is already
			// shutting down, so we don't need to call bridge.shutdown() here.
			hook.emit('shutdown', undefined);
		});

		initBackend(hook, agent, globalTable);

		reportNewDevtoolsConnection();

		if (options.profileOnStart) {
			agent.startProfiling();
		}
	});
}

export default connectToDevtools;
