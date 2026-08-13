/**
 * Error Boundary component and error formatting utilities.
 *
 * Catches errors in the React render tree and displays a readable,
 * developer-friendly error message with source file tracing.
 *
 * @module error-boundary
 * @packageDocumentation
 */

// Types

/**
 * Structured error information for display.
 */
export interface ReactErrorInfo {
	/** The error message. */
	message: string;
	/** The error object thrown. */
	err: unknown;
	/** Stack trace (if available). */
	stack?: string;
	/** Source file where the error originated (best effort). */
	sourceFile?: string;
	/** Line number (best effort). */
	lineNumber?: number;
	/** Component stack trace (which components were rendering). */
	componentStack?: string;
	/** Timestamp of the error. */
	timestamp: number;
}

/**
 * Props for the ErrorBoundary component.
 */
export interface ErrorBoundaryProps {
	/** Child elements to render. */
	children?: unknown;
	/**
	 * Custom fallback UI. Receives the structured error info.
	 */
	fallback?: (errorInfo: ReactErrorInfo) => unknown;
	/**
	 * Called when an error is caught (for logging).
	 */
	onError?: (errorInfo: ReactErrorInfo) => void;
}

// Error parsing utilities

/**
 * Parses a Lua/TypeScript error stack to extract the source file and line.
 *
 * @param errorMessage - The raw error message.
 * @returns Extracted source info, or undefined.
 * @public
 */
export function parseErrorSource(errorMessage: string): { file?: string; line?: number } | undefined {
	const match = string.match(errorMessage, '%[string "(.+)"%]:(%d+):');
	if (match !== undefined && match.size() > 0) {
		return { file: match[0] as string, line: tonumber(match[1] as string) };
	}
	const m2 = string.match(errorMessage, '^(.-):(%d+):');
	if (m2 !== undefined && m2.size() > 0) {
		return { file: m2[0] as string, line: tonumber(m2[1] as string) };
	}
	return undefined;
}

/**
 * Formats an error into a human-readable, developer-friendly message.
 *
 * @param caughtErr - The caught error value.
 * @param componentStack - Optional component tree stack.
 * @returns Structured error information.
 * @public
 */
export function formatReactError(caughtErr: unknown, componentStack?: string): ReactErrorInfo {
	let message: string;
	const errObj = caughtErr as Record<string, unknown>;

	if (type(caughtErr) === 'string') {
		message = caughtErr as string;
	} else if (typeIs(caughtErr, 'Instance')) {
		message = `Roblox Instance error: ${errObj.ClassName}`;
	} else if (type(caughtErr) === 'table') {
		message = (errObj.message as string) ?? (errObj.Message as string) ?? tostring(caughtErr);
	} else {
		message = tostring(caughtErr);
	}

	const source = parseErrorSource(message);

	return {
		message,
		err: caughtErr,
		stack: (errObj.stack as string) ?? (errObj.Stack as string),
		sourceFile: source?.file,
		lineNumber: source?.line,
		componentStack,
		timestamp: os.clock(),
	};
}

// ErrorBoundary — passes children through; error catching via runtime

/**
 * Error boundary wrapper component.
 *
 * In Roblox, true error boundaries use the Lua runtime's `componentDidCatch`
 * lifecycle. For class-based usage, extend `Component` and implement
 * `componentDidCatch` and/or `getDerivedStateFromError`.
 *
 * This function component passes children through directly; the runtime
 * `componentDidCatch` on class components provides the actual boundary.
 *
 * ```tsx
 * // Class-based error boundary (recommended):
 * // In a .tsx file, use Lua-style class construction:
 * // const MyBoundary = Component.extend("MyBoundary")({ ... })
 *
 * // For simple use:
 * <ErrorBoundary>
 *     <App />
 * </ErrorBoundary>
 * ```
 *
 * @param props - ErrorBoundary props.
 * @returns The rendered children.
 * @public
 */
export function ErrorBoundary(props: ErrorBoundaryProps): unknown {
	// In roblox-ts, true error boundaries are implemented via the Lua runtime's
	// Component:extend() with componentDidCatch. This function component simply
	// passes children through.
	return props.children;
}

export default ErrorBoundary;
