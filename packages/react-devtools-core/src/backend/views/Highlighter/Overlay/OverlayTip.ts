type Box = { top: number; left: number; width: number; height: number };

function calculatePosition(dims: Box, bounds: Box, size: Vector2): Vector2 {
	const tipHeight = math.max(size.Y, 20);
	const tipWidth = math.max(size.X, 60);
	const margin = 5;

	let top: number;
	if (dims.top + dims.height + tipHeight <= bounds.top + bounds.height) {
		if (dims.top + dims.height < bounds.top + 0) {
			top = bounds.top + margin;
		} else {
			top = dims.top + dims.height + margin;
		}
	} else if (dims.top - tipHeight <= bounds.top + bounds.height) {
		if (dims.top - tipHeight - margin < bounds.top + margin) {
			top = bounds.top + margin;
		} else {
			top = dims.top - tipHeight - margin;
		}
	} else {
		top = bounds.top + bounds.height - tipHeight - margin;
	}

	let left = dims.left + margin;
	if (dims.left < bounds.left) {
		left = bounds.left + margin;
	}
	if (dims.left + tipWidth > bounds.left + bounds.width) {
		left = bounds.left + bounds.width - tipWidth - margin;
	}

	return new Vector2(left, top);
}

export class OverlayTip {
	private background: Frame;
	private nameLabel: TextLabel;
	private dimensionsLabel: TextLabel;

	public constructor(container: GuiBase2d) {
		const background = new Instance('Frame') as Frame;
		background.Name = 'OverlayTip';
		background.BackgroundColor3 = Color3.fromHex('#333740');
		background.AutomaticSize = Enum.AutomaticSize.XY;
		background.Size = UDim2.fromScale(0, 0);
		background.BorderSizePixel = 0;
		background.ZIndex = 1_000_001;
		this.background = background;

		const layout = new Instance('UIListLayout') as UIListLayout;
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.FillDirection = Enum.FillDirection.Horizontal;
		layout.VerticalFlex = Enum.UIFlexAlignment.Fill;
		layout.Padding = new UDim(0, 6);
		layout.Parent = background;

		const padding = new Instance('UIPadding') as UIPadding;
		padding.PaddingTop = new UDim(0, 4);
		padding.PaddingBottom = new UDim(0, 4);
		padding.PaddingLeft = new UDim(0, 6);
		padding.PaddingRight = new UDim(0, 6);
		padding.Parent = background;

		const cornerRadius = new Instance('UICorner') as UICorner;
		cornerRadius.CornerRadius = new UDim(0, 2);
		cornerRadius.Parent = background;

		const name = new Instance('TextLabel') as TextLabel;
		name.Name = 'Name';
		name.Size = UDim2.fromScale(0, 0);
		name.AutomaticSize = Enum.AutomaticSize.XY;
		name.BackgroundTransparency = 1;
		name.LayoutOrder = 1;
		name.Font = Enum.Font.BuilderSansBold;
		name.TextColor3 = Color3.fromHex('#ee78e6');
		name.TextSize = 16;
		name.ZIndex = 1_000_002;
		name.Parent = background;
		this.nameLabel = name;

		const divider = new Instance('Frame') as Frame;
		divider.Name = 'Divider';
		divider.Size = UDim2.fromOffset(1, 0);
		divider.BackgroundColor3 = Color3.fromHex('#aaaaaa');
		divider.BorderSizePixel = 0;
		divider.LayoutOrder = 2;
		divider.ZIndex = 1_000_002;
		divider.Parent = background;

		const dimensions = new Instance('TextLabel') as TextLabel;
		dimensions.Name = 'Dimensions';
		dimensions.Size = UDim2.fromScale(0, 0);
		dimensions.AutomaticSize = Enum.AutomaticSize.XY;
		dimensions.BackgroundTransparency = 1;
		dimensions.LayoutOrder = 3;
		dimensions.Font = Enum.Font.BuilderSansBold;
		dimensions.TextColor3 = Color3.fromHex('#d7d7d7');
		dimensions.TextSize = 16;
		dimensions.ZIndex = 1_000_002;
		dimensions.Parent = background;
		this.dimensionsLabel = dimensions;

		background.Parent = container;
	}

	public remove(): void {
		this.background.Destroy();
	}

	public updateText(name: string, width: number, height: number): void {
		this.nameLabel.Text = name;
		this.dimensionsLabel.Text = `${math.round(width)}px x ${math.round(height)}px`;
	}

	public updatePosition(dims: Box, bounds: Box): void {
		const position = calculatePosition(dims, bounds, this.background.AbsoluteSize);
		this.background.Position = UDim2.fromOffset(position.X, position.Y);
	}
}

export type { Box };
export default OverlayTip;
