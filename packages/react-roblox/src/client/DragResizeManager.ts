/**
 * `DragResizeManager` — experimental native `draggable` / `resizable` support.
 *
 * The manager is attached to a single `GuiObject` and wires up Roblox input
 * events so the element can be moved or resized by the user:
 *
 * - `draggable` lets the user grab the element and move it, clamped to the
 *   bounds of its parent `GuiObject` (or `ScreenGui`).
 * - `resizable` lets the user grab any corner of the element and resize it,
 *   also clamped so it can never grow beyond its parent container.
 *
 * Both behaviors are opt-in and disabled by default. They are marked
 * **experimental** and may change in future releases.
 *
 * Input tracking uses `UserInputService.InputChanged` / `InputEnded` while a
 * drag or resize session is active, because `GuiObject` input events only fire
 * while the pointer is over the element. The manager is client-only and guards
 * itself with `pcall`/`RunService:IsClient()`.
 *
 * @module DragResizeManager
 */

/** Pixel radius around a corner that counts as a resize handle. */
const RESIZE_HANDLE_RADIUS = 12;
/** Minimum width/height an element may be resized down to. */
const MIN_ELEMENT_SIZE = 10;

type ResizeCorner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface SessionBase {
	inputType: Enum.UserInputType;
	startInputX: number;
	startInputY: number;
	startAbsPositionX: number;
	startAbsPositionY: number;
	startSizeX: number;
	startSizeY: number;
	startPosition: UDim2;
	containerPositionX: number;
	containerPositionY: number;
	containerSizeX: number;
	containerSizeY: number;
}

interface DragSession extends SessionBase {
	kind: 'drag';
}

interface ResizeSession extends SessionBase {
	kind: 'resize';
	corner: ResizeCorner;
	startSize: UDim2;
}

type Session = DragSession | ResizeSession;

/**
 * Clamps `value` into the inclusive range `[min, max]`. When `max < min`
 * (element larger than its container) the value collapses to `min` instead of
 * producing an inverted range.
 */
function clampToRange(value: number, min: number, max: number): number {
	if (max < min) {
		return min;
	}
	if (value < min) {
		return min;
	}
	if (value > max) {
		return max;
	}
	return value;
}

/**
 * Returns the `UserInputService`, or `undefined` when it is unavailable
 * (e.g. running on the server or outside a client context).
 */
function getUserInputService(): UserInputService | undefined {
	const [ok, runService] = pcall(() => game.GetService('RunService') as RunService);
	if (!ok || runService === undefined || !runService.IsClient()) {
		return undefined;
	}
	const [serviceOk, service] = pcall(() => game.GetService('UserInputService') as UserInputService);
	if (!serviceOk || service === undefined) {
		return undefined;
	}
	return service;
}

/**
 * Determines whether an input position is within the resize-handle radius of a
 * corner of the element's absolute bounds.
 */
function getResizeCorner(
	absolutePosition: Vector2,
	absoluteSize: Vector2,
	inputX: number,
	inputY: number
): ResizeCorner | undefined {
	const left = absolutePosition.X;
	const top = absolutePosition.Y;
	const right = left + absoluteSize.X;
	const bottom = top + absoluteSize.Y;

	const nearLeft = math.abs(inputX - left) <= RESIZE_HANDLE_RADIUS;
	const nearRight = math.abs(inputX - right) <= RESIZE_HANDLE_RADIUS;
	const nearTop = math.abs(inputY - top) <= RESIZE_HANDLE_RADIUS;
	const nearBottom = math.abs(inputY - bottom) <= RESIZE_HANDLE_RADIUS;

	if (nearLeft && nearTop) {
		return 'topLeft';
	}
	if (nearRight && nearTop) {
		return 'topRight';
	}
	if (nearLeft && nearBottom) {
		return 'bottomLeft';
	}
	if (nearRight && nearBottom) {
		return 'bottomRight';
	}
	return undefined;
}

/**
 * Returns `[position, size]` of the instance's parent container, or `undefined`
 * when the parent has no usable absolute bounds (e.g. no parent, or parented
 * under a non-GUI instance).
 */
function getContainerBounds(instance: GuiObject): LuaTuple<[Vector2, Vector2]> | undefined {
	const parent = instance.Parent;
	if (parent === undefined || !parent.IsA('GuiBase2d')) {
		return undefined;
	}
	const guiParent = parent as GuiBase2d;
	return $tuple(guiParent.AbsolutePosition, guiParent.AbsoluteSize);
}

export class DragResizeManager {
	private readonly instance: GuiObject;
	private inputBeganConnection: RBXScriptConnection | undefined;
	private inputChangedConnection: RBXScriptConnection | undefined;
	private inputEndedConnection: RBXScriptConnection | undefined;
	private activeSession: Session | undefined;
	private draggableEnabled = false;
	private resizableEnabled = false;

	constructor(instance: Instance) {
		this.instance = instance as GuiObject;
	}

	/** Enables or disables dragging for this element. */
	public setDraggable(enabled: boolean): void {
		this.draggableEnabled = enabled;
		this.syncInputBegan();
		if (!enabled && this.activeSession !== undefined && this.activeSession.kind === 'drag') {
			this.endSession();
		}
	}

	/** Enables or disables resizing for this element. */
	public setResizable(enabled: boolean): void {
		this.resizableEnabled = enabled;
		this.syncInputBegan();
		if (!enabled && this.activeSession !== undefined && this.activeSession.kind === 'resize') {
			this.endSession();
		}
	}

	/** Whether either behavior is currently enabled. */
	public isActive(): boolean {
		return this.draggableEnabled || this.resizableEnabled;
	}

	/** Disconnects every signal connection and ends any active session. */
	public disconnect(): void {
		this.endSession();
		if (this.inputBeganConnection !== undefined) {
			this.inputBeganConnection.Disconnect();
			this.inputBeganConnection = undefined;
		}
	}

	// Input lifecycle

	private syncInputBegan(): void {
		if (this.isActive()) {
			if (this.inputBeganConnection === undefined) {
				this.inputBeganConnection = this.instance.InputBegan.Connect((input) => {
					this.onInputBegan(input);
				});
			}
		} else if (this.inputBeganConnection !== undefined) {
			this.inputBeganConnection.Disconnect();
			this.inputBeganConnection = undefined;
		}
	}

	private onInputBegan(input: InputObject): void {
		if (this.activeSession !== undefined) {
			return;
		}
		if (
			input.UserInputType !== Enum.UserInputType.MouseButton1 &&
			input.UserInputType !== Enum.UserInputType.Touch
		) {
			return;
		}

		const corner = this.resizableEnabled
			? getResizeCorner(
					this.instance.AbsolutePosition,
					this.instance.AbsoluteSize,
					input.Position.X,
					input.Position.Y
				)
			: undefined;

		if (corner !== undefined) {
			this.startResize(input, corner);
		} else if (this.draggableEnabled) {
			this.startDrag(input);
		}
	}

	private startDrag(input: InputObject): void {
		const bounds = getContainerBounds(this.instance);
		if (bounds === undefined) {
			return;
		}
		const [containerPosition, containerSize] = bounds;
		const absolutePosition = this.instance.AbsolutePosition;
		const absoluteSize = this.instance.AbsoluteSize;

		this.activeSession = {
			kind: 'drag',
			inputType: input.UserInputType,
			startInputX: input.Position.X,
			startInputY: input.Position.Y,
			startAbsPositionX: absolutePosition.X,
			startAbsPositionY: absolutePosition.Y,
			startSizeX: absoluteSize.X,
			startSizeY: absoluteSize.Y,
			startPosition: this.instance.Position,
			containerPositionX: containerPosition.X,
			containerPositionY: containerPosition.Y,
			containerSizeX: containerSize.X,
			containerSizeY: containerSize.Y,
		};
		this.connectGlobalInput();
	}

	private startResize(input: InputObject, corner: ResizeCorner): void {
		const bounds = getContainerBounds(this.instance);
		if (bounds === undefined) {
			return;
		}
		const [containerPosition, containerSize] = bounds;
		const absolutePosition = this.instance.AbsolutePosition;
		const absoluteSize = this.instance.AbsoluteSize;

		this.activeSession = {
			kind: 'resize',
			corner,
			inputType: input.UserInputType,
			startInputX: input.Position.X,
			startInputY: input.Position.Y,
			startAbsPositionX: absolutePosition.X,
			startAbsPositionY: absolutePosition.Y,
			startSizeX: absoluteSize.X,
			startSizeY: absoluteSize.Y,
			startPosition: this.instance.Position,
			startSize: this.instance.Size,
			containerPositionX: containerPosition.X,
			containerPositionY: containerPosition.Y,
			containerSizeX: containerSize.X,
			containerSizeY: containerSize.Y,
		};
		this.connectGlobalInput();
	}

	private connectGlobalInput(): void {
		const userInputService = getUserInputService();
		if (userInputService === undefined) {
			this.activeSession = undefined;
			return;
		}

		this.inputChangedConnection = userInputService.InputChanged.Connect((input) => {
			this.onGlobalInputChanged(input);
		});
		this.inputEndedConnection = userInputService.InputEnded.Connect((input) => {
			this.onGlobalInputEnded(input);
		});
	}

	private onGlobalInputChanged(input: InputObject): void {
		const session = this.activeSession;
		if (session === undefined) {
			return;
		}
		if (!this.isSessionMovement(session, input)) {
			return;
		}

		if (session.kind === 'drag') {
			this.updateDrag(session, input);
		} else {
			this.updateResize(session, input);
		}
	}

	private onGlobalInputEnded(input: InputObject): void {
		const session = this.activeSession;
		if (session === undefined) {
			return;
		}
		if (this.isSessionEndInput(session, input)) {
			this.endSession();
		}
	}

	/** Whether an `InputChanged` event corresponds to this session's pointer. */
	private isSessionMovement(session: Session, input: InputObject): boolean {
		if (session.inputType === Enum.UserInputType.MouseButton1) {
			return input.UserInputType === Enum.UserInputType.MouseMovement;
		}
		return input.UserInputType === Enum.UserInputType.Touch;
	}

	/** Whether an `InputEnded` event corresponds to this session's pointer. */
	private isSessionEndInput(session: Session, input: InputObject): boolean {
		if (session.inputType === Enum.UserInputType.MouseButton1) {
			return input.UserInputType === Enum.UserInputType.MouseButton1;
		}
		return input.UserInputType === Enum.UserInputType.Touch;
	}

	private endSession(): void {
		if (this.inputChangedConnection !== undefined) {
			this.inputChangedConnection.Disconnect();
			this.inputChangedConnection = undefined;
		}
		if (this.inputEndedConnection !== undefined) {
			this.inputEndedConnection.Disconnect();
			this.inputEndedConnection = undefined;
		}
		this.activeSession = undefined;
	}

	// Movement

	private updateDrag(session: DragSession, input: InputObject): void {
		const deltaX = input.Position.X - session.startInputX;
		const deltaY = input.Position.Y - session.startInputY;

		const minX = session.containerPositionX;
		const minY = session.containerPositionY;
		const maxX = session.containerPositionX + session.containerSizeX - session.startSizeX;
		const maxY = session.containerPositionY + session.containerSizeY - session.startSizeY;

		const effectiveX = clampToRange(session.startAbsPositionX + deltaX, minX, maxX) - session.startAbsPositionX;
		const effectiveY = clampToRange(session.startAbsPositionY + deltaY, minY, maxY) - session.startAbsPositionY;

		this.instance.Position = new UDim2(
			session.startPosition.X.Scale,
			session.startPosition.X.Offset + effectiveX,
			session.startPosition.Y.Scale,
			session.startPosition.Y.Offset + effectiveY
		);
	}

	private updateResize(session: ResizeSession, input: InputObject): void {
		const deltaX = input.Position.X - session.startInputX;
		const deltaY = input.Position.Y - session.startInputY;

		const minX = session.containerPositionX;
		const minY = session.containerPositionY;
		const maxX = session.containerPositionX + session.containerSizeX;
		const maxY = session.containerPositionY + session.containerSizeY;

		let positionDeltaX = 0;
		let sizeDeltaX = 0;
		let positionDeltaY = 0;
		let sizeDeltaY = 0;

		// Horizontal edge.
		if (session.corner === 'topLeft' || session.corner === 'bottomLeft') {
			const maxLeft = session.startAbsPositionX + session.startSizeX - MIN_ELEMENT_SIZE;
			const newLeft = clampToRange(session.startAbsPositionX + deltaX, minX, maxLeft);
			positionDeltaX = newLeft - session.startAbsPositionX;
			sizeDeltaX = -positionDeltaX;
		} else {
			const maxWidth = maxX - session.startAbsPositionX;
			const newWidth = clampToRange(session.startSizeX + deltaX, MIN_ELEMENT_SIZE, maxWidth);
			sizeDeltaX = newWidth - session.startSizeX;
		}

		// Vertical edge.
		if (session.corner === 'topLeft' || session.corner === 'topRight') {
			const maxTop = session.startAbsPositionY + session.startSizeY - MIN_ELEMENT_SIZE;
			const newTop = clampToRange(session.startAbsPositionY + deltaY, minY, maxTop);
			positionDeltaY = newTop - session.startAbsPositionY;
			sizeDeltaY = -positionDeltaY;
		} else {
			const maxHeight = maxY - session.startAbsPositionY;
			const newHeight = clampToRange(session.startSizeY + deltaY, MIN_ELEMENT_SIZE, maxHeight);
			sizeDeltaY = newHeight - session.startSizeY;
		}

		this.instance.Position = new UDim2(
			session.startPosition.X.Scale,
			session.startPosition.X.Offset + positionDeltaX,
			session.startPosition.Y.Scale,
			session.startPosition.Y.Offset + positionDeltaY
		);
		this.instance.Size = new UDim2(
			session.startSize.X.Scale,
			session.startSize.X.Offset + sizeDeltaX,
			session.startSize.Y.Scale,
			session.startSize.Y.Offset + sizeDeltaY
		);
	}
}
