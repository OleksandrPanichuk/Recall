export const trimmedOrUndefined = (
	value: string | undefined,
): string | undefined => {
	const trimmed = value?.trim();

	return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
};

const APOSTROPHES = /[’‘ʼ´`]/g;
const TRAILING_PUNCTUATION = /[.!?]+$/;
const WHITESPACE = /\s+/g;

export const normaliseForComparison = (value: string): string =>
	value
		.normalize("NFC")
		.replaceAll(APOSTROPHES, "'")
		.trim()
		.replace(WHITESPACE, " ")
		.replace(TRAILING_PUNCTUATION, "")
		.trim()
		.toLocaleLowerCase();
