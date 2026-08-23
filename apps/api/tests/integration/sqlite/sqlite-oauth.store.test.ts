import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDrizzleClient } from "@/adapters/persistence/sqlite/database";
import { createSqliteOAuthStore } from "@/adapters/persistence/sqlite/repositories/sqlite-oauth.store";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";
import {
	type OAuthStore,
	TokenKind,
} from "@/infrastructure/auth/oauth-store.types";
import { openMigratedDatabase } from "./migrated-database";

const CODE = "code-abcdefghijklmnop";
const ACCESS = "access-abcdefghijklmnop";
const REFRESH = "refresh-abcdefghijklmnop";

let database: Database;
let store: OAuthStore;
let now: Date;

const codeData = (expiresAt: Date) => ({
	clientId: "client-1",
	codeChallenge: "challenge-1",
	redirectUri: "https://claude.ai/callback",
	resource: "https://quiz.example.com/mcp",
	scopes: ["offline_access"],
	expiresAt,
});

beforeEach(() => {
	database = openMigratedDatabase();
	now = new Date("2026-08-19T10:00:00.000Z");
	const client = createDrizzleClient(database);
	store = createSqliteOAuthStore(
		client,
		createSqliteTransaction(client),
		() => now,
	);
});

afterEach(() => {
	database.close();
});

describe("clients", () => {
	test("round-trips a registered client", () => {
		store.saveClient({ clientId: "client-1", document: '{"client_id":"c"}' });

		expect(store.findClient("client-1")?.document).toBe('{"client_id":"c"}');
	});

	test("has no client until one is registered", () => {
		expect(store.findClient("client-1")).toBeUndefined();
	});
});

describe("authorization codes", () => {
	test("round-trips a code with everything the exchange needs", () => {
		store.saveCode(CODE, codeData(new Date("2026-08-19T10:01:00.000Z")));

		const found = store.findCode(CODE);

		expect(found?.codeChallenge).toBe("challenge-1");
		expect(found?.redirectUri).toBe("https://claude.ai/callback");
		expect(found?.resource).toBe("https://quiz.example.com/mcp");
		expect(found?.scopes).toEqual(["offline_access"]);
	});

	test("reading a code does not spend it", () => {
		store.saveCode(CODE, codeData(new Date("2026-08-19T10:01:00.000Z")));

		store.findCode(CODE);

		expect(store.findCode(CODE)).toBeDefined();
	});

	test("a code can only be spent once", () => {
		store.saveCode(CODE, codeData(new Date("2026-08-19T10:01:00.000Z")));

		expect(store.consumeCode(CODE)).toBeDefined();
		expect(store.consumeCode(CODE)).toBeUndefined();
		expect(store.findCode(CODE)).toBeUndefined();
	});

	test("an expired code is already gone", () => {
		store.saveCode(CODE, codeData(new Date("2026-08-19T09:59:00.000Z")));

		expect(store.findCode(CODE)).toBeUndefined();
		expect(store.consumeCode(CODE)).toBeUndefined();
	});

	test("an unknown code is not found", () => {
		expect(store.findCode("never-issued")).toBeUndefined();
	});
});

describe("tokens", () => {
	const token = (expiresAt?: Date) => ({
		clientId: "client-1",
		scopes: ["offline_access"],
		expiresAt,
	});

	test("round-trips an access token", () => {
		store.saveToken(
			ACCESS,
			TokenKind.Access,
			token(new Date("2026-08-19T11:00:00.000Z")),
		);

		expect(store.findToken(ACCESS, TokenKind.Access)?.clientId).toBe(
			"client-1",
		);
	});

	test("does not answer for the wrong kind", () => {
		store.saveToken(ACCESS, TokenKind.Access, token());

		expect(store.findToken(ACCESS, TokenKind.Refresh)).toBeUndefined();
	});

	test("an expired access token is not usable", () => {
		store.saveToken(
			ACCESS,
			TokenKind.Access,
			token(new Date("2026-08-19T09:00:00.000Z")),
		);

		expect(store.findToken(ACCESS, TokenKind.Access)).toBeUndefined();
	});

	test("a refresh token without an expiry keeps working", () => {
		store.saveToken(REFRESH, TokenKind.Refresh, token());

		expect(store.findToken(REFRESH, TokenKind.Refresh)).toBeDefined();
	});

	test("a revoked token stops working", () => {
		store.saveToken(REFRESH, TokenKind.Refresh, token());

		store.revokeToken(REFRESH);

		expect(store.findToken(REFRESH, TokenKind.Refresh)).toBeUndefined();
	});
});

describe("what actually lands on disk", () => {
	test("stores hashes, so a leaked database yields no live credentials", () => {
		store.saveCode(CODE, codeData(new Date("2026-08-19T10:01:00.000Z")));
		store.saveToken(ACCESS, TokenKind.Access, {
			clientId: "client-1",
			scopes: [],
		});

		const dump = [
			...database.query("SELECT * FROM oauth_codes").all(),
			...database.query("SELECT * FROM oauth_tokens").all(),
		]
			.map((row) => JSON.stringify(row))
			.join("\n");

		expect(dump).not.toContain(CODE);
		expect(dump).not.toContain(ACCESS);
		expect(dump.length).toBeGreaterThan(0);
	});
});
