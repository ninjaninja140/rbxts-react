import { __REACT_DEVTOOLS_GLOBAL_HOOK__ } from '@nrbx/react-globals';

import type { BackendBridge } from '../../../bridge';
import type { RendererInterface } from '../../types';
import { getOverlay, hideOverlay, showOverlay } from './Highlighter';

const UserInputService = game.GetService('UserInputService');
const Players = game.GetService('Players');

type AgentLike = {
	_rendererInterfaces: Partial<Record<number, RendererInterface>>;
	getIDForNode?: (node: object) => number | undefined;
};

type HighlightNativeElementPayload = {
	displayName: string | undefined;
	hideAfterTimeout: boolean;
	id: number;
	openNativeElementsPanel: boolean;
	rendererID: number;
	scrollIntoView: boolean;
};

type GuiContainer = Instance & {
	GetGuiObjectsAtPosition: (x: number, y: number) => Array<GuiObject>;
};

function isVisible(obj: GuiObject): boolean {
	const basicCheck = obj.Visible === true;

	if (obj.IsA('Frame')) {
		return basicCheck && obj.BackgroundTransparency < 1;
	} else if (obj.IsA('CanvasGroup')) {
		return basicCheck && obj.BackgroundTransparency < 1 && obj.GroupTransparency < 1;
	} else if (obj.IsA('TextLabel') && obj.IsA('TextButton')) {
		const textObj = obj as TextLabel & TextButton;
		return basicCheck && textObj.TextTransparency < 1 && textObj.Text !== '';
	} else if (obj.IsA('ImageLabel') && obj.IsA('ImageButton')) {
		const imageObj = obj as ImageLabel & ImageButton;
		return basicCheck && imageObj.ImageTransparency < 1 && imageObj.Image !== '';
	} else {
		return basicCheck;
	}
}

function pickGuiObjectNodes(nodes: Array<Instance>): Array<GuiBase2d> {
	const relevantNodes: GuiBase2d[] = [];
	for (const node of nodes) {
		if (node.IsA('GuiBase2d')) {
			relevantNodes.push(node);
		}
	}
	return relevantNodes;
}

function isInputValid(input: InputObject): boolean {
	return (
		input.UserInputType === Enum.UserInputType.MouseMovement ||
		input.UserInputType === Enum.UserInputType.MouseButton1 ||
		input.UserInputType === Enum.UserInputType.Touch
	);
}

export function setupHighlighter(bridge: BackendBridge, agent: unknown): void {
	const highlighterAgent = agent as AgentLike;
	const listenerConnections: RBXScriptConnection[] = [];
	let stopInspectingNative = () => {};

	let guiContainer: GuiContainer | undefined;
	const isCoreGui = true;
	if (isCoreGui) {
		const dynamicServiceProvider = game as unknown as { GetService: (className: string) => Instance };
		guiContainer = dynamicServiceProvider.GetService('CoreGui') as GuiContainer;
	} else {
		const localPlayer = Players.LocalPlayer;
		if (localPlayer !== undefined) {
			guiContainer = localPlayer.FindFirstChildOfClass('PlayerGui') as GuiContainer | undefined;
		} else {
			warn('No PlayerGui found for LocalPlayer');
		}
	}

	const selectFiberForNode = (node: GuiObject | undefined): void => {
		if (node === undefined) {
			return;
		}

		const id = highlighterAgent.getIDForNode?.(node);
		if (id !== undefined) {
			bridge.send('selectFiber', id);
		}
	};

	const onInputChanged = (input: InputObject): void => {
		if (guiContainer === undefined) {
			return;
		}
		if (!isInputValid(input)) {
			return;
		}

		const position = input.Position;
		const guiObjects = guiContainer.GetGuiObjectsAtPosition(position.X, position.Y);

		let target: GuiObject | undefined;
		const overlay = getOverlay();
		const overlayObj = overlay?.container;

		for (let index = 0; index < guiObjects.size(); index++) {
			const guiObject = guiObjects[index];
			if (guiObject === undefined) {
				continue;
			}

			if (overlayObj !== undefined && guiObject.IsDescendantOf(overlayObj)) {
				continue;
			}

			const isLastElement = index === guiObjects.size() - 1;
			if (!isVisible(guiObject) && !isLastElement) {
				continue;
			}

			target = guiObject;
			break;
		}

		if (target === undefined) {
			hideOverlay();
			return;
		}

		showOverlay([target], undefined, undefined);
		selectFiberForNode(target);
	};

	let lastInputProcessed = false;
	const onInputBegan = (input: InputObject, gameProcessedEvent: boolean): void => {
		if (!isInputValid(input)) {
			return;
		}

		lastInputProcessed = gameProcessedEvent;
	};

	const onInputEnded = (input: InputObject): void => {
		if (!isInputValid(input)) {
			return;
		}
		if (!lastInputProcessed) {
			return;
		}

		stopInspectingNative();
		bridge.send('stopInspectingNative', true);
	};

	const removeInputListeners = (): void => {
		for (const connection of listenerConnections) {
			connection.Disconnect();
		}
		listenerConnections.clear();
	};

	const addInputListeners = (): void => {
		listenerConnections.push(UserInputService.InputChanged.Connect(onInputChanged));
		listenerConnections.push(UserInputService.InputBegan.Connect(onInputBegan));
		listenerConnections.push(UserInputService.InputEnded.Connect(onInputEnded));
	};

	const clearNativeElementHighlight = (): void => {
		hideOverlay();
	};

	const highlightNativeElement = (payload: unknown): void => {
		const {
			displayName,
			hideAfterTimeout,
			id,
			openNativeElementsPanel,
			rendererID,
			scrollIntoView: _scrollIntoView,
		} = payload as HighlightNativeElementPayload;

		const renderer = highlighterAgent._rendererInterfaces[rendererID];
		if (renderer === undefined) {
			warn(`Invalid renderer id "${rendererID}" for element "${id}"`);
		}

		let nodes: Array<Instance> | undefined;
		if (renderer !== undefined) {
			nodes = renderer.findNativeNodesForFiberID(id) as Array<Instance> | undefined;
		}

		if (nodes !== undefined && nodes[0] !== undefined) {
			const relevantNodes = pickGuiObjectNodes(nodes);
			if (relevantNodes.size() === 0) {
				hideOverlay();
				return;
			}

			showOverlay(relevantNodes, displayName, hideAfterTimeout);

			if (openNativeElementsPanel) {
				const hook = __REACT_DEVTOOLS_GLOBAL_HOOK__ as Record<string, unknown> | undefined;
				if (hook !== undefined) {
					hook.$0 = relevantNodes[0];
				}
				bridge.send('syncSelectionToNativeElementsPanel', undefined);
			}
		} else {
			hideOverlay();
		}
	};

	const startInspectingNative = (): void => {
		addInputListeners();
	};

	stopInspectingNative = (): void => {
		hideOverlay();
		removeInputListeners();
	};

	bridge.addListener('clearNativeElementHighlight', clearNativeElementHighlight);
	bridge.addListener('highlightNativeElement', highlightNativeElement);
	bridge.addListener('shutdown', stopInspectingNative);
	bridge.addListener('startInspectingNative', startInspectingNative);
	bridge.addListener('stopInspectingNative', stopInspectingNative);
}
