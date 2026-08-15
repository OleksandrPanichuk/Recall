import type {
	AnsweredQuestion,
	AttemptDetail,
} from "@/application/use-cases/statistics/get-attempt-detail";
import { expectsTypedAnswer, QuestionType } from "@/domain/quiz-set/question";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { Screen } from "./screen.types";
import { button } from "./utils/button";
import { correctAnswerText } from "./utils/correct-answer";

const MAX_QUESTIONS = 20;

const mark = (answer: AnsweredQuestion): string => {
	if (!answer.answered) {
		return "⚪️";
	}

	if (answer.isCorrect) {
		return "✅";
	}

	return answer.creditEarned > 0 ? "🟡" : "❌";
};

const givenText = (answer: AnsweredQuestion): string => {
	if (answer.skipped) {
		return "не знаю";
	}

	if (!answer.answered) {
		return "без відповіді";
	}

	if (expectsTypedAnswer(answer.question)) {
		return answer.typedAnswer ?? "—";
	}

	const chosen = answer.selectedOptionIds
		.map(
			(id) =>
				answer.question.options.find((option) => option.id === id)?.text ?? "?",
		)
		.filter((text) => text.length > 0);

	if (answer.question.type === QuestionType.Matching) {
		const pairs: string[] = [];

		for (let index = 0; index + 1 < chosen.length; index += 2) {
			pairs.push(`${chosen[index]} — ${chosen[index + 1]}`);
		}

		return pairs.join("; ");
	}

	return chosen.join(", ");
};

export function attemptDetailScreen(detail: AttemptDetail): Screen {
	const shown = detail.answers.slice(0, MAX_QUESTIONS);
	const hidden = detail.answers.length - shown.length;

	const lines = shown.map((answer, index) => {
		const credit =
			answer.creditPossible > 1
				? ` (${answer.creditEarned}/${answer.creditPossible})`
				: "";
		const correct = answer.isCorrect
			? ""
			: `\n   ✔️ ${correctAnswerText(
					answer.question,
					answer.question.options
						.filter((option) => option.isCorrect)
						.map((option) => option.id),
				).replaceAll("\n", "; ")}`;

		return `${mark(answer)} ${index + 1}. ${answer.question.prompt}\n   ➡️ ${givenText(answer)}${credit}${correct}`;
	});

	return {
		text: [
			`${detail.quizSetTitle} — ${detail.score.correct}/${detail.score.total} (${detail.score.percentage}%)`,
			"",
			lines.join("\n\n"),
			hidden > 0 ? `\n…і ще ${hidden} питань` : undefined,
		]
			.filter((line) => line !== undefined)
			.join("\n"),
		keyboard: [[button("« Меню", { action: CallbackAction.Menu })]],
	};
}
