/**
 * `Change` generates special prop keys that connect to
 * `GetPropertyChangedSignal`.
 *
 * Index it by a Roblox property name:
 *
 * ```ts
 * createElement("TextBox", {
 *     [Change.Text]: (rbx) => print("Text changed to", rbx.Text),
 * });
 * ```
 *
 * @module PropMarkers/Change
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

const changeMetatable = {
	__tostring: (value: Marker) => string.format('RoactHostChangeEvent(%s)', value.name),
};

const Change = setmetatable(
	{} as Record<string, defined>,
	{
		__index: (tableValue: Record<string, defined>, propertyName: string) => {
			const changeListener = setmetatable({ name: propertyName }, changeMetatable);
			setType(changeListener, typeTable.HostChangeEvent);
			tableValue[propertyName] = changeListener;
			return changeListener;
		},
	} as never
) as Record<string, defined>;

export default Change;
