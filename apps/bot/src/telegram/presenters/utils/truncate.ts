export const MAX_BUTTON_TEXT = 32;

// A Telegram label is one line and clips silently, and slicing by UTF-16 unit
// can cut an emoji in half — an unpaired surrogate the Bot API rejects outright.
export const truncated = (text: string): string => {
	const characters = [...text];

	return characters.length <= MAX_BUTTON_TEXT
		? text
		: `${characters.slice(0, MAX_BUTTON_TEXT - 1).join("")}…`;
};
