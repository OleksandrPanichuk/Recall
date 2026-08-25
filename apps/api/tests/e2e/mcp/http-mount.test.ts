import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { createApiApp } from "@/entrypoints/api";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedTelegramOwner,
} from "../../fixtures/postgres";
import {
	makeTempDirectory,
	removeTempDirectory,
} from "../../fixtures/temp-dir";

const available = await postgresAvailable();
const TOKEN = "e".repeat(40);

interface Restorable {
	readonly name: string;
	readonly previous: string | undefined;
}

const overrides: Restorable[] = [];

const override = (name: string, value: string | undefined): void => {
	overrides.push({ name, previous: process.env[name] });

	if (value === undefined) {
		delete process.env[name];
	} else {
		process.env[name] = value;
	}
};

let harness: PostgresHarness;
let directory: string;
let app: INestApplication;
let origin: string;

const ask = (token?: string): Promise<Response> =>
	fetch(`${origin}/mcp`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
			...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/list",
			params: {},
		}),
	});

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("mcp-mount");
	await applyMigration(harness);
	await seedTelegramOwner(harness, 42);
	directory = makeTempDirectory("recall-mcp-mount-");

	override("DATABASE_URL", harness.url);
	override("ALLOWED_TELEGRAM_USER_ID", "42");
	override("MCP_HTTP_TOKEN", TOKEN);
	override("OAUTH_DATABASE_PATH", join(directory, "oauth.sqlite"));
	// The port is chosen by the kernel, so an allowed host cannot be named ahead
	// of time. Dropping it turns dns rebinding protection off for this run.
	override("MCP_HTTP_ALLOWED_HOST", undefined);
	override("MCP_OAUTH_ISSUER", undefined);
	override("MCP_OAUTH_PASSPHRASE", undefined);

	app = await createApiApp();
	await app.listen(0, "127.0.0.1");

	const address = app.getHttpServer().address() as AddressInfo;
	origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
	await app?.close();
	await harness?.close();

	if (directory !== undefined) {
		removeTempDirectory(directory);
	}

	for (const { name, previous } of overrides.reverse()) {
		if (previous === undefined) {
			delete process.env[name];
		} else {
			process.env[name] = previous;
		}
	}
});

describe.skipIf(!available)("the mcp surface mounted on the api", () => {
	test("serves the tools, but only with the token", async () => {
		expect((await ask()).status).toBe(401);
		expect((await ask("w".repeat(40))).status).toBe(401);

		const allowed = await ask(TOKEN);

		expect(allowed.status).toBe(200);
		expect(JSON.stringify(await allowed.json())).toContain("quiz_create_set");
	});

	test("runs a tool against the same database the rest of the api uses", async () => {
		const created = await fetch(`${origin}/mcp`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
				authorization: `Bearer ${TOKEN}`,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 2,
				method: "tools/call",
				params: {
					name: "quiz_create_set",
					arguments: {
						title: "Mounted through nest",
						language: "en",
					},
				},
			}),
		});

		expect(created.status).toBe(200);

		const published = await fetch(`${origin}/mcp`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
				authorization: `Bearer ${TOKEN}`,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: {
					name: "quiz_list_sets",
					arguments: { includeUnpublished: true },
				},
			}),
		});

		expect(JSON.stringify(await published.json())).toContain(
			"Mounted through nest",
		);
	});

	test("leaves the rest of the api alone", async () => {
		expect((await fetch(`${origin}/health/live`)).status).toBe(200);
		expect((await fetch(`${origin}/quizzes`)).status).toBe(200);
	});
});
