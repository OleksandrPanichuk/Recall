export interface InlineButton {
	readonly text: string;
	readonly callback_data: string;
}

export interface Screen {
	readonly text: string;
	readonly keyboard: readonly (readonly InlineButton[])[];
}
