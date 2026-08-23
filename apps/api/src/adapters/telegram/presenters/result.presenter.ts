import type { AnswerQuestionResult } from "@/application/use-cases/attempts/answer-question";
import type { FinishQuizAttemptResult } from "@/application/use-cases/attempts/finish-quiz-attempt";
import type { QuizStatistics } from "@/application/use-cases/statistics/get-quiz-statistics";
import type { Question } from "@/domain/quiz-set/question";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { InlineButton, Screen } from "./screen.types";
import { button } from "./utils/button";
import { correctAnswerText } from "./utils/correct-answer";

export const MAX_ROWS = 15;

export function answerFeedback(
	result: AnswerQuestionResult,
	question: Question,
): Screen {
	const correctText = correctAnswerText(question, result.correctOptionIds);

	const accepted =
		result.acceptedAnswers.length > 0
			? result.acceptedAnswers.join(" / ")
			: correctText;

	const lines = [
		result.isCorrect ? "✅ Правильно" : "❌ Неправильно",
		result.alreadyAnswered ? "(відповідь уже зарахована раніше)" : undefined,
		result.credit.possible > 1
			? `Правильно ${result.credit.earned} з ${result.credit.possible} пар`
			: undefined,
		result.typedAnswer === undefined || result.isCorrect
			? undefined
			: `Ви написали: ${result.typedAnswer}`,
		result.nearMiss === undefined
			? undefined
			: `Майже — одна літера: ${result.nearMiss}`,
		`Правильна відповідь: ${accepted}`,
		result.explanation === undefined ? undefined : `\n${result.explanation}`,
		`\nРахунок: ${result.score.correct}/${result.score.total} (${result.score.percentage}%)`,
	];

	return {
		text: lines.filter((line) => line !== undefined).join("\n"),
		keyboard: [
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
			[
				button("🔍 Розбір", {
					action: CallbackAction.AttemptDetail,
					attemptId: result.attemptId,
				}),
			],
			[
				button("📊 Статистика", {
					action: CallbackAction.StatisticsFor,
					quizSetId: result.quizSetId,
				}),
			],
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}

const statisticsNavigation = (statistics: QuizStatistics): InlineButton[][] => [
	[
		button("« До наборів", {
			action: CallbackAction.Browse,
			leaf: CallbackAction.StatisticsFor,
			folderId: statistics.folderId,
		}),
	],
	[button("« Меню", { action: CallbackAction.Menu })],
];

export function statisticsScreen(statistics: QuizStatistics): Screen {
	const title = `📊 Статистика — ${statistics.title}`;
	if (statistics.attempts.length === 0) {
		return {
			text: `${title}\n\nЗавершених спроб ще немає.`,
			keyboard: statisticsNavigation(statistics),
		};
	}

	const shownAttempts = statistics.attempts.slice(-MAX_ROWS);
	const skippedAttempts = statistics.attempts.length - shownAttempts.length;
	const shownTopics = statistics.topics.slice(0, MAX_ROWS);
	const skippedTopics = statistics.topics.length - shownTopics.length;

	const attempts = [
		...shownAttempts.map(
			(attempt, index) =>
				`${skippedAttempts + index + 1}. ${attempt.score.correct}/${attempt.score.total} (${attempt.score.percentage}%)`,
		),
		...(skippedAttempts > 0 ? [`…і ще ${skippedAttempts} раніше`] : []),
	].join("\n");
	const topics = [
		...shownTopics.map(
			(topic) =>
				`• ${topic.topic ?? "Без теми"}: ${topic.correct}/${topic.answered}`,
		),
		...(skippedTopics > 0 ? [`…і ще ${skippedTopics} тем`] : []),
	].join("\n");
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
		keyboard: [
			...shownAttempts.map((attempt, index) => [
				button(
					`${skippedAttempts + index + 1}. ${attempt.score.percentage}% — деталі`,
					{
						action: CallbackAction.AttemptDetail,
						attemptId: attempt.attemptId,
					},
				),
			]),
			...statisticsNavigation(statistics),
		],
	};
}
