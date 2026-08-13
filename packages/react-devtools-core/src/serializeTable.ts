/**
 * Serializes arbitrary Roblox values into a JSON-encodable table.
 *
 * Roblox datatypes (UDim, Vector3, CFrame, Color3, etc.) cannot be passed to
 * `HttpService:JSONEncode` directly, so each one is converted to a readable
 * string before the final payload is encoded. Cyclic references are broken by
 * tracking visited tables.
 *
 * Ported from `react-devtools-core/src/utils/serializeTable.lua` (React 17).
 *
 * @module serializeTable
 * @packageDocumentation
 */

const HttpService = game.GetService('HttpService');

/**
 * Recursively converts `parent` into a JSON-safe value.
 *
 * The value returned by this function is a plain table/array tree containing
 * only strings, numbers, booleans, and nil — everything else has been
 * stringified.
 */
function visitPropsRecursive(parent: unknown, seen: Set<object>): unknown {
	if (type(parent) !== 'table') {
		return parent;
	}

	// Break cyclic references.
	if (seen.has(parent as object)) {
		return undefined;
	}
	seen.add(parent as object);

	const newParent: Record<string, unknown> = {};
	for (const [key, value] of pairs(parent as object)) {
		const name = tostring(key);

		if (type(value) === 'table') {
			newParent[name] = visitPropsRecursive(value, seen);
		} else if (typeIs(value, 'UDim')) {
			newParent[name] = `UDim(${value.Scale}, ${value.Offset})`;
		} else if (typeIs(value, 'UDim2')) {
			newParent[name] = `UDim2(${value.X.Scale}, ${value.X.Offset}, ${value.Y.Scale}, ${value.Y.Offset})`;
		} else if (typeIs(value, 'Vector2')) {
			newParent[name] = `Vector2(${value.X}, ${value.Y})`;
		} else if (typeIs(value, 'Vector3')) {
			newParent[name] = `Vector3(${value.X}, ${value.Y}, ${value.Z})`;
		} else if (typeIs(value, 'CFrame')) {
			newParent[name] = `CFrame(${tostring(value)})`;
		} else if (typeIs(value, 'Color3')) {
			newParent[name] = `Color3(${value.R}, ${value.G}, ${value.B})`;
		} else if (typeIs(value, 'Rect')) {
			newParent[name] = `Rect(${value.Min.X}, ${value.Min.Y}, ${value.Max.X}, ${value.Max.Y})`;
		} else if (typeIs(value, 'EnumItem')) {
			newParent[name] = `EnumItem(${value.EnumType}, ${value.Name})`;
		} else if (typeIs(value, 'Instance')) {
			newParent[name] = `Instance(${value.GetFullName()})`;
		} else if (typeIs(value, 'BrickColor')) {
			newParent[name] = `BrickColor(${value.Name})`;
		} else if (typeIs(value, 'NumberRange')) {
			newParent[name] = `NumberRange(${value.Min}, ${value.Max})`;
		} else if (typeIs(value, 'NumberSequence')) {
			const keypoints: string[] = [];
			for (const kp of value.Keypoints) {
				keypoints.push(`NumberSequenceKeypoint(${kp.Time}, ${kp.Value}, ${kp.Envelope})`);
			}
			newParent[name] = `NumberSequence(${keypoints.join(', ')})`;
		} else if (typeIs(value, 'ColorSequence')) {
			const keypoints: string[] = [];
			for (const kp of value.Keypoints) {
				keypoints.push(`ColorSequenceKeypoint(${kp.Time}, ${kp.Value.R}, ${kp.Value.G}, ${kp.Value.B})`);
			}
			newParent[name] = `ColorSequence(${keypoints.join(', ')})`;
		} else if (typeIs(value, 'PhysicalProperties')) {
			newParent[name] =
				`PhysicalProperties(${value.Density}, ${value.Friction}, ${value.Elasticity}, ${value.FrictionWeight}, ${value.ElasticityWeight})`;
		} else if (typeIs(value, 'Vector2int16')) {
			newParent[name] = `Vector2int16(${value.X}, ${value.Y})`;
		} else if (typeIs(value, 'Vector3int16')) {
			newParent[name] = `Vector3int16(${value.X}, ${value.Y}, ${value.Z})`;
		} else if (typeIs(value, 'PathWaypoint')) {
			newParent[name] =
				`PathWaypoint(${value.Position.X}, ${value.Position.Y}, ${value.Position.Z}, ${value.Action})`;
		} else if (typeIs(value, 'OverlapParams')) {
			newParent[name] =
				`OverlapParams(${value.FilterDescendantsInstances}, ${value.FilterType}, ${value.MaxParts}, ${value.CollisionGroup})`;
		} else if (typeIs(value, 'RaycastParams')) {
			newParent[name] =
				`RaycastParams(${value.FilterDescendantsInstances}, ${value.FilterType}, ${value.IgnoreWater}, ${value.CollisionGroup})`;
		} else {
			const [canSerialize] = pcall(() => HttpService.JSONEncode({ value }));
			if (canSerialize) {
				newParent[name] = value;
			} else {
				warn(`[React DevTools] Could not serialize value for key "${name}" (type '${typeOf(value)}'):`, value);
				// Deviation: upstream uses a `newproxy()` sentinel that encodes
				// to null. On Roblox a nil value simply drops the key from the
				// resulting JSON object.
				newParent[name] = undefined;
			}
		}
	}

	return newParent;
}

/**
 * Serializes `tbl` so it can be encoded as JSON via `HttpService:JSONEncode`.
 */
export function serializeTable(tbl: Record<string, unknown>): unknown {
	return visitPropsRecursive(tbl, new Set<object>());
}

export default serializeTable;
