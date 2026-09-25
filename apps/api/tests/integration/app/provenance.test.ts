import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import postgres from "postgres";
import {
	type AppSession,
	bodyOf as json,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";
import { aSet, type CurrentShape as Current } from "../../fixtures/app-shapes";

const available = await postgresAvailable();
const FORGED_TELEGRAM_ID = 424242;

let session: AppSession;
let call: AppSession["app"];
let sql: postgres.Sql;

const provenanceOf = async (
	attemptId: string,
): Promise<{
	readonly attempt: number | null;
	readonly reviews: readonly (number | null)[];
}> => {
	const [attempt] = await sql<{ telegram_user_id: string | null }[]>`
		select telegram_user_id from attempts where id = ${attemptId}::uuid
	`;
	const reviews = await sql<{ telegram_user_id: string | null }[]>`
		select review_states.telegram_user_id
		from review_states
		join responses on responses.question_id = review_states.question_id
		where responses.attempt_id = ${attemptId}::uuid
	`;
	const numberOf = (value: string | null | undefined) =>
		value === null || value === undefined ? null : Number(value);

	return {
		attempt: numberOf(attempt?.telegram_user_id),
		reviews: reviews.map((row) => numberOf(row.telegram_user_id)),
	};
};

const answerEverything = async (surface: AppSession["app"]): Promise<void> => {
	for (let step = 0; step < 10; step += 1) {
		const current = await surface("attempts/current");
		const questionId =
			current.status === 204
				? undefined
				: (await json<Current>(current)).question?.id;

		if (questionId === undefined) {
			break;
		}

		await surface("attempts/answer", {
			questionId,
			selectedOptionPositions: [0],
		});
	}

	expect((await surface("attempts/finish", {})).status).toBe(200);
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({ name: "app-provenance" });
	call = session.app;
	sql = postgres(process.env.DATABASE_URL as string, {
		max: 1,
		prepare: false,
		onnotice: () => {},
	});
});

afterAll(async () => {
	await sql?.end({ timeout: 5 });
	await session?.close();
});

describe.skipIf(!available)(
	"who started an attempt is not the browser's to say",
	() => {
		let quizSetId: string;

		test("a stray telegramUserId on /app/attempts/start is ignored", async () => {
			quizSetId = await aSet(call, "Provenance", ["First?", "Second?"], true);

			const response = await call("attempts/start", {
				quizSetId,
				telegramUserId: FORGED_TELEGRAM_ID,
			});

			expect(response.status).toBe(200);

			const { attemptId } = await json<{ attemptId: string }>(response);

			await answerEverything(call);

			expect(await provenanceOf(attemptId)).toEqual({
				attempt: null,
				reviews: [null, null],
			});
		});

		test("and so is one on /app/attempts/practice", async () => {
			const questions = await json<readonly { question: { id: string } }[]>(
				await call("sets/questions/list", { quizSetId }),
			);
			const response = await call("attempts/practice", {
				quizSetId,
				mode: "selected",
				questionIds: questions.map((row) => row.question.id),
				telegramUserId: FORGED_TELEGRAM_ID,
			});

			expect(response.status).toBe(200);

			const { attemptId } = await json<{ attemptId: string }>(response);

			await answerEverything(call);

			expect((await provenanceOf(attemptId)).attempt).toBeNull();
		});

		test("the bot still records which Telegram account started it", async () => {
			const response = await session.bot("attempts/start", {
				quizSetId,
				telegramUserId: session.telegramUserId,
			});

			expect(response.status).toBe(200);

			const { attemptId } = await json<{ attemptId: string }>(response);

			await answerEverything(session.bot);

			expect((await provenanceOf(attemptId)).attempt).toBe(
				session.telegramUserId,
			);
		});
	},
);
