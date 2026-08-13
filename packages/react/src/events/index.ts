/**
 * Event props translation: `onClick` → `Event={{ Activated: fn }}`.
 *
 * Converts the web-like event API (`onClick`, `onMouseEnter`, etc.) into
 * Roblox's `Event={{ Xxx: fn }}` convention that the reconciler expects.
 *
 * @module events
 * @packageDocumentation
 */

/**
 * Map of `onXxx` prop names → Roblox `Event` key names.
 *
 * Used by `createElement` to translate the web-like event API.
 *
 * @internal
 */
export const EVENT_KEY_MAP: Record<string, string> = {
	onClick: 'Activated',
	onMouseEnter: 'MouseEnter',
	onMouseLeave: 'MouseLeave',
	onMouseButton1Down: 'MouseButton1Down',
	onMouseButton1Up: 'MouseButton1Up',
	onMouseButton2Down: 'MouseButton2Down',
	onMouseButton2Up: 'MouseButton2Up',
	onMouseMoved: 'MouseMoved',
	onMouseWheelForward: 'MouseWheelForward',
	onMouseWheelBackward: 'MouseWheelBackward',
	onInputBegan: 'InputBegan',
	onInputEnded: 'InputEnded',
	onInputChanged: 'InputChanged',
	onTouchTap: 'TouchTap',
	onTouchLongPress: 'TouchLongPress',
	onDragBegin: 'DragBegin',
	onDragMoved: 'DragMoved',
	onDragEnded: 'DragEnded',
	onSelectionGained: 'SelectionGained',
	onSelectionLost: 'SelectionLost',
	onFocused: 'Focused',
	onFocusLost: 'FocusLost',
	onDoubleClick: 'MouseButton1Click',
	onContextAction: 'ContextAction',
};

/**
 * Translates `onXxx` props on an element's config into an `Event` table.
 *
 * Example:
 * ```
 * { onClick: fn, onMouseEnter: fn2 } → { Event: { Activated: fn, MouseEnter: fn2 } }
 * ```
 *
 * @param config - The element's props table (will be mutated).
 * @returns The same config object (mutated in place).
 * @internal
 */
export function translateEventProps(config: Record<string, unknown>): Record<string, unknown> {
	const eventTable: Record<string, unknown> = {};

	for (const [propName, handler] of pairs(config)) {
		const key = propName as string;
		const robloxEventName = EVENT_KEY_MAP[key];

		if (robloxEventName !== undefined) {
			eventTable[robloxEventName] = handler;
			config[key] = undefined;
		}
	}

	// Merge with any existing Event table
	const hasExisting = next(eventTable);
	if (hasExisting !== undefined) {
		const existingEvent = config.Event as Record<string, unknown> | undefined;
		if (existingEvent !== undefined) {
			for (const [k, v] of pairs(eventTable)) {
				const key = k as string;
				if (existingEvent[key] === undefined) {
					existingEvent[key] = v;
				}
			}
		} else {
			config.Event = eventTable;
		}
	}

	return config;
}

/**
 * All `onXxx` event prop names that should be intercepted.
 *
 * @internal
 */
export const EVENT_PROP_NAMES: string[] = [];

for (const [key] of pairs(EVENT_KEY_MAP)) {
	EVENT_PROP_NAMES.push(key);
}
