import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createApiApp } from "@/entrypoints/api";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "../../fixtures/postgres";

const available = await postgresAvailable();
const BOT_TOKEN = "c".repeat(40);
const TELEGRAM_ID = 717171;

const overrides: { name: string; previous: string | undefined }[] = [];

const override = (name: string, value: string): void => {
	overrides.push({ name, previous: process.env[name] });
	process.env[name] = value;
};

let harness: PostgresHarness;
let app: INestApplication;
let origin: string;
let cookie: string;

const bot = (path: string, body: unknown): Promise<Response> =>
	fetch(`${origin}/bot/${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${BOT_TOKEN}`,
		},
		body: JSON.stringify(body),
	});

const call = (path: string, body: unknown = {}): Promise<Response> =>
	fetch(`${origin}/app/${path}`, {
		method: "POST",
		headers: { "content-type": "application/json", cookie },
		body: JSON.stringify(body),
	});

const json = async <TBody>(response: Response): Promise<TBody> =>
	(await response.json()) as TBody;

interface Browse {
	readonly sets: { id: string }[];
	readonly attached: { id: string; title: string }[];
}

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("app-attach-quiz");
	await applyMigration(harness);

	override("DATABASE_URL", harness.url);
	override("BOT_API_TOKEN", BOT_TOKEN);
	override("BETTER_AUTH_SECRET", "s".repeat(40));
	override("ALLOWED_TELEGRAM_USER_ID", String(TELEGRAM_ID));
	override("AUTH_RATE_LIMIT", "off");

	app = await createApiApp();
	await app.listen(0, "127.0.0.1");

	const address = app.getHttpServer().address() as AddressInfo;

	origin = `http://127.0.0.1:${address.port}`;
	process.env.BETTER_AUTH_URL = origin;

	const { url } = await json<{ url: string }>(
		await bot("auth/login-link", { telegramUserId: TELEGRAM_ID }),
	);
	const verified = await fetch(url.replace(/^https?:\/\/[^/]+/, origin), {
		redirect: "manual",
	});

	cookie = (verified.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
});

afterAll(async () => {
	await app?.close();
	await harness?.close();

	for (const { name, previous } of overrides.reverse()) {
		if (previous === undefined) {
			delete process.env[name];
		} else {
			process.env[name] = previous;
		}
	}
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
