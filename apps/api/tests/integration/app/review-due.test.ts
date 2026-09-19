import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { BOT_ROUTES, type DueSet } from "@recall/contracts";
import postgres from "postgres";
import {
	type AppSession,
	bodyOf as json,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";
import { aSet, type CurrentShape } from "../../fixtures/app-shapes";

const available = await postgresAvailable();

let session: AppSession;
let call: AppSession["app"];
let sql: postgres.Sql;

const questionIdsOf = async (quizSetId: string): Promise<string[]> =>
	(
		await json<{ questions: { id: string }[] }>(
			await call("sets/get", { quizSetId }),
		)
	).questions.map((question) => question.id);

const finishEveryQuestion = async (quizSetId: string): Promise<void> => {
	expect((await call("attempts/start", { quizSetId })).status).toBe(200);

	for (;;) {
		const response = await call("attempts/current");

		if (response.status === 204) {
			break;
		}

		const current = await json<CurrentShape>(response);

		if (current.question === undefined) {
			break;
		}

		expect(
			(
				await call("attempts/answer", {
					questionId: current.question.id,
					selectedOptionPositions: [0],
				})
			).status,
		).toBe(200);
	}

	expect((await call("attempts/finish", {})).status).toBe(200);
};

const dueSets = (): Promise<DueSet[]> =>
	call(BOT_ROUTES.dueRepetitions, {}).then((response) =>
		json<DueSet[]>(response),
	);

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({ name: "app-review-due" });
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

describe.skipIf(!available)("reviewing only what is due", () => {
	let dueSetId: string;
	let freshSetId: string;
	let overdue: string[];

	test("two finished sets have schedules and nothing is due yet", async () => {
		expect(
			(
				await call("settings/update", {
					repetition: {
						scheduler: "ladder",
						intervalsDays: [1, 3, 7, 21],
						maxIntervalDays: 365,
						maxRepetitions: 8,
						desiredRetention: 0.9,
					},
				})
			).status,
		).toBe(200);

		dueSetId = await aSet(call, "Overdue", ["One?", "Two?", "Three?"], true);
		freshSetId = await aSet(call, "Fresh", ["Four?", "Five?"], true);

		await finishEveryQuestion(dueSetId);
		await finishEveryQuestion(freshSetId);

		expect(await dueSets()).toEqual([]);
	});

	test("moving two schedules into the past makes exactly that set due", async () => {
		overdue = (await questionIdsOf(dueSetId)).slice(0, 2);

		const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

		await sql`
			update review_states
			set due_at = ${yesterday}::timestamptz
			where question_id = any(${overdue}::uuid[])
		`;

		const due = await dueSets();

		expect(due.map((set) => set.quizSetId)).toEqual([dueSetId]);
		expect(due[0]?.dueCount).toBe(2);
		expect([...(due[0]?.dueQuestionIds ?? [])].toSorted()).toEqual(
			[...overdue].toSorted(),
		);
	});

	test("a due-only start on a set with nothing due is refused by name", async () => {
		const response = await call("attempts/start", {
			quizSetId: freshSetId,
			onlyDue: true,
		});

		expect(response.status).toBe(400);
		expect((await json<{ error: string }>(response)).error).toBe(
			"NothingDueError",
		);
	});

	test("a due-only start covers exactly the due questions", async () => {
		const [set] = await dueSets();
		const response = await call("attempts/start", {
			quizSetId: dueSetId,
			onlyDue: true,
		});

		expect(response.status).toBe(200);

		const current = await json<CurrentShape>(await call("attempts/current"));

		expect(set).toBeDefined();
		expect(current.question).toBeDefined();

		if (set === undefined || current.question === undefined) {
			return;
		}

		expect(current.total).toBe(set.dueCount);
		expect(overdue).toContain(current.question.id);
	});

	test("finishing it clears the day", async () => {
		for (;;) {
			const current = await json<CurrentShape>(await call("attempts/current"));

			if (current.question === undefined) {
				break;
			}

			expect(overdue).toContain(current.question.id);
			expect(
				(
					await call("attempts/answer", {
						questionId: current.question.id,
						selectedOptionPositions: [0],
					})
				).status,
			).toBe(200);
		}

		const finish = await call("attempts/finish", {});

		expect(finish.status).toBe(200);
		expect(
			(await json<{ scheduled: { questionId: string }[] }>(finish)).scheduled
				.map((entry) => entry.questionId)
				.toSorted(),
		).toEqual([...overdue].toSorted());
		expect(await dueSets()).toEqual([]);
	});
});
