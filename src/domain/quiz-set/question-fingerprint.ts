import type { Question } from "./question";

const canonicalContent = (question: Question): string =>
	[
		question.type,
		question.prompt.trim().toLowerCase(),
		...question.options
			.map(
				(option) =>
					`${option.text.trim().toLowerCase()}:${option.isCorrect ? "1" : "0"}`,
			)
			.toSorted(),
	].join("\n");

/** Stable content hash used for duplicate detection and idempotent import. */
export function questionFingerprint(question: Question): string {
	return Bun.hash(canonicalContent(question)).toString(36);
}
