import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	type AppSession,
	bodyOf as json,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";
import { aSet, type CurrentShape as Current } from "../../fixtures/app-shapes";

const available = await postgresAvailable();

let session: AppSession;
let call: AppSession["app"];

interface Practice {
	readonly attemptId: string;
	readonly currentQuestionId?: string;
	readonly questionCount: number;
	readonly topics: readonly string[];
}

const currentQuestionId = async (): Promise<string> =>
	(await json<Current>(await call("attempts/current"))).question?.id as string;

const answer = (questionId: string, position: number): Promise<Response> =>
	call("attempts/answer", { questionId, selectedOptionPositions: [position] });

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({ name: "app-practice-modes" });
	call = session.app;
});

afterAll(async () => {
	await session?.close();
});

describe.skipIf(!available)("retrying the ones that were missed", () => {
	let quizSetId: string;
	let missed: string;

	test("one of two questions is answered wrong", async () => {
		quizSetId = await aSet(call, "Modes", ["First?", "Second?"], true);

		await call("attempts/start", { quizSetId });

		missed = await currentQuestionId();

		const wrong = await answer(missed, 1);

		expect(wrong.status).toBe(200);
		expect((await json<{ isCorrect: boolean }>(wrong)).isCorrect).toBe(false);
		expect((await answer(await currentQuestionId(), 0)).status).toBe(200);
		expect((await call("attempts/finish", {})).status).toBe(200);
	});

	test("mistakes mode starts an attempt over exactly that question", async () => {
		const response = await call("attempts/practice", {
			quizSetId,
			mode: "mistakes",
		});

		expect(response.status).toBe(200);

		const practice = await json<Practice>(response);

		expect(practice.questionCount).toBe(1);
		expect(practice.currentQuestionId).toBe(missed);
		expect(await currentQuestionId()).toBe(missed);
	});

	test("once it is answered right there is nothing left to retry", async () => {
		expect((await answer(missed, 0)).status).toBe(200);
		expect((await call("attempts/finish", {})).status).toBe(200);

		const response = await call("attempts/practice", {
			quizSetId,
			mode: "mistakes",
		});

		expect(response.status).toBe(400);
		expect((await json<{ error: string }>(response)).error).toBe(
			"NothingToPracticeError",
		);
	});
});
