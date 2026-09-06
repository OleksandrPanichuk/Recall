import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	type AppSession,
	bodyOf as json,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";
import type { BrowseShape as Browse } from "../../fixtures/app-shapes";

const available = await postgresAvailable();

let session: AppSession;
let call: AppSession["app"];

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({ name: "app-attach-quiz" });
	call = session.app;
});

afterAll(async () => {
	await session?.close();
});

describe.skipIf(!available)("linking a quiz to a page from the web", () => {
	let folderId: string;
	let quizSetId: string;

	test("a page and a quiz start unrelated", async () => {
		folderId = (
			await json<{ folderId: string }>(
				await call("pages/create", { name: "Runtimes" }),
			)
		).folderId;
		quizSetId = (
			await json<{ quizSetId: string }>(
				await call("sets/create", { title: "Bun basics", language: "uk" }),
			)
		).quizSetId;

		await call("sets/questions/add", {
			quizSetId,
			questions: [
				{
					type: "single_choice",
					prompt: "Which runtime runs this?",
					difficulty: "easy",
					options: [
						{ text: "bun", isCorrect: true },
						{ text: "deno", isCorrect: false },
					],
				},
			],
		});
		await call("sets/publish", { quizSetId });

		const view = await json<Browse>(await call("browse", { folderId }));

		expect(view.attached).toHaveLength(0);
		expect(view.sets).toHaveLength(0);
	});

	test("attaching answers with both names", async () => {
		const response = await call("pages/quizzes/attach", {
			folderId,
			quizSetId,
		});

		expect(response.status).toBe(200);

		const attached = await json<{
			folderId: string;
			folderName: string;
			quizSetId: string;
			title: string;
		}>(response);

		expect(attached).toEqual({
			folderId,
			folderName: "Runtimes",
			quizSetId,
			title: "Bun basics",
		});
	});

	test("and the page then browses with it attached", async () => {
		const view = await json<Browse>(await call("browse", { folderId }));

		expect(view.attached.map((set) => set.id)).toEqual([quizSetId]);
		expect(view.sets).toHaveLength(0);
	});

	test("attaching the same quiz twice leaves one link", async () => {
		expect(
			(await call("pages/quizzes/attach", { folderId, quizSetId })).status,
		).toBe(200);

		const view = await json<Browse>(await call("browse", { folderId }));

		expect(view.attached).toHaveLength(1);
	});

	test("detaching removes the link and keeps the quiz", async () => {
		const detached = await json<{
			folderId: string;
			folderName: string;
			quizSetId: string;
		}>(await call("pages/quizzes/detach", { folderId, quizSetId }));

		expect(detached).toEqual({
			folderId,
			folderName: "Runtimes",
			quizSetId,
		});

		const view = await json<Browse>(await call("browse", { folderId }));

		expect(view.attached).toHaveLength(0);

		const sets = await json<{ id: string }[]>(
			await call("sets/list", { includeUnpublished: true }),
		);

		expect(sets.map((set) => set.id)).toContain(quizSetId);
	});

	test("a quiz that does not exist is refused by name", async () => {
		const response = await call("pages/quizzes/attach", {
			folderId,
			quizSetId: "00000000-0000-4000-8000-000000000000",
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect((await json<{ error: string }>(response)).error).toBe(
			"QuizSetNotFoundError",
		);
	});
});
