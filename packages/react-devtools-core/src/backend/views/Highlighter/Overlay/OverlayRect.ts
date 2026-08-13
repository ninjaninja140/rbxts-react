export class OverlayRect {
	private node: Frame;
	private content: Frame;

	public constructor(container: GuiBase2d) {
		const node = new Instance('Frame') as Frame;
		node.Name = 'OverlayRect';
		node.BackgroundTransparency = 1;
		node.Parent = container;
		this.node = node;

		const padding = new Instance('Frame') as Frame;
		padding.Name = 'OverlayRectPadding';
		padding.BackgroundColor3 = Color3.fromRGB(77, 200, 0);
		padding.Size = UDim2.fromScale(1, 1);
		padding.BackgroundTransparency = 0.4;
		padding.BorderSizePixel = 0;
		padding.Parent = node;

		const content = new Instance('Frame') as Frame;
		content.Name = 'OverlayRectContent';
		content.BackgroundColor3 = Color3.fromRGB(120, 170, 210);
		content.Size = UDim2.fromScale(1, 1);
		content.BorderSizePixel = 0;
		content.ZIndex = 2;
		content.Parent = node;
		this.content = content;
	}

	public remove(): void {
		this.node.Destroy();
	}

	public update(element: GuiBase2d): void {
		const size = element.AbsoluteSize;
		const position = element.AbsolutePosition;

		const padding = element.FindFirstChildOfClass('UIPadding') as UIPadding | undefined;
		if (padding !== undefined) {
			const top = padding.PaddingTop.Scale * size.Y + padding.PaddingTop.Offset;
			const left = padding.PaddingLeft.Scale * size.X + padding.PaddingLeft.Offset;
			const bottom = padding.PaddingBottom.Scale * size.Y + padding.PaddingBottom.Offset;
			const right = padding.PaddingRight.Scale * size.X + padding.PaddingRight.Offset;

			this.content.Position = UDim2.fromOffset(left, top);
			this.content.Size = UDim2.fromOffset(size.X - left - right, size.Y - top - bottom);
		} else {
			this.content.Position = UDim2.fromOffset(0, 0);
			this.content.Size = UDim2.fromOffset(size.X, size.Y);
		}

		this.node.Size = UDim2.fromOffset(size.X, size.Y);
		this.node.Position = UDim2.fromOffset(position.X, position.Y);
	}
}

export default OverlayRect;
