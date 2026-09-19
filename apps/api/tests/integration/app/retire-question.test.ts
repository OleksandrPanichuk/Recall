import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	BOT_ROUTES,
	type DueSet,
	type LeechView,
	type RetiredView,
} from "@recall/contracts";
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

const currentQuestionId = async (): Promise<string> =>
	(await json<CurrentShape>(await call("attempts/current"))).question
		?.id as string;

const answer = (questionId: string, position: number): Promise<Response> =>
	call("attempts/answer", { questionId, selectedOptionPositions: [position] });

const leeches = (): Promise<LeechView[]> =>
	call(BOT_ROUTES.leeches, { threshold: 1 }).then((response) =>
		json<LeechView[]>(response),
	);

const retired = (): Promise<RetiredView[]> =>
	call(BOT_ROUTES.retired, {}).then((response) =>
		json<RetiredView[]>(response),
	);

const dueCount = async (): Promise<number> =>
	(await json<DueSet[]>(await call(BOT_ROUTES.dueRepetitions, {}))).reduce(
		(total, set) => total + set.dueCount,
		0,
	);

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({ name: "app-retire-question" });
	call = session.app;
});

afterAll(async () => {
	await session?.close();
});

describe.skipIf(!available)("retiring a stuck question", () => {
	let quizSetId: string;
	let missed: string;

	test("a wrong answer in a full attempt makes the question stuck and due", async () => {
		quizSetId = await aSet(call, "Retire", ["First?", "Second?"], true);

		expect((await call("attempts/start", { quizSetId })).status).toBe(200);

		missed = await currentQuestionId();

		expect((await answer(missed, 1)).status).toBe(200);
		expect((await answer(await currentQuestionId(), 0)).status).toBe(200);
		expect((await call("attempts/finish", {})).status).toBe(200);

		expect((await leeches()).map((leech) => leech.questionId)).toEqual([
			missed,
		]);
		expect(await dueCount()).toBe(0);
		expect(await retired()).toEqual([]);
	});

	test("retiring it takes it off the stuck list and into the retired one", async () => {
		const response = await call(BOT_ROUTES.retireQuestion, {
			questionId: missed,
			retired: true,
		});

		expect(response.status).toBe(200);
		expect(await json<unknown>(response)).toEqual({
			questionId: missed,
			retired: true,
		});

		expect(await leeches()).toEqual([]);
		expect(await dueCount()).toBe(0);

		const [entry] = await retired();

		expect(entry?.questionId).toBe(missed);
		expect(entry?.quizSetId).toBe(quizSetId);
		expect(entry?.quizSetTitle).toBe("Retire");
		expect(entry?.prompt).toBe("First?");
		expect(Number.isNaN(Date.parse(entry?.retiredAt ?? ""))).toBe(false);
	});

	test("bringing it back makes it due at once", async () => {
		const response = await call(BOT_ROUTES.retireQuestion, {
			questionId: missed,
			retired: false,
		});

		expect(response.status).toBe(200);
		expect(await json<unknown>(response)).toEqual({
			questionId: missed,
			retired: false,
		});

		expect(await retired()).toEqual([]);
		expect(await dueCount()).toBe(1);
		expect((await leeches()).map((leech) => leech.questionId)).toEqual([
			missed,
		]);
	});

	test("a question no set holds is refused by name", async () => {
		const response = await call(BOT_ROUTES.retireQuestion, {
			questionId: crypto.randomUUID(),
			retired: true,
		});

		expect(response.status).toBe(404);
		expect((await json<{ error: string }>(response)).error).toBe(
			"QuestionNotFoundError",
		);
	});

	test("selected mode practises exactly that one question", async () => {
		const response = await call("attempts/practice", {
			quizSetId,
			mode: "selected",
			questionIds: [missed],
		});

		expect(response.status).toBe(200);

		const practice = await json<{
			questionCount: number;
			currentQuestionId?: string;
		}>(response);

		expect(practice.questionCount).toBe(1);
		expect(practice.currentQuestionId).toBe(missed);

		expect((await call("attempts/abandon", {})).status).toBe(200);
	});

	test("selected mode without ids is a bad request", async () => {
		const response = await call("attempts/practice", {
			quizSetId,
			mode: "selected",
		});

		expect(response.status).toBe(400);
	});
});
