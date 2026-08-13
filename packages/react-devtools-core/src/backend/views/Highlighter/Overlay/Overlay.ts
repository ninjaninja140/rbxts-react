import { __REACT_DEVTOOLS_GLOBAL_HOOK__ } from '@nrbx/react-globals';

import type { DevToolsHook } from '../../../types';
import OverlayRect from './OverlayRect';
import OverlayTip from './OverlayTip';

function getNestedBoundingClientRect(node: GuiBase2d): Rect {
	const bounds = node.AbsoluteSize;
	const position = node.AbsolutePosition;
	return new Rect(position, position.add(bounds));
}

export class Overlay {
	private layerCollector: LayerCollector | undefined;
	public readonly container: Folder;
	private readonly containerFrame: ImageButton;
	private readonly rectContainer: CanvasGroup;
	private readonly tip: OverlayTip;
	private readonly rects = [] as OverlayRect[];

	public constructor() {
		this.layerCollector = undefined;

		const container = new Instance('Folder') as Folder;
		container.Name = 'REACT_DEVTOOLS_OVERLAY';
		this.container = container;

		const containerFrame = new Instance('ImageButton') as ImageButton;
		containerFrame.Name = 'OverlayContainer';
		containerFrame.Size = UDim2.fromScale(1, 1);
		containerFrame.BackgroundTransparency = 1;
		containerFrame.Image = '';
		containerFrame.ZIndex = 1_000_000;
		containerFrame.Parent = container;
		this.containerFrame = containerFrame;

		const rectContainer = new Instance('CanvasGroup') as CanvasGroup;
		rectContainer.Name = 'OverlayRects';
		rectContainer.Size = UDim2.fromScale(1, 1);
		rectContainer.BackgroundTransparency = 1;
		rectContainer.GroupTransparency = 0.3;
		rectContainer.ZIndex = 1_000_001;
		rectContainer.Parent = containerFrame;
		this.rectContainer = rectContainer;

		this.tip = new OverlayTip(this.containerFrame);
	}

	public remove(): void {
		this.tip.remove();
		for (const rect of this.rects) {
			rect.remove();
		}
		this.rects.clear();
		this.container.Parent = undefined;
	}

	public inspect(nodes: Array<GuiBase2d>, name: string | undefined): void {
		this.layerCollector = nodes[0]?.FindFirstAncestorWhichIsA('LayerCollector') as LayerCollector | undefined;
		if (this.layerCollector === undefined) {
			for (const node of nodes) {
				if (node.IsA('LayerCollector')) {
					this.layerCollector = node as unknown as LayerCollector;
					break;
				}
			}
		}

		this.container.Parent = this.layerCollector;
		const elements = nodes.filter(
			(node) =>
				node.IsA('LayerCollector') ||
				(this.layerCollector !== undefined ? node.IsDescendantOf(this.layerCollector) : false)
		);

		for (let i = elements.size() + 1; i <= this.rects.size(); i++) {
			const rect = this.rects[i - 1];
			if (rect !== undefined) {
				rect.remove();
			}
		}

		if (elements.size() === 0) {
			return;
		}

		while (this.rects.size() < elements.size()) {
			this.rects.push(new OverlayRect(this.rectContainer));
		}

		const outerBox = {
			top: math.huge,
			right: -math.huge,
			bottom: -math.huge,
			left: math.huge,
		};
		for (let index = 0; index < elements.size(); index++) {
			const element = elements[index];
			if (element === undefined) {
				continue;
			}

			const box = getNestedBoundingClientRect(element);
			outerBox.top = math.min(outerBox.top, box.Min.Y);
			outerBox.right = math.max(outerBox.right, box.Max.X);
			outerBox.bottom = math.max(outerBox.bottom, box.Max.Y);
			outerBox.left = math.min(outerBox.left, box.Min.X);

			const rect = this.rects[index];
			if (rect !== undefined) {
				rect.update(element);
			}
		}

		if (name === undefined || name === '') {
			const node = elements[0];
			if (node === undefined) {
				return;
			}
			name = node.Name;

			const hook = __REACT_DEVTOOLS_GLOBAL_HOOK__ as DevToolsHook | undefined;
			if (hook !== undefined && hook.rendererInterfaces !== undefined) {
				let ownerName: string | undefined;
				for (const [, rendererInterface] of hook.rendererInterfaces) {
					const id = rendererInterface.getFiberIDForNative(node, true);
					if (id !== undefined) {
						ownerName = rendererInterface.getDisplayNameForFiberID(id, true);
						break;
					}
				}

				if (ownerName !== undefined) {
					name = `${name} (in ${ownerName})`;
				}
			}
		}

		this.tip.updateText(name, outerBox.right - outerBox.left, outerBox.bottom - outerBox.top);

		const firstElement = elements[0];
		const tipBoundsWindow =
			this.layerCollector !== undefined
				? (this.layerCollector as unknown as GuiBase2d)
				: firstElement?.IsA('LayerCollector')
					? firstElement
					: undefined;
		const tipBounds =
			tipBoundsWindow !== undefined
				? getNestedBoundingClientRect(tipBoundsWindow)
				: new Rect(new Vector2(0, 0), new Vector2(math.huge, math.huge));

		this.tip.updatePosition(
			{
				top: outerBox.top,
				left: outerBox.left,
				height: outerBox.bottom - outerBox.top,
				width: outerBox.right - outerBox.left,
			},
			{
				top: tipBounds.Min.Y,
				left: tipBounds.Min.X,
				height: tipBounds.Height,
				width: tipBounds.Width,
			}
		);
	}
}

export default Overlay;
