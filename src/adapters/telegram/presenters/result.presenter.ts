import type { AnswerQuestionResult } from "@/application/use-cases/attempts/answer-question";
import type { FinishQuizAttemptResult } from "@/application/use-cases/attempts/finish-quiz-attempt";
import type { QuizStatistics } from "@/application/use-cases/statistics/get-quiz-statistics";
import type { Question } from "@/domain/quiz-set/question";
import { CallbackAction } from "../callbacks/callback-data";
import { button, type Screen } from "./menu.presenter";

export function answerFeedback(
	result: AnswerQuestionResult,
	question: Question,
): Screen {
	const correctText = question.options
		.filter((option) => result.correctOptionIds.includes(option.id))
		.map((option) => option.text)
		.join(", ");

	const lines = [
		result.isCorrect ? "✅ Правильно" : "❌ Неправильно",
		result.alreadyAnswered ? "(відповідь уже зарахована раніше)" : undefined,
		`Правильна відповідь: ${correctText}`,
		result.explanation === undefined ? undefined : `\n${result.explanation}`,
		`\nРахунок: ${result.score.correct}/${result.score.total} (${result.score.percentage}%)`,
	];

	// Rating only appears for a question that is actually in the review queue —
	// it adjusts when that question returns, so it is meaningless otherwise.
	const rating =
		result.reviewDueAt === undefined
			? []
			: [
					(["hard", "good", "easy"] as const).map((value, index) =>
						button(["😖 Важко", "🙂 Нормально", "😎 Легко"][index] as string, {
							action: CallbackAction.Rate,
							questionId: question.id,
							rating: value,
						}),
					),
				];

	return {
		text: lines.filter((line) => line !== undefined).join("\n"),
		keyboard: [
			...rating,
			[
				result.nextQuestionId === undefined
					? button("🏁 Завершити", { action: CallbackAction.Finish })
					: button("➡️ Далі", { action: CallbackAction.Resume }),
			],
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}

export function finalResult(result: FinishQuizAttemptResult): Screen {
	const lines = [
		"🏁 Спробу завершено",
		`Рахунок: ${result.score.correct}/${result.score.total} (${result.score.percentage}%)`,
		result.unansweredCount > 0
			? `Без відповіді: ${result.unansweredCount}`
			: undefined,
	];

	return {
		text: lines.filter((line) => line !== undefined).join("\n"),
		keyboard: [
			[button("📊 Статистика", { action: CallbackAction.Statistics })],
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}

export function statisticsScreen(
	title: string,
	statistics: QuizStatistics,
): Screen {
	if (statistics.attempts.length === 0) {
		return {
			text: `${title}\n\nЗавершених спроб ще немає.`,
			keyboard: [[button("« Меню", { action: CallbackAction.Menu })]],
		};
	}

	const attempts = statistics.attempts
		.map(
			(attempt, index) =>
				`${index + 1}. ${attempt.score.correct}/${attempt.score.total} (${attempt.score.percentage}%)`,
		)
		.join("\n");
	const topics = statistics.topics
		.map(
			(topic) =>
				`• ${topic.topic ?? "Без теми"}: ${topic.correct}/${topic.answered}`,
		)
		.join("\n");
	const improvement =
		statistics.improvement === undefined
			? undefined
			: `\nПрогрес: ${statistics.improvement.firstPercentage}% → ${statistics.improvement.lastPercentage}% (${statistics.improvement.deltaPercentage >= 0 ? "+" : ""}${statistics.improvement.deltaPercentage})`;

	return {
		text: [
			title,
			`\nТочність по набору: ${statistics.setAccuracy.correct}/${statistics.setAccuracy.total} (${statistics.setAccuracy.percentage}%)`,
			improvement,
			`\nСпроби:\n${attempts}`,
			topics.length === 0 ? undefined : `\nТеми:\n${topics}`,
			statistics.incorrectQuestionIds.length === 0
				? undefined
				: `\nПитань на повторення: ${statistics.incorrectQuestionIds.length}`,
		]
			.filter((line) => line !== undefined)
			.join("\n"),
		keyboard: [[button("« Меню", { action: CallbackAction.Menu })]],
	};
}
