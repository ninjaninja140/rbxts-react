/**
 * Global JSX namespace augmentation for `@nrbx/react`.
 *
 * This declaration file extends the JSX namespace to support both
 * native Roblox instance elements and HTML element aliases
 * (`div`, `span`, `h1`, `button`, etc.).
 *
 * The `CreatableInstances` interface is populated at compile time by
 * roblox-ts — each key maps to the properties of a Roblox class
 * (e.g., `CreatableInstances["Frame"]` has `Size`, `Position`, etc.).
 *
 * ## Event Props
 *
 * Events are exposed as top-level `onXxx` props instead of the legacy
 * `Event={{ Xxx: fn }}` pattern:
 *
 * ```tsx
 * <textbutton onClick={() => print("clicked!")} />
 * <frame onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} />
 * <textbox onChange={{ Text: (rbx) => print(rbx.Text) }} />
 * ```
 *
 * @module jsx
 * @packageDocumentation
 */

/// <reference types="@rbxts/types" />

declare namespace JSX {
	// Element types

	/** A React element. */
	type Element = unknown;
	/** The type of a React element (string or component). */
	interface ElementClass {
		render(): unknown;
	}
	/** Attributes object for JSX elements. */
	interface ElementAttributesProperty {
		props: Record<string, unknown>;
	}
	/** Children property name. */
	interface ElementChildrenAttribute {
		children: Record<string, unknown>;
	}

	// CSS-like Event Props (onClick, onHover, etc.)

	/**
	 * Common interactive event handlers available on every Roblox GUI element.
	 *
	 * These are the "web-like" event names — `onClick`, `onMouseEnter`,
	 * `onMouseLeave`, etc. At runtime they're translated back into the
	 * `Event={{ ... }}` table the Roblox reconciler expects.
	 *
	 * Each handler receives the Roblox instance as its argument, matching
	 * the `(rbx: GuiObject) => void` convention.
	 */
	interface CommonEventHandlers<T extends Instance = GuiObject> {
		/** Fires when the user clicks the element (MouseButton1Click, or Activated for buttons). */
		onClick?: (rbx: T) => void;
		/** Fires when the mouse enters the element. */
		onMouseEnter?: (rbx: T) => void;
		/** Fires when the mouse leaves the element. */
		onMouseLeave?: (rbx: T) => void;
		/** Fires on left-click down. */
		onMouseButton1Down?: (rbx: T) => void;
		/** Fires on left-click up. */
		onMouseButton1Up?: (rbx: T) => void;
		/** Fires on right-click down. */
		onMouseButton2Down?: (rbx: T) => void;
		/** Fires on right-click up. */
		onMouseButton2Up?: (rbx: T) => void;
		/** Fires when the mouse moves within the element. */
		onMouseMoved?: (rbx: T, x: number, y: number) => void;
		/** Fires when the mouse wheel is scrolled on the element. */
		onMouseWheelForward?: (rbx: T) => void;
		/** Fires when the mouse wheel is scrolled backward on the element. */
		onMouseWheelBackward?: (rbx: T) => void;
		/** Fires when the element gains input focus. */
		onInputBegan?: (rbx: T, input: InputObject) => void;
		/** Fires when the element loses input focus. */
		onInputEnded?: (rbx: T, input: InputObject) => void;
		/** Fires when input changes (e.g., gamepad axis). */
		onInputChanged?: (rbx: T, input: InputObject) => void;
		/** Fires on touch tap (mobile). */
		onTouchTap?: (rbx: T, input: InputObject) => void;
		/** Fires on touch long press (mobile). */
		onTouchLongPress?: (rbx: T, input: InputObject) => void;
		/** Fires when a drag begins on this element. */
		onDragBegin?: (rbx: T, position: Vector2) => void;
		/** Fires when a drag moves on this element. */
		onDragMoved?: (rbx: T, position: Vector2) => void;
		/** Fires when a drag ends on this element. */
		onDragEnded?: (rbx: T) => void;
		/** Fires on selection gain (for text-capable elements). */
		onSelectionGained?: (rbx: T) => void;
		/** Fires on selection loss (for text-capable elements). */
		onSelectionLost?: (rbx: T) => void;
		/** Fires when focused (for TextBox/TextButton). */
		onFocused?: (rbx: T) => void;
		/** Fires when focus is lost (for TextBox/TextButton). */
		onFocusLost?: (rbx: T) => void;
		/** Fires when the element is double-clicked. */
		onDoubleClick?: (rbx: T) => void;
		/** Fires on a right-click context action. */
		onContextAction?: (
			rbx: T,
			actionName: string,
			inputState: Enum.UserInputState,
			inputObject: InputObject
		) => void;
	}

	// Event name mapping (onXxx → Roblox event name)

	/**
	 * Maps `onClick`-style event names to their Roblox `Event` key.
	 *
	 * Used internally by `createElement` to translate the web-like
	 * event API into Roblox's `Event={{ Xxx: fn }}` convention.
	 *
	 * @internal
	 */
	/**
	 * Maps a Roblox class name to the set of event names it exposes
	 * (`RBXScriptSignal` properties) along with typed handler signatures.
	 *
	 * The handler receives the instance as its first argument, followed by
	 * any arguments the signal fires with.
	 */
	type InstanceEventNames<T extends keyof CreatableInstances> = {
		[K in keyof CreatableInstances[T] as CreatableInstances[T][K] extends RBXScriptSignal
			? K
			: never]: CreatableInstances[T][K] extends RBXScriptSignal<infer C>
			? (rbx: CreatableInstances[T], ...args: Parameters<C>) => void
			: never;
	};

	/**
	 * Maps a Roblox class name to the set of property-changed signal names.
	 *
	 * The handler receives the instance as its only argument, matching the
	 * legacy `Change={{ Text: (rbx) => ... }}` convention.
	 */
	type InstanceChangeEventNames<T extends keyof CreatableInstances> = {
		[K in keyof CreatableInstances[T] as CreatableInstances[T][K] extends RBXScriptSignal | Callback ? never : K]: (
			rbx: CreatableInstances[T]
		) => void;
	};

	type EventNameMap = {
		onClick: 'Activated';
		onMouseEnter: 'MouseEnter';
		onMouseLeave: 'MouseLeave';
		onMouseButton1Down: 'MouseButton1Down';
		onMouseButton1Up: 'MouseButton1Up';
		onMouseButton2Down: 'MouseButton2Down';
		onMouseButton2Up: 'MouseButton2Up';
		onMouseMoved: 'MouseMoved';
		onMouseWheelForward: 'MouseWheelForward';
		onMouseWheelBackward: 'MouseWheelBackward';
		onInputBegan: 'InputBegan';
		onInputEnded: 'InputEnded';
		onInputChanged: 'InputChanged';
		onTouchTap: 'TouchTap';
		onTouchLongPress: 'TouchLongPress';
		onDragBegin: 'DragBegin';
		onDragMoved: 'DragMoved';
		onDragEnded: 'DragEnded';
		onSelectionGained: 'SelectionGained';
		onSelectionLost: 'SelectionLost';
		onFocused: 'Focused';
		onFocusLost: 'FocusLost';
		onDoubleClick: 'MouseButton1Click';
		onContextAction: 'ContextAction';
	};

	// Base Roblox intrinsic elements

	/**
	 * Base type for native Roblox instance JSX elements.
	 *
	 * Each key is a Roblox class name (e.g., `"Frame"`, `"TextLabel"`).
	 *
	 * **Event props** (`onClick`, `onMouseEnter`, etc.) are available on
	 * every element as top-level props. When you use them, they are
	 * automatically translated into the `Event={{ ... }}` format at runtime.
	 *
	 * **Legacy `Event`/`Change`/`Tag`** are still supported for
	 * backward-compatibility but the `onXxx` style is preferred.
	 */
	type RobloxIntrinsicElements = {
		[K in keyof CreatableInstances]: Partial<CreatableInstances[K]> &
			CommonEventHandlers<CreatableInstances[K] & GuiObject> & {
				/** [Legacy] Roblox events table (e.g., `Event={{ Activated: fn }}`). Prefer `onClick` etc. */
				Event?: Partial<InstanceEventNames<K>>;
				/** [Legacy] Change events (e.g., `Change={{ Text: (rbx) => {} }}`). */
				Change?: Partial<InstanceChangeEventNames<K>>;
				/** Tailwind class names. */
				className?: string;
				/** React `key` for list reconciliation. */
				key?: string | number;
				/** React `ref` for instance reference. */
				ref?: { current?: CreatableInstances[K] } | ((instance: CreatableInstances[K]) => void);
				/**
				 * **[Experimental]** When `true`, the user can drag this element
				 * freely within its parent container. Disabled by default.
				 */
				draggable?: boolean;
				/**
				 * **[Experimental]** When `true`, the user can resize this
				 * element by tugging on a corner. The element is clamped to its
				 * parent container and cannot grow larger than it. Disabled by
				 * default.
				 */
				resizable?: boolean;
			};
	};

	// HTML element helpers — maps HTML tags to their Roblox class

	/**
	 * Maps an HTML tag name to the underlying Roblox class's property type.
	 *
	 * Example: `HTMLToRobloxProps<"div">` resolves to `Frame`'s properties
	 * because `"div"` maps to `"Frame"`.
	 */
	type HTMLToRobloxProps<Tag extends keyof HTMLElementClassMap> =
		HTMLElementClassMap[Tag] extends keyof CreatableInstances
			? Partial<CreatableInstances[HTMLElementClassMap[Tag]]>
			: Record<string, any>;

	/**
	 * Event types for an HTML element, based on its underlying Roblox class.
	 */
	type HTMLElementEvents<Tag extends keyof HTMLElementClassMap> =
		HTMLElementClassMap[Tag] extends keyof CreatableInstances
			? Partial<InstanceEventNames<HTMLElementClassMap[Tag]>>
			: Record<string, any>;

	/**
	 * Change-event types for an HTML element.
	 */
	type HTMLElementChangeEvents<Tag extends keyof HTMLElementClassMap> =
		HTMLElementClassMap[Tag] extends keyof CreatableInstances
			? Partial<InstanceChangeEventNames<HTMLElementClassMap[Tag]>>
			: Record<string, any>;

	/**
	 * Full JSX props type for an HTML element.
	 */
	type HTMLIntrinsicElement<Tag extends keyof HTMLElementClassMap> = HTMLToRobloxProps<Tag> & {
		/** [Legacy] Roblox events table. Prefer `onClick` etc. */
		Event?: HTMLElementEvents<Tag>;
		/** [Legacy] Change events. */
		Change?: HTMLElementChangeEvents<Tag>;
		className?: string;
		key?: string | number;
		ref?:
			| {
					current?: HTMLElementClassMap[Tag] extends keyof CreatableInstances
						? CreatableInstances[HTMLElementClassMap[Tag]]
						: Instance;
			  }
			| ((
					instance: HTMLElementClassMap[Tag] extends keyof CreatableInstances
						? CreatableInstances[HTMLElementClassMap[Tag]]
						: Instance
			  ) => void);
		/**
		 * **[Experimental]** When `true`, the user can drag this element
		 * freely within its parent container. Disabled by default.
		 */
		draggable?: boolean;
		/**
		 * **[Experimental]** When `true`, the user can resize this element
		 * by tugging on a corner. The element is clamped to its parent
		 * container and cannot grow larger than it. Disabled by default.
		 */
		resizable?: boolean;
	} & CommonEventHandlers<
			HTMLElementClassMap[Tag] extends keyof CreatableInstances
				? CreatableInstances[HTMLElementClassMap[Tag]] & GuiObject
				: GuiObject
		>;

	// HTML → Roblox class map (used by the types above)

	/**
	 * Maps every supported HTML tag to its Roblox class.
	 */
	interface HTMLElementClassMap {
		div: 'Frame';
		span: 'TextLabel';
		p: 'TextLabel';
		h1: 'TextLabel';
		h2: 'TextLabel';
		h3: 'TextLabel';
		h4: 'TextLabel';
		h5: 'TextLabel';
		h6: 'TextLabel';
		a: 'TextButton';
		button: 'TextButton';
		img: 'ImageLabel';
		input: 'TextBox';
		textarea: 'TextBox';
		ul: 'ScrollingFrame';
		ol: 'ScrollingFrame';
		li: 'TextLabel';
		code: 'TextLabel';
		pre: 'TextLabel';
		strong: 'TextLabel';
		b: 'TextLabel';
		em: 'TextLabel';
		i: 'TextLabel';
		header: 'Frame';
		footer: 'Frame';
		main: 'Frame';
		nav: 'Frame';
		section: 'Frame';
		article: 'Frame';
		aside: 'Frame';
		form: 'Frame';
		table: 'Frame';
		label: 'TextLabel';
	}

	// HTML intrinsic elements

	/**
	 * JSX elements for HTML tags. Each type is derived from the
	 * underlying Roblox class via `HTMLElementClassMap`.
	 */
	interface HTMLIntrinsicElements {
		div: HTMLIntrinsicElement<'div'>;
		span: HTMLIntrinsicElement<'span'>;
		p: HTMLIntrinsicElement<'p'>;
		h1: HTMLIntrinsicElement<'h1'>;
		h2: HTMLIntrinsicElement<'h2'>;
		h3: HTMLIntrinsicElement<'h3'>;
		h4: HTMLIntrinsicElement<'h4'>;
		h5: HTMLIntrinsicElement<'h5'>;
		h6: HTMLIntrinsicElement<'h6'>;
		a: HTMLIntrinsicElement<'a'>;
		button: HTMLIntrinsicElement<'button'>;
		img: HTMLIntrinsicElement<'img'>;
		input: HTMLIntrinsicElement<'input'>;
		textarea: HTMLIntrinsicElement<'textarea'>;
		ul: HTMLIntrinsicElement<'ul'>;
		ol: HTMLIntrinsicElement<'ol'>;
		li: HTMLIntrinsicElement<'li'>;
		code: HTMLIntrinsicElement<'code'>;
		pre: HTMLIntrinsicElement<'pre'>;
		strong: HTMLIntrinsicElement<'strong'>;
		b: HTMLIntrinsicElement<'b'>;
		em: HTMLIntrinsicElement<'em'>;
		i: HTMLIntrinsicElement<'i'>;
		header: HTMLIntrinsicElement<'header'>;
		footer: HTMLIntrinsicElement<'footer'>;
		main: HTMLIntrinsicElement<'main'>;
		nav: HTMLIntrinsicElement<'nav'>;
		section: HTMLIntrinsicElement<'section'>;
		article: HTMLIntrinsicElement<'article'>;
		aside: HTMLIntrinsicElement<'aside'>;
		form: HTMLIntrinsicElement<'form'>;
		table: HTMLIntrinsicElement<'table'>;
		label: HTMLIntrinsicElement<'label'>;
	}

	// IntrinsicElements — merged Roblox + HTML

	/**
	 * The resolved `IntrinsicElements` map. This is the intersection of all
	 * native Roblox class elements and all HTML elements.
	 */
	type IntrinsicElements = RobloxIntrinsicElements & HTMLIntrinsicElements;
}
