export const splitAlternatives = (value: string): readonly string[] =>
	value
		.split(/[,;]/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

export const joinAlternatives = (values: readonly string[]): string =>
	values.join(", ");

export interface PairForm {
	readonly term: string;
	readonly translation: string;
	readonly transcription: string;
	readonly example: string;
}

export const emptyPair = (): PairForm => ({
	term: "",
	translation: "",
	transcription: "",
	example: "",
});

export function pairProblems(form: PairForm): readonly string[] {
	const problems: string[] = [];

	if (splitAlternatives(form.term).length === 0) {
		problems.push("Потрібен щонайменше один термін");
	}

	if (splitAlternatives(form.translation).length === 0) {
		problems.push("Потрібен щонайменше один переклад");
	}

	return problems;
}

const optional = (value: string): string | undefined => {
	const trimmed = value.trim();

	return trimmed.length === 0 ? undefined : trimmed;
};

export const toPair = (form: PairForm) => ({
	term: splitAlternatives(form.term),
	translation: splitAlternatives(form.translation),
	transcription: optional(form.transcription),
	example: optional(form.example),
});
