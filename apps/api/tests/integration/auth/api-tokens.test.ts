import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { drizzle } from "drizzle-orm/postgres-js";
import { createApiApp } from "@/entrypoints/api";
import { issueApiToken } from "@/persistence/postgres/api-tokens";
import * as schema from "@/persistence/postgres/schema";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedOwner,
	seedTelegramOwner,
} from "../../fixtures/postgres";
import {
	makeTempDirectory,
	removeTempDirectory,
} from "../../fixtures/temp-dir";

const available = await postgresAvailable();

const BOT_TOKEN = "b".repeat(40);
const MCP_TOKEN = "m".repeat(40);
const OWNER_TELEGRAM_ID = 606060;

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
let directory: string;
let mineToken: string;
let theirsToken: string;

const rpc = (
	token: string,
	method: string,
	params: Record<string, unknown> = {},
): Promise<Response> =>
	fetch(`${origin}/mcp`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
		},
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});

const listSets = async (token: string): Promise<string> => {
	const response = await rpc(token, "tools/call", {
		name: "quiz_list_sets",
		arguments: { includeUnpublished: true },
	});

	return JSON.stringify(await response.json());
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("api-tokens");
	await applyMigration(harness);
	directory = makeTempDirectory("recall-api-tokens-");

	const db = drizzle({ client: harness.client, schema });
	const mine = await seedTelegramOwner(harness, OWNER_TELEGRAM_ID);
	const theirs = await seedOwner(harness, "somebody else");

	mineToken = (await issueApiToken(db, { owner: mine, name: "mine" })).token;
	theirsToken = (await issueApiToken(db, { owner: theirs, name: "theirs" }))
		.token;

	override("DATABASE_URL", harness.url);
	override("BOT_API_TOKEN", BOT_TOKEN);
	override("MCP_HTTP_TOKEN", MCP_TOKEN);
	override("ALLOWED_TELEGRAM_USER_ID", String(OWNER_TELEGRAM_ID));
	override("MCP_HTTP_ALLOWED_HOST", undefined);
	override("MCP_OAUTH_ISSUER", undefined);
	override("MCP_OAUTH_PASSPHRASE", undefined);
	override("BETTER_AUTH_SECRET", undefined);

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

describe.skipIf(!available)("personal access tokens on the mcp surface", () => {
	test("a personal token reaches the tools", async () => {
		const response = await rpc(mineToken, "tools/list");

		expect(response.status).toBe(200);
		expect(JSON.stringify(await response.json())).toContain("quiz_create_set");
	});

	test("a made-up token does not", async () => {
		expect((await rpc("recall_pat_nonsense", "tools/list")).status).toBe(401);
	});

	test("the tools act on the token's owner, not the instance", async () => {
		const created = await rpc(mineToken, "tools/call", {
			name: "quiz_create_set",
			arguments: { title: "Mine alone", language: "en" },
		});

		expect(created.status).toBe(200);
		expect(await listSets(mineToken)).toContain("Mine alone");
		expect(await listSets(theirsToken)).not.toContain("Mine alone");
	});

	test("the static token still works, as the instance owner", async () => {
		expect(await listSets(MCP_TOKEN)).toContain("Mine alone");
	});

	test("a revoked token stops working", async () => {
		const issue = await fetch(`${origin}/bot/auth/tokens/issue`, {
			method: "POST",
			headers: {
				authorization: `Bearer ${BOT_TOKEN}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				telegramUserId: OWNER_TELEGRAM_ID,
				name: "throwaway",
			}),
		});
		const issued = (await issue.json()) as { id: string; token: string };

		expect((await rpc(issued.token, "tools/list")).status).toBe(200);

		const revoke = await fetch(`${origin}/bot/auth/tokens/revoke`, {
			method: "POST",
			headers: {
				authorization: `Bearer ${BOT_TOKEN}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				telegramUserId: OWNER_TELEGRAM_ID,
				tokenId: issued.id,
			}),
		});

		expect(await revoke.json()).toEqual({ revoked: true });
		expect((await rpc(issued.token, "tools/list")).status).toBe(401);
	});

	test("using a token records that it was used", async () => {
		const rows = await harness.client`
			select count(*)::int as n from api_tokens where last_used_at is not null
		`;

		expect(Number(rows[0]?.n ?? 0)).toBeGreaterThan(0);
	});

	test("the owner only sees their own tokens", async () => {
		const response = await fetch(`${origin}/bot/auth/tokens/list`, {
			method: "POST",
			headers: {
				authorization: `Bearer ${BOT_TOKEN}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ telegramUserId: OWNER_TELEGRAM_ID }),
		});
		const listed = (await response.json()) as { name: string }[];

		expect(listed.map((token) => token.name)).toContain("mine");
		expect(listed.map((token) => token.name)).not.toContain("theirs");
	});
});
