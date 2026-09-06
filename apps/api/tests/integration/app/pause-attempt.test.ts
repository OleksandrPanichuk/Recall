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
const BOT_TOKEN = "d".repeat(40);
const TELEGRAM_ID = 818181;

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

interface Current {
	readonly attemptId: string;
	readonly status: string;
	readonly question?: { id: string };
	readonly index: number;
}

const aQuestion = (prompt: string) => ({
	type: "single_choice" as const,
	prompt,
	difficulty: "easy" as const,
	options: [
		{ text: "right", isCorrect: true },
		{ text: "wrong", isCorrect: false },
	],
});

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("app-pause-attempt");
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
