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
const BOT_TOKEN = "f".repeat(40);
const TELEGRAM_ID = 929292;

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
	readonly attached: { id: string }[];
	readonly children: { id: string; itemCount: number }[];
}

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("app-move-quiz");
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
