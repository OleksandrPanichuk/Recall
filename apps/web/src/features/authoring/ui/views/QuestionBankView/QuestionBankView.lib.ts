import type { QuestionRow } from "@recall/contracts";

export function matching(
	rows: readonly QuestionRow[],
	query: string,
): readonly QuestionRow[] {
	const needle = query.trim().toLocaleLowerCase();

	if (needle.length === 0) {
		return rows;
	}

	return rows.filter((row) =>
		[row.question.prompt, row.question.topic ?? "", row.setTitle].some(
			(field) => field.toLocaleLowerCase().includes(needle),
		),
	);
}

export function neverAnswered(rows: readonly QuestionRow[]): number {
	return rows.filter((row) => row.answerCount === 0).length;
}
