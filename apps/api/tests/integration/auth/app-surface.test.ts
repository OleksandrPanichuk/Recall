import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { drizzle } from "drizzle-orm/postgres-js";
import { toOwnerId } from "@/application/ports/owner";
import { createUseCases } from "@/composition/create-application";
import { createApiApp } from "@/entrypoints/api";
import { identifierFor } from "@/modules/auth/telegram-link.plugin";
import { verification } from "@/persistence/postgres/auth-schema";
import * as schema from "@/persistence/postgres/schema";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedOwner,
	seedTelegramOwner,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

const OWNER_TELEGRAM_ID = 515151;
const overrides: { name: string; previous: string | undefined }[] = [];

const override = (name: string, value: string | undefined): void => {
	overrides.push({ name, previous: process.env[name] });

	if (value === undefined) {
		delete process.env[name];
	} else {
		process.env[name] = value;
	}
};

let harness: PostgresHarness;
let app: INestApplication;
let origin: string;
let mineOwner: string;
let theirsOwner: string;
let mineCookie: string;
let theirsCookie: string;

const signIn = async (owner: string): Promise<string> => {
	const token = randomUUID();
	const db = drizzle({ client: harness.client, schema });

	await db.insert(verification).values({
		id: randomUUID(),
		identifier: identifierFor(token),
		value: owner,
		expiresAt: new Date(Date.now() + 60_000),
	});

	const response = await fetch(
		`${origin}/api/auth/telegram/verify?token=${token}`,
		{ redirect: "manual" },
	);

	return response.headers
		.getSetCookie()
		.map((entry) => entry.split(";")[0])
		.join("; ");
};

const call = (
	route: string,
	cookie: string | undefined,
	body: unknown = {},
): Promise<Response> =>
	fetch(`${origin}/app/${route}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...(cookie === undefined ? {} : { cookie }),
		},
		body: JSON.stringify(body),
	});

const seedQuiz = async (owner: string, title: string): Promise<void> => {
	const db = drizzle({ client: harness.client, schema });
	const application = createUseCases({
		unitOfWork: createPostgresUnitOfWork(db, toOwnerId(owner)),
		scope: readOnlyScope(db, toOwnerId(owner)),
		clock: { now: () => new Date() },
		idGenerator: { generate: () => randomUUID() },
		timezone: "UTC",
	});
	const { quizSetId } = await application.createQuizSet.execute({
		title,
		language: "en",
	});

	await application.addQuestions.execute({
		quizSetId,
		questions: [
			{
				type: "single_choice",
				prompt: `Question in ${title}`,
				difficulty: "medium",
				options: [
					{ text: "Right", isCorrect: true },
					{ text: "Wrong", isCorrect: false },
				],
			},
		],
	});
	await application.publishQuizSet.execute({ quizSetId });
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("app-surface");
	await applyMigration(harness);

	const mine = await seedTelegramOwner(harness, OWNER_TELEGRAM_ID);
	const theirs = await seedOwner(harness, "somebody else");

	mineOwner = String(mine);
	theirsOwner = String(theirs);

	await seedQuiz(mineOwner, "Mine");
	await seedQuiz(theirsOwner, "Theirs");

	override("DATABASE_URL", harness.url);
	override("BETTER_AUTH_SECRET", "s".repeat(40));
	override("ALLOWED_TELEGRAM_USER_ID", String(OWNER_TELEGRAM_ID));
	override("BOT_API_TOKEN", undefined);

	app = await createApiApp();
	await app.listen(0, "127.0.0.1");

	const address = app.getHttpServer().address() as AddressInfo;

	origin = `http://127.0.0.1:${address.port}`;
	process.env.BETTER_AUTH_URL = origin;

	mineCookie = await signIn(String(mine));
	theirsCookie = await signIn(String(theirs));
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

describe.skipIf(!available)("the app surface, behind a session", () => {
	test("refuses a request with no session", async () => {
		expect((await call("browse", undefined)).status).toBe(401);
	});

	test("refuses a session token that was never issued", async () => {
		const response = await call(
			"browse",
			"better-auth.session_token=not-a-real-token",
		);

		expect(response.status).toBe(401);
	});

	test("serves the signed-in user their own library", async () => {
		const response = await call("browse", mineCookie);
		const body = (await response.json()) as { sets: { title: string }[] };

		expect(response.status).toBe(200);
		expect(body.sets.map((set) => set.title)).toEqual(["Mine"]);
	});

	test("serves a second user their own, on the same endpoint", async () => {
		const body = (await (await call("browse", theirsCookie)).json()) as {
			sets: { title: string }[];
		};

		expect(body.sets.map((set) => set.title)).toEqual(["Theirs"]);
	});

	test("runs a whole practice cycle for the signed-in user", async () => {
		const browse = (await (await call("browse", mineCookie)).json()) as {
			sets: { id: string }[];
		};
		const quizSetId = browse.sets[0]?.id;

		expect(
			(await call("attempts/start", mineCookie, { quizSetId })).status,
		).toBe(200);

		const current = (await (
			await call("attempts/current", mineCookie)
		).json()) as { question: { id: string; options: { id: string }[] } };

		expect(current.question).toBeDefined();

		const answered = (await (
			await call("attempts/answer", mineCookie, {
				questionId: current.question.id,
				selectedOptionPositions: [0],
			})
		).json()) as { isCorrect: boolean };

		expect(answered.isCorrect).toBe(true);

		const finished = (await (
			await call("attempts/finish", mineCookie)
		).json()) as { score: { correct: number } };

		expect(finished.score.correct).toBe(1);
	});

	test("accepts a typed answer, which the web app sends as text", async () => {
		const db = drizzle({ client: harness.client, schema });
		const application = createUseCases({
			unitOfWork: createPostgresUnitOfWork(db, toOwnerId(mineOwner)),
			scope: readOnlyScope(db, toOwnerId(mineOwner)),
			clock: { now: () => new Date() },
			idGenerator: { generate: () => randomUUID() },
			timezone: "UTC",
		});
		const { quizSetId } = await application.createQuizSet.execute({
			title: "Typed",
			language: "en",
		});

		await application.addQuestions.execute({
			quizSetId,
			questions: [
				{
					type: "typed_answer",
					prompt: "What does WAL stand for?",
					difficulty: "medium",
					options: [{ text: "write-ahead log", isCorrect: true }],
				},
			],
		});
		await application.publishQuizSet.execute({ quizSetId });
		await call("attempts/finish", mineCookie);
		await call("attempts/start", mineCookie, { quizSetId: String(quizSetId) });

		const current = (await (
			await call("attempts/current", mineCookie)
		).json()) as { question: { id: string; type: string } };

		expect(current.question.type).toBe("typed_answer");

		const answered = (await (
			await call("attempts/answer", mineCookie, {
				questionId: current.question.id,
				typedAnswer: "write-ahead log",
			})
		).json()) as { isCorrect: boolean };

		expect(answered.isCorrect).toBe(true);

		await call("attempts/finish", mineCookie);
	});

	test("the other user's attempt is invisible here", async () => {
		expect((await call("attempts/current", theirsCookie)).status).toBe(204);
	});

	test("one user cannot open the other's attempt by id", async () => {
		const statistics = (await (
			await call("statistics", mineCookie, {
				quizSetId: (
					(await (await call("browse", mineCookie)).json()) as {
						sets: { id: string }[];
					}
				).sets[0]?.id,
			})
		).json()) as { attempts: { attemptId: string }[] };
		const attemptId = statistics.attempts[0]?.attemptId;

		expect(attemptId).toBeString();
		expect(
			(await call("attempts/detail", mineCookie, { attemptId })).status,
		).toBe(200);
		expect(
			(await call("attempts/detail", theirsCookie, { attemptId })).status,
		).toBe(404);
	});
});
