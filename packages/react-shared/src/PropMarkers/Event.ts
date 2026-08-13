/**
 * Index into `Event` to obtain a prop key for attaching to a Roblox Instance
 * event.
 *
 * ```ts
 * createElement("TextButton", {
 *     Text: "Hello, world!",
 *     [Event.MouseButton1Click]: (rbx) => print("Clicked", rbx),
 * });
 * ```
 *
 * @module PropMarkers/Event
 * @internal
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

import { Type, setType } from '../Type';

type TypeTable = { HostEvent: defined; HostChangeEvent: defined };
const typeTable = Type as unknown as TypeTable;

interface Marker {
	name: string;
}

const eventMetatable = {
	__tostring: (value: Marker) => string.format('RoactHostEvent(%s)', value.name),
};

const Event = setmetatable(
	{} as Record<string, defined>,
	{
		__index: (tableValue: Record<string, defined>, eventName: string) => {
			const eventListener = setmetatable({ name: eventName }, eventMetatable);
			setType(eventListener, typeTable.HostEvent);
			tableValue[eventName] = eventListener;
			return eventListener;
		},
	} as never
) as Record<string, defined>;

export default Event;
