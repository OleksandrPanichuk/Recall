import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createApplication } from "@/composition/create-application";
import { createApiApp } from "@/entrypoints/api";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

let harness: PostgresHarness;
let previousDatabaseUrl: string | undefined;
let app: INestApplication;
let origin: string;
let quizSetId: string;

const seed = async (databaseUrl: string): Promise<string> => {
	const application = createApplication({ databaseUrl });

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

	quizSetId = await seed(harness.url);

	previousDatabaseUrl = process.env.DATABASE_URL;
	process.env.DATABASE_URL = harness.url;
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
