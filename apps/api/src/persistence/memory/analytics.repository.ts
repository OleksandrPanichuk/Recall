import type {
	AnalyticsRepository,
	AnalyticsWindow,
	DailyActivity,
	DueForecastDay,
	QuestionStat,
} from "@/application/ports/repositories/analytics.repository";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import type { MemoryStore } from "./store";

const dayIn = (at: Date, timezone: string): string =>
	new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(at);

const within = (at: Date, { from, to }: AnalyticsWindow): boolean =>
	at.getTime() >= from.getTime() && at.getTime() < to.getTime();

export function createMemoryAnalyticsRepository(
	store: MemoryStore,
): AnalyticsRepository {
	return {
		async dailyActivity(
			window: AnalyticsWindow,
		): Promise<readonly DailyActivity[]> {
			const days = new Map<string, DailyActivity & { ids: Set<string> }>();

			for (const attempt of store.attempts.values()) {
				for (const response of attempt.responses) {
					if (!within(response.answeredAt, window)) {
						continue;
					}

					const day = dayIn(response.answeredAt, window.timezone);
					const bucket = days.get(day) ?? {
						day,
						attempts: 0,
						answered: 0,
						correct: 0,
						ids: new Set<string>(),
					};

					bucket.ids.add(String(attempt.id));
					days.set(day, {
						...bucket,
						answered: bucket.answered + 1,
						correct: bucket.correct + (response.isCorrect ? 1 : 0),
						attempts: bucket.ids.size,
					});
				}
			}

			return [...days.values()]
				.map(({ ids: _ids, ...day }) => day)
				.sort((left, right) => left.day.localeCompare(right.day));
		},

		async dueForecast(
			window: AnalyticsWindow,
		): Promise<readonly DueForecastDay[]> {
			const days = new Map<string, number>();

			for (const schedule of store.schedules.values()) {
				if (schedule.dueAt === undefined || !within(schedule.dueAt, window)) {
					continue;
				}

				const day = dayIn(schedule.dueAt, window.timezone);

				days.set(day, (days.get(day) ?? 0) + 1);
			}

			return [...days.entries()]
				.map(([day, due]) => ({ day, due }))
				.sort((left, right) => left.day.localeCompare(right.day));
		},

		async hardestQuestions(
			limit: number,
			minimumAnswers: number,
		): Promise<readonly QuestionStat[]> {
			const stats = new Map<string, QuestionStat>();

			for (const attempt of store.attempts.values()) {
				for (const response of attempt.responses) {
					if (response.skipped) {
						continue;
					}

					const key = String(response.questionId);
					const quiz = [...store.quizAggregates.values()].find((candidate) =>
						candidate.questions.some((question) => String(question.id) === key),
					);

					if (quiz === undefined) {
						continue;
					}

					const question = quiz.questions.find(
						(candidate) => String(candidate.id) === key,
					);
					const found = stats.get(key) ?? {
						questionId: response.questionId,
						quizSetId: toQuizSetId(String(quiz.id)),
						quizSetTitle: quiz.title,
						prompt: question?.prompt ?? "",
						answered: 0,
						correct: 0,
						lapses: store.schedules.get(key)?.lapses ?? 0,
					};

					stats.set(key, {
						...found,
						answered: found.answered + 1,
						correct: found.correct + (response.isCorrect ? 1 : 0),
					});
				}
			}

			return [...stats.values()]
				.filter((stat) => stat.answered >= minimumAnswers)
				.sort(
					(left, right) =>
						left.correct / left.answered - right.correct / right.answered ||
						right.answered - left.answered ||
						String(left.questionId).localeCompare(String(right.questionId)),
				)
				.slice(0, limit);
		},
	};
}
