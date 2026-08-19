import type {
	AnsweredQuestion,
	AttemptDetail,
} from "@/application/use-cases/statistics/get-attempt-detail";
import { expectsTypedAnswer, QuestionType } from "@/domain/quiz-set/question";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { InlineButton, Screen } from "./screen.types";
import { button } from "./utils/button";
import { correctAnswerText } from "./utils/correct-answer";

const TEXT_BUDGET = 3600;

export const DETAIL_PAGE_SIZE = 10;

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

export function attemptDetailScreen(detail: AttemptDetail, page = 0): Screen {
	const describe = (answer: AnsweredQuestion, index: number): string => {
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
		const why =
			answer.isCorrect || answer.question.explanation === undefined
				? ""
				: `\n   💡 ${answer.question.explanation}`;

		return `${mark(answer)} ${index + 1}. ${answer.question.prompt}\n   ➡️ ${givenText(answer)}${credit}${correct}${why}`;
	};

	const pageCount = Math.max(
		1,
		Math.ceil(detail.answers.length / DETAIL_PAGE_SIZE),
	);
	const current = Math.min(Math.max(page, 0), pageCount - 1);
	const first = current * DETAIL_PAGE_SIZE;
	const shown = detail.answers.slice(first, first + DETAIL_PAGE_SIZE);

	const lines: string[] = [];
	let left = TEXT_BUDGET;

	for (const [offset, answer] of shown.entries()) {
		const line = describe(answer, first + offset);
		const share = Math.floor(left / (shown.length - offset));
		const kept =
			line.length <= share ? line : `${line.slice(0, Math.max(share - 1, 1))}…`;

		lines.push(kept);
		left -= kept.length + 2;
	}

	const pager: InlineButton[] = [];

	if (current > 0) {
		pager.push(
			button("‹ Попередні", {
				action: CallbackAction.AttemptDetail,
				attemptId: detail.attemptId,
				page: current - 1,
			}),
		);
	}

	if (current < pageCount - 1) {
		pager.push(
			button("Наступні ›", {
				action: CallbackAction.AttemptDetail,
				attemptId: detail.attemptId,
				page: current + 1,
			}),
		);
	}

	return {
		text: [
			`${detail.quizSetTitle} — ${detail.score.correct}/${detail.score.total} (${detail.score.percentage}%)`,
			pageCount > 1 ? `стор. ${current + 1}/${pageCount}` : undefined,
			"",
			lines.join("\n\n"),
		]
			.filter((line) => line !== undefined)
			.join("\n"),
		keyboard: [
			...(pager.length > 0 ? [pager] : []),
			[
				button("« До статистики", {
					action: CallbackAction.StatisticsFor,
					quizSetId: detail.quizSetId,
				}),
			],
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}
