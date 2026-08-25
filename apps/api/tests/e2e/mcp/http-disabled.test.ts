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

let harness: PostgresHarness;
let app: INestApplication;
let origin: string;
let previousDatabaseUrl: string | undefined;
let previousToken: string | undefined;

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("mcp-disabled");
	await applyMigration(harness);

	previousDatabaseUrl = process.env.DATABASE_URL;
	previousToken = process.env.MCP_HTTP_TOKEN;
	process.env.DATABASE_URL = harness.url;
	delete process.env.MCP_HTTP_TOKEN;

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

	if (previousToken === undefined) {
		delete process.env.MCP_HTTP_TOKEN;
	} else {
		process.env.MCP_HTTP_TOKEN = previousToken;
	}
});

describe.skipIf(!available)("the api without an mcp token", () => {
	test("does not serve the mcp surface", async () => {
		const response = await fetch(`${origin}/mcp`, { method: "POST" });

		expect(response.status).toBe(404);
	});

	test("still serves everything else", async () => {
		expect((await fetch(`${origin}/health/live`)).status).toBe(200);
		expect((await fetch(`${origin}/quizzes`)).status).toBe(200);
	});
});
