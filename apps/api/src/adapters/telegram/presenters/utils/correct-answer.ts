import {
	matchingSides,
	type Question,
	type QuestionOptionId,
	QuestionType,
} from "@/domain/quiz-set/question";

export function correctAnswerText(
	question: Question,
	correctOptionIds: readonly QuestionOptionId[],
): string {
	if (question.type === QuestionType.Matching) {
		const { left, right } = matchingSides(question);

		return left
			.map((option) => {
				const partner = right.find(
					(candidate) => candidate.matchKey === option.matchKey,
				);

				return `${option.text} — ${partner?.text ?? "?"}`;
			})
			.join("\n");
	}

	const correct = question.options.filter((option) =>
		correctOptionIds.includes(option.id),
	);

	if (question.type === QuestionType.Ordering) {
		return correct
			.toSorted((one, other) => one.position - other.position)
			.map((option, index) => `${index + 1}. ${option.text}`)
			.join("\n");
	}

	return correct.map((option) => option.text).join(", ");
}
