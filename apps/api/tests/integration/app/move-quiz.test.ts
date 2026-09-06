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

	session = await openAppSession({ name: "app-move-quiz" });
	call = session.app;
});

afterAll(async () => {
	await session?.close();
});

describe.skipIf(!available)("filing a quiz set into a page", () => {
	let folderId: string;
	let quizSetId: string;

	test("a published set starts outside every page", async () => {
		folderId = (
			await json<{ folderId: string }>(
				await call("pages/create", { name: "Databases" }),
			)
		).folderId;
		quizSetId = (
			await json<{ quizSetId: string }>(
				await call("sets/create", { title: "Postgres", language: "uk" }),
			)
		).quizSetId;

		await call("sets/questions/add", {
			quizSetId,
			questions: [
				{
					type: "single_choice",
					prompt: "What is WAL?",
					difficulty: "easy",
					options: [
						{ text: "a log", isCorrect: true },
						{ text: "a lock", isCorrect: false },
					],
				},
			],
		});
		await call("sets/publish", { quizSetId });

		const root = await json<Browse>(await call("browse", {}));

		expect(root.sets.map((set) => set.id)).toContain(quizSetId);
	});

	test("moving it in files it, which is not the same as attaching", async () => {
		expect((await call("sets/move", { quizSetId, folderId })).status).toBe(204);

		const page = await json<Browse>(await call("browse", { folderId }));

		expect(page.sets.map((set) => set.id)).toEqual([quizSetId]);
		expect(page.attached).toHaveLength(0);
	});

	test("and it leaves the library root", async () => {
		const root = await json<Browse>(await call("browse", {}));

		expect(root.sets.map((set) => set.id)).not.toContain(quizSetId);
		expect(
			root.children.find((child) => child.id === folderId)?.itemCount,
		).toBe(1);
	});

	test("moving it back out returns it to the root", async () => {
		expect((await call("sets/move", { quizSetId })).status).toBe(204);

		const root = await json<Browse>(await call("browse", {}));
		const page = await json<Browse>(await call("browse", { folderId }));

		expect(root.sets.map((set) => set.id)).toContain(quizSetId);
		expect(page.sets).toHaveLength(0);
	});

	test("a page that does not exist is refused by name", async () => {
		const response = await call("sets/move", {
			quizSetId,
			folderId: "00000000-0000-4000-8000-000000000000",
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect((await json<{ error: string }>(response)).error).toBe(
			"FolderNotFoundError",
		);
	});
});
