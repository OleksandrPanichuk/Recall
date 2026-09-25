import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import postgres from "postgres";
import {
	type AppSession,
	bodyOf as json,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";
import { aSet, type CurrentShape } from "../../fixtures/app-shapes";

const available = await postgresAvailable();

const CONCURRENCY = 6;
const ROUNDS = 5;

let session: AppSession;
let call: AppSession["app"];
let sql: postgres.Sql;

interface Answered {
	readonly isCorrect: boolean;
	readonly alreadyAnswered: boolean;
}

interface Finished {
	readonly score: { correct: number };
	readonly unansweredCount: number;
}

const useLadder = (): Promise<Response> =>
	call("settings/update", {
		repetition: {
			scheduler: "ladder",
			intervalsDays: [1, 3, 7, 21],
			maxIntervalDays: 365,
			maxRepetitions: 8,
			desiredRetention: 0.9,
		},
	});

const currentQuestion = async (): Promise<string> =>
	(await json<CurrentShape>(await call("attempts/current"))).question
		?.id as string;

const repetitionsOf = async (quizSetId: string): Promise<readonly number[]> => {
	const rows = await sql<{ repetitionCount: number }[]>`
		select review_states.repetition_count as "repetitionCount"
		from review_states
		join questions on questions.id = review_states.question_id
		where questions.quiz_id = ${quizSetId}::uuid
		order by questions.position
	`;

	return rows.map((row) => row.repetitionCount);
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({ name: "app-attempt-concurrency" });
	call = session.app;
	sql = postgres(process.env.DATABASE_URL as string, {
		max: 1,
		prepare: false,
		onnotice: () => {},
	});
	await useLadder();
});

afterAll(async () => {
	await sql?.end({ timeout: 1 });
	await session?.close();
});

describe.skipIf(!available)("an attempt touched twice at once", () => {
	test("finishing it from several places schedules it exactly once", async () => {
		for (let round = 0; round < ROUNDS; round += 1) {
			const quizSetId = await aSet(
				call,
				`Finish race ${round}`,
				["One?", "Two?"],
				true,
			);

			await call("attempts/start", { quizSetId });

			for (let answered = 0; answered < 2; answered += 1) {
				await call("attempts/answer", {
					questionId: await currentQuestion(),
					selectedOptionPositions: [0],
				});
			}

			const responses = await Promise.all(
				Array.from({ length: CONCURRENCY }, () => call("attempts/finish", {})),
			);
			const statuses = responses.map((response) => response.status);
			const refused = await Promise.all(
				responses
					.filter((response) => response.status !== 200)
					.map((response) => json<{ error: string }>(response)),
			);

			expect(statuses.filter((status) => status === 200)).toHaveLength(1);
			expect(new Set(refused.map((body) => body.error))).toEqual(
				new Set(["NoActiveAttemptError"]),
			);
			expect(await repetitionsOf(quizSetId)).toEqual([1, 1]);
		}
	});

	test("answering one question from several places records one verdict and reports it to all", async () => {
		for (let round = 0; round < ROUNDS; round += 1) {
			const quizSetId = await aSet(
				call,
				`Answer race ${round}`,
				["One?", "Two?"],
				true,
			);

			await call("attempts/start", { quizSetId });

			const questionId = await currentQuestion();
			const replies = await Promise.all(
				Array.from({ length: CONCURRENCY }, (_, index) =>
					call("attempts/answer", {
						questionId,
						selectedOptionPositions: [index % 2],
					}).then((response) => json<Answered>(response)),
				),
			);
			const recorded = replies.filter((reply) => !reply.alreadyAnswered);

			expect(recorded).toHaveLength(1);

			const verdict = recorded[0]?.isCorrect;

			expect(replies.map((reply) => reply.isCorrect)).toEqual(
				replies.map(() => verdict as boolean),
			);

			const finished = await json<Finished>(await call("attempts/finish", {}));

			expect(finished.unansweredCount).toBe(1);
			expect(finished.score.correct).toBe(verdict ? 1 : 0);
		}
	});
});
