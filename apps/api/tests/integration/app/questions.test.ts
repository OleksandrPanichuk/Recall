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
const BOT_TOKEN = "e".repeat(40);
const TELEGRAM_ID = 919191;

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

interface Row {
	readonly question: { id: string; prompt: string };
	readonly quizSetId: string;
	readonly setTitle: string;
	readonly setStatus: string;
	readonly answerCount: number;
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

const setWith = async (
	title: string,
	prompts: readonly string[],
	publish: boolean,
): Promise<string> => {
	const { quizSetId } = await json<{ quizSetId: string }>(
		await call("sets/create", { title, language: "uk" }),
	);

	await call("sets/questions/add", {
		quizSetId,
		questions: prompts.map(aQuestion),
	});

	if (publish) {
		await call("sets/publish", { quizSetId });
	}

	return quizSetId;
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("app-questions");
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

describe.skipIf(!available)("every question a session has written", () => {
	let published: string;

	test("nothing is listed before anything is written", async () => {
		expect(await json<Row[]>(await call("sets/questions/list"))).toEqual([]);
	});

	test("questions from every set are listed together", async () => {
		published = await setWith("Postgres", ["What is WAL?", "MVCC?"], true);
		await setWith("Bun", ["Which runtime?"], false);

		const rows = await json<Row[]>(await call("sets/questions/list"));

		expect(rows).toHaveLength(3);
		expect(new Set(rows.map((row) => row.setTitle))).toEqual(
			new Set(["Postgres", "Bun"]),
		);
	});

	test("a draft is listed too, and says so", async () => {
		const rows = await json<Row[]>(await call("sets/questions/list"));
		const draft = rows.find((row) => row.setTitle === "Bun");

		expect(draft?.setStatus).toBe("draft");
	});

	test("one set can be asked for on its own", async () => {
		const rows = await json<Row[]>(
			await call("sets/questions/list", { quizSetId: published }),
		);

		expect(rows).toHaveLength(2);
		expect(rows.every((row) => row.quizSetId === published)).toBe(true);
	});

	test("a question nobody has reached is counted at zero", async () => {
		const rows = await json<Row[]>(await call("sets/questions/list"));

		expect(rows.every((row) => row.answerCount === 0)).toBe(true);
	});

	test("and answering one moves its count, not the others'", async () => {
		await call("attempts/start", { quizSetId: published });

		const current = await json<{ question: { id: string } }>(
			await call("attempts/current"),
		);

		await call("attempts/answer", {
			questionId: current.question.id,
			selectedOptionPositions: [0],
		});

		const rows = await json<Row[]>(await call("sets/questions/list"));
		const answered = rows.filter((row) => row.answerCount > 0);

		expect(answered).toHaveLength(1);
		expect(answered[0]?.question.id).toBe(current.question.id);
	});
});
