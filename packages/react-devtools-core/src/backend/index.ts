/**
 * Backend entry point — wires the DevTools hook to the agent.
 *
 * `initBackend` subscribes to the {@link DevToolsHook} for renderer
 * attachment, unsupported-renderer, operations and trace-update events, and
 * forwards them to the {@link Agent}. It also lazily requires the renderer
 * module so React is not initialised prematurely.
 *
 * Ported from `react-devtools-shared/src/backend/index.js` (React 17).
 *
 * @module backend
 * @packageDocumentation
 */

import type { Agent } from './agent';
import type { DevToolsHook, ReactRenderer, RendererInterface } from './types';
import type { DevToolsAttach } from '../hook';
import * as NativeStyleEditorTypes from './NativeStyleEditor/types';

/** The subset of the renderer module the backend requires lazily. */
export interface RendererModule {
	attach: DevToolsAttach;
}

/** Namespace re-export matching the Lua `NativeStyleEditor.types` shape. */
export namespace NativeStyleEditor {
	export import types = NativeStyleEditorTypes;
}

let cachedRendererModule: RendererModule | undefined;

/**
 * Lazily require the renderer module.
 *
 * The renderer must not be imported statically: doing so would initialise
 * React before the DevTools hook has been installed, which breaks injection.
 */
export function getRendererLazy(): RendererModule {
	if (cachedRendererModule === undefined) {
		// `script.Parent` is the `backend` folder; the compiled `renderer`
		// ModuleScript sits alongside this file.
		const rendererScript = script.Parent!.FindFirstChild('renderer') as ModuleScript;
		cachedRendererModule = require(rendererScript) as RendererModule;
	}

	return cachedRendererModule;
}

/**
 * Attach the DevTools backend to a global hook.
 *
 * @param hook - The hook installed by {@link installHook}.
 * @param agent - The agent that coordinates renderer interfaces.
 * @param global - The global table the reconciler reads from (`_G`).
 * @returns A cleanup function that unsubscribes everything.
 */
export function initBackend(hook: DevToolsHook, agent: Agent, global: Record<string, unknown>): () => void {
	if (hook === undefined) {
		// DevTools didn't get injected into this context (e.g. wrong
		// contentType), so there is nothing to wire up.
		return () => {};
	}

	const subs: Array<() => void> = [];

	const attachRenderer = (id: number, renderer: ReactRenderer): void => {
		// Required lazily so the renderer's own React require doesn't fire
		// before React has initialised.
		const attach = getRendererLazy().attach;

		let rendererInterface = hook.rendererInterfaces.get(id);

		// Inject any not-yet-injected renderers (unless we reload-and-profiled).
		if (rendererInterface === undefined) {
			if (type(renderer.findFiberByHostInstance) === 'function') {
				// react-reconciler v16+
				rendererInterface = attach(hook, id, renderer, global);
			}
			// Older react-dom (v15) and other unsupported renderers are
			// intentionally skipped; there is no Roblox equivalent.

			if (rendererInterface !== undefined) {
				hook.rendererInterfaces.set(id, rendererInterface);
			}
		}

		// Notify the frontend about new renderers, including any that were
		// attached early via __REACT_DEVTOOLS_ATTACH__.
		if (rendererInterface !== undefined) {
			hook.emit('renderer-attached', {
				id,
				renderer,
				rendererInterface,
			});
		} else {
			hook.emit('unsupported-renderer-version', id);
		}
	};

	subs.push(
		hook.sub('renderer-attached', (args: unknown) => {
			const { id, rendererInterface } = args as {
				id: number;
				rendererInterface: RendererInterface;
			};
			agent.setRendererInterface(id, rendererInterface);

			// Now that the agent and the renderer interface are connected,
			// flush the pending operation codes to the frontend.
			rendererInterface.flushInitialOperations();
		}),
		hook.sub('unsupported-renderer-version', (id: unknown) => {
			agent.onUnsupportedRenderer(id as number);
		}),
		hook.sub('operations', (operations: unknown) => {
			agent.onHookOperations(operations as Array<number>);
		}),
		hook.sub('traceUpdates', (nodes: unknown) => {
			agent.onTraceUpdates(nodes as Set<object>);
		})
	);

	// Connect renderers that have already injected themselves.
	hook.renderers.forEach((renderer, id) => {
		attachRenderer(id, renderer);
	});

	// Connect any renderers that inject themselves from now on.
	subs.push(
		hook.sub('renderer', (args: unknown) => {
			const { id, renderer } = args as { id: number; renderer: ReactRenderer };
			attachRenderer(id, renderer);
		})
	);

	hook.emit('react-devtools', agent);
	hook.reactDevtoolsAgent = agent;

	const onAgentShutdown = (): void => {
		for (const fn of subs) {
			fn();
		}
		hook.rendererInterfaces.forEach((rendererInterface) => {
			rendererInterface.cleanup();
		});
		hook.reactDevtoolsAgent = undefined;
	};

	agent.addListener('shutdown', onAgentShutdown);
	subs.push(() => {
		agent.removeListener('shutdown', onAgentShutdown);
	});

	return () => {
		for (const fn of subs) {
			fn();
		}
	};
}
