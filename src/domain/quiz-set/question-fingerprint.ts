import { type Question, QuestionType } from "./question";

type OptionEntry = readonly [
	text: string,
	isCorrect: boolean,
	position: number,
	matchKey: string,
];

const compareEntries = (left: OptionEntry, right: OptionEntry): number => {
	if (left[0] !== right[0]) {
		return left[0] < right[0] ? -1 : 1;
	}

	if (left[1] !== right[1]) {
		return Number(left[1]) - Number(right[1]);
	}

	if (left[2] !== right[2]) {
		return left[2] - right[2];
	}

	return left[3] < right[3] ? -1 : left[3] > right[3] ? 1 : 0;
};

const ORDER_BEARING: readonly QuestionType[] = [
	QuestionType.Ordering,
	QuestionType.Matching,
];

const entryOf = (question: Question) => {
	const ordered = ORDER_BEARING.includes(question.type);

	return (option: Question["options"][number]): OptionEntry => [
		option.text.trim().toLowerCase(),
		option.isCorrect,
		ordered ? option.position : 0,
		option.matchKey ?? "",
	];
};

const canonicalContent = (question: Question): string =>
	JSON.stringify([
		question.type,
		question.prompt.trim().toLowerCase(),
		question.options.map(entryOf(question)).toSorted(compareEntries),
	]);

export function questionFingerprint(question: Question): string {
	return Bun.hash(canonicalContent(question)).toString(36);
}
