import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import type { OwnerId } from "@/application/ports/owner";
import { createApplication } from "@/composition/create-application";
import { createApiApp } from "@/entrypoints/api";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedTelegramOwner,
} from "../../fixtures/postgres";

const available = await postgresAvailable();
const OWNER_TELEGRAM_ID = 987654321;

let harness: PostgresHarness;
let previousDatabaseUrl: string | undefined;
let previousTelegramUserId: string | undefined;
let app: INestApplication;
let origin: string;
let quizSetId: string;

const seed = async (databaseUrl: string, owner: OwnerId): Promise<string> => {
	const application = createApplication({ databaseUrl, owner });

	try {
		const { quizSetId: id } = await application.createQuizSet.execute({
			title: "Designing Data-Intensive Applications",
			language: "en",
		});

		await application.addQuestions.execute({
			quizSetId: id,
			questions: [
				{
					type: "single_choice",
					prompt: "What does replication buy you?",
					difficulty: "medium",
					options: [
						{ text: "Availability", isCorrect: true },
						{ text: "Smaller disks", isCorrect: false },
					],
				},
			],
		});

		await application.publishQuizSet.execute({ quizSetId: id });

		return String(id);
	} finally {
		await application.close();
	}
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("api");
	await applyMigration(harness);

	const owner = await seedTelegramOwner(harness, OWNER_TELEGRAM_ID);

	quizSetId = await seed(harness.url, owner);

	previousDatabaseUrl = process.env.DATABASE_URL;
	previousTelegramUserId = process.env.ALLOWED_TELEGRAM_USER_ID;
	process.env.DATABASE_URL = harness.url;
	process.env.ALLOWED_TELEGRAM_USER_ID = String(OWNER_TELEGRAM_ID);
	app = await createApiApp();
	await app.listen(0, "127.0.0.1");

	const address = app.getHttpServer().address() as AddressInfo;
	origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
	await app?.close();
	await harness?.close();

	if (previousDatabaseUrl === undefined) {
		delete process.env.DATABASE_URL;
	} else {
		process.env.DATABASE_URL = previousDatabaseUrl;
	}

	if (previousTelegramUserId === undefined) {
		delete process.env.ALLOWED_TELEGRAM_USER_ID;
	} else {
		process.env.ALLOWED_TELEGRAM_USER_ID = previousTelegramUserId;
	}
});

describe.skipIf(!available)("the api", () => {
	test("reports that it is live", async () => {
		const response = await fetch(`${origin}/health/live`);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok" });
	});

	test("lists the published quizzes", async () => {
		const response = await fetch(`${origin}/quizzes`);
		const body = (await response.json()) as readonly {
			id: string;
			title: string;
			questionCount: number;
		}[];

		expect(response.status).toBe(200);
		expect(body).toHaveLength(1);
		expect(body[0]?.title).toBe("Designing Data-Intensive Applications");
		expect(body[0]?.questionCount).toBe(1);
	});

	test("serves one quiz by id", async () => {
		const response = await fetch(`${origin}/quizzes/${quizSetId}`);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: quizSetId,
			language: "en",
			status: "published",
		});
	});

	test("maps a missing quiz to 404 rather than 500", async () => {
		const response = await fetch(`${origin}/quizzes/does-not-exist`);

		expect(response.status).toBe(404);
		expect(await response.json()).toMatchObject({
			statusCode: 404,
			error: "QuizSetNotFoundError",
		});
	});

	test("publishes an OpenAPI document", async () => {
		const response = await fetch(`${origin}/docs-json`);
		const document = (await response.json()) as {
			openapi: string;
			paths: Record<string, unknown>;
		};

		expect(response.status).toBe(200);
		expect(document.openapi).toStartWith("3.");
		expect(Object.keys(document.paths)).toContain("/quizzes");
	});
});
