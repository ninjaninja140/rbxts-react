/**
 * DevTools telemetry shims.
 *
 * The upstream implementation logs counters through Roblox's internal
 * `TelemetryService`, which is unavailable to public packages. These shims
 * preserve the call sites while remaining no-ops.
 *
 * @module telemetry
 * @packageDocumentation
 */

/** Context in which the telemetry events would run. */
export type Context = 'universal_app' | 'in_experience' | 'plugin' | 'unknown';

export interface CustomFields {
	context: Context;
	plugin_name?: string;
}

export const customFields: CustomFields = {
	context: 'unknown',
	plugin_name: undefined,
};

/** No-op — reports a successful DevTools connection. */
export function reportNewDevtoolsConnection(): void {}

/** No-op — reports a failed DevTools connection with an error type. */
export function reportFailedDevtoolsConnection(_type: 'create_client_failed' | 'socket_closed'): void {}
