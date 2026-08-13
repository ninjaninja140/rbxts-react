import Overlay from './Overlay/Overlay';

let timeoutThread: thread | undefined;
let overlay: Overlay | undefined;

const SHOW_DURATION = 2;

export function hideOverlay(): void {
	if (timeoutThread !== undefined) {
		task.cancel(timeoutThread);
	}
	timeoutThread = undefined;

	if (overlay !== undefined) {
		overlay.remove();
		overlay = undefined;
	}
}

export function showOverlay(
	elements: Array<GuiBase2d> | undefined,
	componentName: string | undefined,
	hideAfterTimeout: boolean | undefined
): void {
	if (timeoutThread !== undefined) {
		task.cancel(timeoutThread);
		timeoutThread = undefined;
	}

	if (elements === undefined) {
		return;
	}

	if (overlay === undefined) {
		overlay = new Overlay();
	}

	if (overlay !== undefined && overlay.container.Parent === undefined) {
		overlay.remove();
		overlay = new Overlay();
	}

	if (overlay === undefined) {
		error('Luau');
	}
	overlay.inspect(elements, componentName);

	if (hideAfterTimeout) {
		timeoutThread = task.delay(SHOW_DURATION, () => {
			hideOverlay();
		});
	}
}

export function getOverlay(): Overlay | undefined {
	return overlay;
}
