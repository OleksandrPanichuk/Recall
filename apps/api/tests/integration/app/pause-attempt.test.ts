import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	type AppSession,
	bodyOf as json,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";
import {
	aQuestion,
	type CurrentShape as Current,
} from "../../fixtures/app-shapes";

const available = await postgresAvailable();

let session: AppSession;
let call: AppSession["app"];

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({ name: "app-pause-attempt" });
	call = session.app;
});

afterAll(async () => {
	await session?.close();
});

describe.skipIf(!available)("stepping away from an attempt", () => {
	let quizSetId: string;
	let questionId: string;

	test("an attempt is running", async () => {
		quizSetId = (
			await json<{ quizSetId: string }>(
				await call("sets/create", { title: "Pausing", language: "uk" }),
			)
		).quizSetId;

		await call("sets/questions/add", {
			quizSetId,
			questions: [aQuestion("First?"), aQuestion("Second?")],
		});
		await call("sets/publish", { quizSetId });
		await call("attempts/start", { quizSetId });

		const current = await json<Current>(await call("attempts/current"));

		expect(current.status).toBe("active");

		questionId = current.question?.id as string;
	});

	test("pausing answers with no body at all", async () => {
		const response = await call("attempts/pause");

		expect(response.status).toBe(204);
		expect((await json<Current>(await call("attempts/current"))).status).toBe(
			"paused",
		);
	});

	test("a paused attempt refuses an answer instead of recording it", async () => {
		const response = await call("attempts/answer", {
			questionId,
			selectedOptionPositions: [0],
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect((await json<{ error: string }>(response)).error).toBe(
			"AttemptNotActiveError",
		);
	});

	test("pausing twice is not an error, it is already paused", async () => {
		expect((await call("attempts/pause")).status).toBe(204);
	});

	test("resuming hands back the question it stopped on", async () => {
		const resumed = await json<{
			attemptId: string;
			currentQuestionId?: string;
		}>(await call("attempts/resume"));

		expect(resumed.currentQuestionId).toBe(questionId);
		expect((await json<Current>(await call("attempts/current"))).status).toBe(
			"active",
		);
	});

	test("and the answer it refused is now taken", async () => {
		const response = await call("attempts/answer", {
			questionId,
			selectedOptionPositions: [0],
		});

		expect(response.status).toBe(200);
	});

	test("resuming with nothing open is refused by name", async () => {
		await call("attempts/abandon", {});

		const response = await call("attempts/resume");

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect((await json<{ error: string }>(response)).error).toBe(
			"NoActiveAttemptError",
		);
	});

	test("and so is pausing with nothing open", async () => {
		const response = await call("attempts/pause");

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect((await json<{ error: string }>(response)).error).toBe(
			"NoActiveAttemptError",
		);
	});
});
