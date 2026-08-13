/**
 * Custom form system for @nrbx/react.
 *
 * Provides a `useForm` hook with field registration, validation,
 * dirty tracking, and error display — similar to React Hook Form
 * but built specifically for Roblox UI.
 *
 * ## Usage
 *
 * ```tsx
 * import { useForm } from "@nrbx/react";
 *
 * function LoginForm() {
 *     const { register, handleSubmit, errors, isSubmitting } = useForm<{
 *         username: string;
 *         password: string;
 *     }>({
 *         defaultValues: { username: "", password: "" },
 *         validate: (values) => {
 *             const errs: Record<string, string> = {};
 *             if (values.username.size() === 0) errs.username = "Username is required";
 *             if (values.password.size() < 3) errs.password = "Min 3 characters";
 *             return errs;
 *         },
 *         onSubmit: (values) => {
 *             print(`Logging in as ${values.username}`);
 *         },
 *     });
 *
 *     return (
 *         <frame>
 *             <textbox {...register("username")} PlaceholderText="Username" />
 *             {errors.username && <textlabel Text={errors.username} />}
 *
 *             <textbox {...register("password")} PlaceholderText="Password" />
 *             {errors.password && <textlabel Text={errors.password} />}
 *
 *             <textbutton Text={isSubmitting ? "..." : "Submit"}
 *                 Event={{ Activated: handleSubmit }} />
 *         </frame>
 *     );
 * }
 * ```
 *
 * @module forms
 * @packageDocumentation
 */

import { useState, useCallback, useRef } from '../index';

// Simple ref type (not exported from main React package)
interface MutableRefObject<T> {
	current: T;
}

// Types

/**
 * Configuration options for the `useForm` hook.
 *
 * @typeParam T - The shape of the form values.
 * @public
 */
export interface UseFormConfig<T extends Record<string, unknown>> {
	/**
	 * Initial form values.
	 *
	 * ```ts
	 * defaultValues: { username: "", password: "", rememberMe: false }
	 * ```
	 */
	defaultValues: T;

	/**
	 * Synchronous validation function.
	 *
	 * Return an empty object or undefined for no errors.
	 * Key names should match field names.
	 *
	 * ```ts
	 * validate: (values) => {
	 *     const errors: Record<string, string> = {};
	 *     if (!values.email) errors.email = "Required";
	 *     return errors;
	 * }
	 * ```
	 */
	validate?: (values: T) => Partial<Record<keyof T, string>> | undefined;

	/**
	 * Called when the form is submitted and passes validation.
	 */
	onSubmit?: (values: T) => void;

	/**
	 * Called when the form is submitted but fails validation.
	 */
	onInvalid?: (errors: Partial<Record<keyof T, string>>) => void;
}

/**
 * Return value from the `useForm` hook.
 *
 * @typeParam T - The shape of the form values.
 * @public
 */
export interface UseFormReturn<T extends Record<string, unknown>> {
	/**
	 * Register a field. Spread the result onto your input element.
	 *
	 * ```tsx
	 * <textbox {...register("username")} />
	 * ```
	 */
	register: (name: keyof T & string) => {
		Text: string;
		Event: {
			FocusLost: (rbx: unknown) => void;
		};
		[key: string]: unknown;
	};

	/**
	 * Submit handler. Pass to a button's `Event.Activated` or call directly.
	 */
	handleSubmit: () => void;

	/**
	 * Current form values.
	 */
	values: T;

	/**
	 * Validation errors, keyed by field name.
	 */
	errors: Partial<Record<keyof T, string>>;

	/**
	 * Whether any field has been modified from its default.
	 */
	isDirty: boolean;

	/**
	 * Whether the form is currently submitting.
	 */
	isSubmitting: boolean;

	/**
	 * Whether the form has been attempted to submit at least once.
	 */
	submitCount: number;

	/**
	 * Reset the form to its default values.
	 */
	reset: () => void;

	/**
	 * Reset the form to specific values.
	 */
	resetTo: (newValues: T) => void;

	/**
	 * Set the value of a specific field.
	 */
	setValue: (name: keyof T & string, value: unknown) => void;

	/**
	 * Set the error for a specific field.
	 */
	setError: (name: keyof T & string, error: string) => void;

	/**
	 * Clear all errors.
	 */
	clearErrors: () => void;

	/**
	 * Trigger validation for all fields.
	 */
	trigger: () => boolean;
}

/**
 * Options for individual field registration.
 *
 * @public
 */
export interface RegisterOptions {
	/**
	 * Validation function for this specific field.
	 */
	validate?: (value: unknown) => string | undefined;

	/**
	 * Called when the field value changes.
	 */
	onChange?: (value: unknown) => void;
}

// Internal helpers

function deepEqual(a: unknown, b: unknown): boolean {
	if (type(a) !== 'table' || type(b) !== 'table') {
		return a === b;
	}
	const aTbl = a as Record<string, unknown>;
	const bTbl = b as Record<string, unknown>;
	for (const [k] of pairs(aTbl as Record<string, unknown>)) {
		if (!deepEqual(aTbl[k], bTbl[k])) return false;
	}
	for (const [k] of pairs(bTbl as Record<string, unknown>)) {
		if (aTbl[k] === undefined && bTbl[k] !== undefined) return false;
	}
	return true;
}

// useForm hook

/**
 * Custom form hook with field registration, validation, dirty tracking,
 * and submission handling.
 *
 * ```tsx
 * const form = useForm({
 *     defaultValues: { name: "" },
 *     validate: (v) => ({ name: v.name ? undefined : "Required" }),
 *     onSubmit: (v) => print(v.name),
 * });
 *
 * return (
 *     <frame>
 *         <textbox {...form.register("name")} />
 *         {form.errors.name && <textlabel Text={form.errors.name} />}
 *         <textbutton Text="Submit" Event={{ Activated: form.handleSubmit }} />
 *     </frame>
 * );
 * ```
 *
 * @typeParam T - The shape of the form values.
 * @param config - Form configuration.
 * @returns Form control object.
 * @public
 */
export function useForm<T extends Record<string, unknown>>(config: UseFormConfig<T>): UseFormReturn<T> {
	const { defaultValues, validate, onSubmit, onInvalid } = config;

	const [values, setValues] = useState(defaultValues) as unknown as [T, (v: T) => void];

	const [errors, setErrors] = useState({} as Partial<Record<keyof T, string>>) as unknown as [
		Partial<Record<keyof T, string>>,
		(v: Partial<Record<keyof T, string>>) => void,
	];

	const [isDirty, setIsDirty] = useState(false) as unknown as [boolean, (v: boolean) => void];

	const [isSubmitting, setIsSubmitting] = useState(false) as unknown as [boolean, (v: boolean) => void];

	const [submitCount, setSubmitCount] = useState(0) as unknown as [number, (v: number) => void];

	const touchedRef = useRef(new Set<string>()) as MutableRefObject<Set<string>>;

	/**
	 * Run validation and set errors.
	 */
	const runValidation = useCallback(
		(currentValues: T): boolean => {
			if (!validate) {
				setErrors({});
				return true;
			}
			// Only validate touched fields
			const allErrors: Partial<Record<keyof T, string>> = {};
			const result = validate(currentValues);
			if (result) {
				for (const [fieldName] of pairs(result as Record<string, unknown>)) {
					if (touchedRef.current.has(fieldName)) {
						allErrors[fieldName as keyof T] = result[fieldName] as string;
					}
				}
			}
			setErrors(allErrors);
			return (next(allErrors as unknown as Record<string, unknown>) as unknown[]).size() === 0;
		},
		[validate]
	);

	/**
	 * Trigger full validation (touching all fields).
	 */
	const trigger = useCallback((): boolean => {
		if (!validate) {
			setErrors({});
			return true;
		}
		const result = validate(values);
		if (result) {
			setErrors(result);
			return (next(result as unknown as Record<string, unknown>) as unknown[]).size() === 0;
		}
		setErrors({});
		return true;
	}, [validate, values]);

	/**
	 * Handle form submission.
	 */
	const handleSubmit = useCallback(() => {
		setSubmitCount(submitCount + 1);
		const allErrors: Partial<Record<keyof T, string>> = {};
		if (validate) {
			const result = validate(values);
			if (result) {
				for (const [fieldName] of pairs(result as Record<string, unknown>)) {
					allErrors[fieldName as keyof T] = result[fieldName] as string;
				}
			}
		}
		const hasErrors = (next(allErrors as unknown as Record<string, unknown>) as unknown[]).size() > 0;
		setErrors(allErrors);

		if (hasErrors) {
			if (onInvalid) onInvalid(allErrors);
			return;
		}

		setIsSubmitting(true);
		if (onSubmit) {
			onSubmit(values);
		}
		setIsSubmitting(false);
	}, [validate, values, onSubmit, onInvalid]);

	/**
	 * Reset form to defaults.
	 */
	const reset = useCallback(() => {
		setValues(defaultValues);
		setErrors({});
		setIsDirty(false);
		setIsSubmitting(false);
		setSubmitCount(0);
		touchedRef.current = new Set<string>();
	}, [defaultValues]);

	/**
	 * Reset form to specific values.
	 */
	const resetTo = useCallback((newValues: T) => {
		setValues(newValues);
		setErrors({});
		setIsDirty(false);
		setIsSubmitting(false);
		setSubmitCount(0);
		touchedRef.current = new Set<string>();
	}, []);

	/**
	 * Set value of a single field.
	 */
	const setValue = useCallback(
		(name: keyof T & string, value: unknown) => {
			const newValues = { ...(values as Record<string, unknown>), [name]: value } as T;
			setValues(newValues);
			if (!deepEqual(newValues[name], defaultValues[name])) {
				setIsDirty(true);
			}
		},
		[values, defaultValues]
	);

	/**
	 * Set error for a single field.
	 */
	const setError = useCallback(
		(name: keyof T & string, errMsg: string) => {
			setErrors({ ...(errors as Record<string, unknown>), [name]: errMsg } as Partial<Record<keyof T, string>>);
		},
		[errors]
	);

	/**
	 * Clear all errors.
	 */
	const clearErrors = useCallback(() => {
		setErrors({});
	}, []);

	/**
	 * Register a field. Returns props to spread onto the input element.
	 */
	const register = useCallback(
		(name: keyof T & string) => {
			return {
				Text: tostring(values[name] ?? ''),
				[name]: values[name],
				Event: {
					FocusLost: (_rbx: unknown) => {
						touchedRef.current.add(name);
						runValidation(values);
					},
				},
				Change: {
					[name]: (rbx: unknown) => {
						const textBox = rbx as Record<string, unknown>;
						const newValue = textBox.Text as string;
						setValue(name, newValue);
					},
				},
			};
		},
		[values, setValue, runValidation]
	);

	return {
		register,
		handleSubmit,
		values,
		errors,
		isDirty,
		isSubmitting,
		submitCount,
		reset,
		resetTo,
		setValue,
		setError,
		clearErrors,
		trigger,
	};
}

export default useForm;
