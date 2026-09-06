import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	type AppSession,
	bodyOf as json,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";
import { aQuestion } from "../../fixtures/app-shapes";

const available = await postgresAvailable();

let session: AppSession;
let call: AppSession["app"];

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({ name: "app-authoring" });
	call = session.app;
});

afterAll(async () => {
	await session?.close();
});

describe.skipIf(!available)("writing a quiz from the web", () => {
	let quizSetId: string;
	let questionId: string;

	test("a session can create a set", async () => {
		const response = await call("sets/create", {
			title: "Bun basics",
			language: "uk",
			description: "written from the browser",
		});

		expect(response.status).toBe(200);

		quizSetId = (await json<{ quizSetId: string }>(response)).quizSetId;

		expect(quizSetId.length).toBeGreaterThan(10);
	});

	test("it starts as a draft nobody can practise", async () => {
		const detail = await json<{ status: string; questions: unknown[] }>(
			await call("sets/get", { quizSetId }),
		);

		expect(detail.status).toBe("draft");
		expect(detail.questions).toHaveLength(0);
	});

	test("questions go in as a batch", async () => {
		const response = await call("sets/questions/add", {
			quizSetId,
			questions: [aQuestion("What runs this?"), aQuestion("And this?")],
		});

		expect(response.status).toBe(200);

		const added = await json<{
			addedQuestionIds: string[];
			alreadyPresent: boolean;
		}>(response);

		expect(added.addedQuestionIds).toHaveLength(2);
		expect(added.alreadyPresent).toBe(false);

		questionId = added.addedQuestionIds[0] as string;
	});

	test("sending the same batch again adds nothing", async () => {
		const added = await json<{ alreadyPresent: boolean }>(
			await call("sets/questions/add", {
				quizSetId,
				questions: [aQuestion("What runs this?"), aQuestion("And this?")],
			}),
		);

		expect(added.alreadyPresent).toBe(true);

		const detail = await json<{ questions: unknown[] }>(
			await call("sets/get", { quizSetId }),
		);

		expect(detail.questions).toHaveLength(2);
	});

	test("a question can be reworded without losing its id", async () => {
		expect(
			(
				await call("sets/questions/update", {
					quizSetId,
					questionId,
					prompt: "Which runtime runs this?",
				})
			).status,
		).toBe(204);

		const detail = await json<{
			questions: { id: string; prompt: string }[];
		}>(await call("sets/get", { quizSetId }));
		const reworded = detail.questions.find(
			(question) => question.id === questionId,
		);

		expect(reworded?.prompt).toBe("Which runtime runs this?");
	});

	test("the set can be published, and then it is listed", async () => {
		expect((await call("sets/publish", { quizSetId })).status).toBe(204);

		const listed = await json<{ id: string; status: string }[]>(
			await call("sets/list", {}),
		);

		expect(listed.find((summary) => summary.id === quizSetId)?.status).toBe(
			"published",
		);
	});

	test("a question can be deleted, and the rest stay", async () => {
		const gone = await json<{ questionId: string; remaining: number }>(
			await call("sets/questions/delete", { quizSetId, questionId }),
		);

		expect(gone.questionId).toBe(questionId);
		expect(gone.remaining).toBe(1);
	});

	test("archiving takes it out of the list a learner sees", async () => {
		expect((await call("sets/archive", { quizSetId })).status).toBe(204);

		const published = await json<{ id: string }[]>(await call("sets/list", {}));

		expect(
			published.find((summary) => summary.id === quizSetId),
		).toBeUndefined();
	});

	test("but its author can still find it", async () => {
		const everything = await json<{ id: string; status: string }[]>(
			await call("sets/list", { includeUnpublished: true }),
		);

		expect(everything.find((summary) => summary.id === quizSetId)?.status).toBe(
			"archived",
		);
	});
});

describe.skipIf(!available)("what the api refuses", () => {
	test("a question whose type does not match its answers", async () => {
		const { quizSetId } = await json<{ quizSetId: string }>(
			await call("sets/create", { title: "Refusals", language: "uk" }),
		);
		const response = await call("sets/questions/add", {
			quizSetId,
			questions: [
				{
					type: "matching",
					prompt: "match these",
					difficulty: "easy",
					options: [
						{ text: "a", isCorrect: true },
						{ text: "b", isCorrect: false },
					],
				},
			],
		});

		expect(response.status).toBe(400);
	});

	test("no session at all", async () => {
		const response = await fetch(`${session.origin}/app/sets/create`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "Nobody", language: "uk" }),
		});

		expect(response.ok).toBe(false);
	});
});
