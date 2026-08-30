import { sql } from "drizzle-orm";
import type { OwnerId } from "@/application/ports/owner";
import type {
	AnalyticsRepository,
	AnalyticsWindow,
	DailyActivity,
	DueForecastDay,
	QuestionStat,
} from "@/application/ports/repositories/analytics.repository";
import { toQuestionId } from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import type { Executor } from "../unit-of-work";

const toNumber = (value: unknown): number => Number(value ?? 0);

const toDay = (value: unknown): string =>
	value instanceof Date
		? (value.toISOString().slice(0, 10) as string)
		: String(value).slice(0, 10);

export function createAnalyticsPostgresRepository(
	executor: Executor,
	owner: OwnerId,
): AnalyticsRepository {
	return {
		async dailyActivity({
			from,
			to,
			timezone,
		}: AnalyticsWindow): Promise<readonly DailyActivity[]> {
			const rows = await executor.execute(sql`
				select
					(responses.answered_at at time zone ${timezone})::date as day,
					count(distinct responses.attempt_id)::int as attempts,
					count(*)::int as answered,
					count(*) filter (where responses.is_correct)::int as correct
				from responses
				join attempts on attempts.id = responses.attempt_id
				where attempts.owner_id = ${String(owner)}::text
					and responses.answered_at >= ${from.toISOString()}::timestamptz
					and responses.answered_at < ${to.toISOString()}::timestamptz
				group by 1
				order by 1
			`);

			return [...rows].map((row) => ({
				day: toDay(row.day),
				attempts: toNumber(row.attempts),
				answered: toNumber(row.answered),
				correct: toNumber(row.correct),
			}));
		},

		async dueForecast({
			from,
			to,
			timezone,
		}: AnalyticsWindow): Promise<readonly DueForecastDay[]> {
			const rows = await executor.execute(sql`
				select
					(review_states.due_at at time zone ${timezone})::date as day,
					count(*)::int as due
				from review_states
				where review_states.owner_id = ${String(owner)}::text
					and review_states.due_at is not null
					and review_states.due_at >= ${from.toISOString()}::timestamptz
					and review_states.due_at < ${to.toISOString()}::timestamptz
				group by 1
				order by 1
			`);

			return [...rows].map((row) => ({
				day: toDay(row.day),
				due: toNumber(row.due),
			}));
		},

		async hardestQuestions(
			limit: number,
			minimumAnswers: number,
		): Promise<readonly QuestionStat[]> {
			const rows = await executor.execute(sql`
				select
					questions.id as question_id,
					questions.quiz_id as quiz_set_id,
					quizzes.title as quiz_set_title,
					questions.prompt as prompt,
					count(*)::int as answered,
					count(*) filter (where responses.is_correct)::int as correct,
					coalesce(max(review_states.lapses), 0)::int as lapses
				from responses
				join attempts on attempts.id = responses.attempt_id
				join questions on questions.id = responses.question_id
				join quizzes on quizzes.id = questions.quiz_id
				left join review_states on review_states.question_id = questions.id
				where attempts.owner_id = ${String(owner)}::text
					and responses.skipped = false
				group by questions.id, questions.quiz_id, quizzes.title, questions.prompt
				having count(*) >= ${minimumAnswers}
				order by
					(count(*) filter (where responses.is_correct))::float / count(*) asc,
					count(*) desc,
					questions.id asc
				limit ${limit}
			`);

			return [...rows].map((row) => ({
				questionId: toQuestionId(String(row.question_id)),
				quizSetId: toQuizSetId(String(row.quiz_set_id)),
				quizSetTitle: String(row.quiz_set_title),
				prompt: String(row.prompt),
				answered: toNumber(row.answered),
				correct: toNumber(row.correct),
				lapses: toNumber(row.lapses),
			}));
		},
	};
}
