export const TELEGRAM_TEXT_LIMIT = 4096;
const SAFE_LIMIT = 4000;
const SHORTENED = "\n\n…(скорочено)";

export const clamped = (text: string): string =>
	text.length <= TELEGRAM_TEXT_LIMIT
		? text
		: `${text.slice(0, SAFE_LIMIT)}${SHORTENED}`;

export const shortenedTo = (text: string, limit: number): string => {
	if (text.length <= limit) {
		return text;
	}

	const room = limit - SHORTENED.length;

	return room <= 0 ? "" : `${text.slice(0, room)}${SHORTENED}`;
};
