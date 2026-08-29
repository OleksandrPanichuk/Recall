export const MAX_BUTTON_TEXT = 32;

export const truncated = (text: string): string => {
	const characters = [...text];

	return characters.length <= MAX_BUTTON_TEXT
		? text
		: `${characters.slice(0, MAX_BUTTON_TEXT - 1).join("")}…`;
};
