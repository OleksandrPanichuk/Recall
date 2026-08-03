import type { Question } from "./question";

type OptionEntry = readonly [text: string, isCorrect: boolean];

const compareEntries = (left: OptionEntry, right: OptionEntry): number => {
	if (left[0] !== right[0]) {
		return left[0] < right[0] ? -1 : 1;
	}

	return Number(left[1]) - Number(right[1]);
};

const canonicalContent = (question: Question): string =>
	JSON.stringify([
		question.type,
		question.prompt.trim().toLowerCase(),
		question.options
			.map(
				(option): OptionEntry => [
					option.text.trim().toLowerCase(),
					option.isCorrect,
				],
			)
			.toSorted(compareEntries),
	]);

export function questionFingerprint(question: Question): string {
	return Bun.hash(canonicalContent(question)).toString(36);
}
