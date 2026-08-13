/**
 * Retrieves the default value of a property on a Roblox class without keeping
 * a throwaway instance alive.
 *
 * Results are cached per `(className, propertyName)` pair to avoid repeated
 * `Instance.new()` / `Destroy()` roundtrips.
 *
 * @module getDefaultInstanceProperty
 */

// Sentinel value used to distinguish "the default IS nil" from "we haven't
// queried this property yet".  Luau tables treat both as absent, so we need
// a placeholder.
const NIL_SENTINEL = {} as unknown;

/** Per-class cache: className → propertyName → value (or NIL_SENTINEL) */
const cachedPropertyValues = new Map<string, Map<string, unknown>>();

/**
 * Returns the default value of `propertyName` for Roblox class `className`.
 *
 * ```ts
 * const success = getDefaultInstanceProperty("TextLabel", "Text");
 * if (success[0]) {
 *   print(`Default Text = ${success[1]}`);
 * }
 * ```
 *
 * @param className  - The Roblox class name (e.g. `"Frame"`, `"TextLabel"`).
 * @param propertyName - The property to query (e.g. `"BackgroundTransparency"`).
 * @returns `[ok: boolean, value: unknown]` tuple. `ok` is `false` if reading
 *          the property threw an error; `value` is the default property value
 *          (which may be `undefined` for truly nil defaults).
 */
export function getDefaultInstanceProperty(className: string, propertyName: string): LuaTuple<[boolean, unknown]> {
	// Check cache
	let classCache = cachedPropertyValues.get(className);
	if (!classCache) {
		classCache = new Map<string, unknown>();
		cachedPropertyValues.set(className, classCache);
	} else {
		const cachedValue = classCache.get(propertyName);
		if (cachedValue !== undefined) {
			// We have a cached result — was it the "nil" sentinel?
			if (cachedValue === NIL_SENTINEL) {
				return [true, undefined] as LuaTuple<[boolean, unknown]>;
			}
			return [true, cachedValue] as LuaTuple<[boolean, unknown]>;
		}
	}

	// Create a temporary instance, read the property, destroy it
	const instance = new Instance(className as keyof CreatableInstances);
	let ok = false;
	let defaultValue: unknown;

	try {
		defaultValue = (instance as unknown as Record<string, unknown>)[propertyName];
		ok = true;
	} catch {
		ok = false;
	}

	instance.Destroy();

	if (ok) {
		classCache.set(propertyName, defaultValue !== undefined ? defaultValue : NIL_SENTINEL);
	}

	return [ok, defaultValue] as LuaTuple<[boolean, unknown]>;
}
