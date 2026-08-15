export const trimmedOrUndefined = (
	value: string | undefined,
): string | undefined => {
	const trimmed = value?.trim();

	return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
};

const APOSTROPHES = /[’‘ʼ´`]/g;
const TRAILING_PUNCTUATION = /[.!?]+$/;
const WHITESPACE = /\s+/g;

// Folds everything a keyboard varies but a reader does not: case, spacing, a
// trailing full stop, and every apostrophe a phone might send for one a keyboard
// types — without which don't and don’t are different answers.
export const normaliseForComparison = (value: string): string =>
	value
		.normalize("NFC")
		.replaceAll(APOSTROPHES, "'")
		.trim()
		.replace(WHITESPACE, " ")
		.replace(TRAILING_PUNCTUATION, "")
		.trim()
		.toLocaleLowerCase();
