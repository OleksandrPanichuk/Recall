import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { openMigratedDatabase } from "@tests/fixtures/oauth-database";
import type { Response } from "express";
import { createDrizzleClient } from "@/adapters/persistence/sqlite/database";
import { createSqliteOAuthStore } from "@/adapters/persistence/sqlite/repositories/sqlite-oauth.store";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";
import { createOAuthProvider, type RecallOAuth } from "./provider";

const STATIC_TOKEN = "s".repeat(40);
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

let database: Database;
let oauth: RecallOAuth;
let now: Date;

const clientOf = async (redirectUris = [REDIRECT]) =>
	(await oauth.provider.clientsStore.registerClient?.({
		client_name: "ChatGPT",
		redirect_uris: redirectUris,
	} as never)) as { client_id: string; redirect_uris: string[] };

const redirectFrom = async (
	client: { client_id: string },
	state = "state-1",
): Promise<string> => {
	let target = "";
	const res = {
		redirect: (url: string) => {
			target = url;
		},
	} as unknown as Response;

	await oauth.provider.authorize(
		client as never,
		{
			state,
			scopes: ["offline_access"],
			codeChallenge: "challenge-1",
			redirectUri: REDIRECT,
		},
		res,
	);

	return target;
};

const pendingIdOf = (target: string): string =>
	new URL(target, "https://quiz.example.com").searchParams.get(
		"pending",
	) as string;

const codeFor = async (client: { client_id: string }): Promise<string> => {
	const pending = pendingIdOf(await redirectFrom(client));
	const approved = oauth.consent.approve(pending) as string;

	return new URL(approved).searchParams.get("code") as string;
};

beforeEach(() => {
	database = openMigratedDatabase();
	now = new Date("2026-08-19T10:00:00.000Z");
	const client = createDrizzleClient(database);
	oauth = createOAuthProvider({
		store: createSqliteOAuthStore(
			client,
			createSqliteTransaction(client),
			() => now,
		),
		staticToken: STATIC_TOKEN,
		now: () => now,
	});
});

afterEach(() => {
	database.close();
});

describe("client registration", () => {
	test("registers a client and finds it again", async () => {
		const client = await clientOf();

		expect(client.client_id).toBeTruthy();
		expect(
			(await oauth.provider.clientsStore.getClient(client.client_id))
				?.redirect_uris,
		).toEqual([REDIRECT]);
	});

	test("has no client before registration", async () => {
		expect(
			await oauth.provider.clientsStore.getClient("ghost"),
		).toBeUndefined();
	});
});

describe("authorization", () => {
	test("sends the browser to the consent page, not to the client", async () => {
		const target = await redirectFrom(await clientOf());

		expect(target).toContain("/consent");
		expect(target).not.toContain("claude.ai");
	});

	test("approving returns to the client with a code and the state", async () => {
		const client = await clientOf();
		const pending = pendingIdOf(await redirectFrom(client, "state-xyz"));

		const approved = new URL(oauth.consent.approve(pending) as string);

		expect(approved.origin + approved.pathname).toBe(REDIRECT);
		expect(approved.searchParams.get("state")).toBe("state-xyz");
		expect(approved.searchParams.get("code")).toBeTruthy();
	});

	test("a pending authorization can only be approved once", async () => {
		const pending = pendingIdOf(await redirectFrom(await clientOf()));

		expect(oauth.consent.approve(pending)).toBeTruthy();
		expect(oauth.consent.approve(pending)).toBeUndefined();
	});

	test("an unknown pending id approves nothing", () => {
		expect(oauth.consent.approve("never-issued")).toBeUndefined();
	});
});

describe("the code exchange", () => {
	test("hands back the challenge the authorization began with", async () => {
		const client = await clientOf();
		const code = await codeFor(client);

		expect(
			await oauth.provider.challengeForAuthorizationCode(client as never, code),
		).toBe("challenge-1");
	});

	test("issues an access and a refresh token", async () => {
		const client = await clientOf();
		const tokens = await oauth.provider.exchangeAuthorizationCode(
			client as never,
			await codeFor(client),
		);

		expect(tokens.access_token).toBeTruthy();
		expect(tokens.refresh_token).toBeTruthy();
		expect(tokens.token_type).toBe("Bearer");
	});

	test("refuses to spend the same code twice", async () => {
		const client = await clientOf();
		const code = await codeFor(client);

		await oauth.provider.exchangeAuthorizationCode(client as never, code);

		await expect(
			oauth.provider.exchangeAuthorizationCode(client as never, code),
		).rejects.toThrow();
	});

	test("refuses a code that belongs to another client", async () => {
		const owner = await clientOf();
		const other = await clientOf();
		const code = await codeFor(owner);

		await expect(
			oauth.provider.exchangeAuthorizationCode(other as never, code),
		).rejects.toThrow();
	});

	test("refuses an expired code", async () => {
		const client = await clientOf();
		const code = await codeFor(client);
		now = new Date("2026-08-19T10:05:00.000Z");

		await expect(
			oauth.provider.exchangeAuthorizationCode(client as never, code),
		).rejects.toThrow();
	});
});

describe("refreshing", () => {
	test("issues a new pair and retires the old refresh token", async () => {
		const client = await clientOf();
		const first = await oauth.provider.exchangeAuthorizationCode(
			client as never,
			await codeFor(client),
		);

		const second = await oauth.provider.exchangeRefreshToken(
			client as never,
			first.refresh_token as string,
		);

		expect(second.access_token).not.toBe(first.access_token);
		await expect(
			oauth.provider.exchangeRefreshToken(
				client as never,
				first.refresh_token as string,
			),
		).rejects.toThrow();
	});

	test("refuses an unknown refresh token", async () => {
		const client = await clientOf();

		await expect(
			oauth.provider.exchangeRefreshToken(client as never, "never-issued"),
		).rejects.toThrow();
	});
});

describe("verifying an access token", () => {
	test("accepts one it issued", async () => {
		const client = await clientOf();
		const tokens = await oauth.provider.exchangeAuthorizationCode(
			client as never,
			await codeFor(client),
		);

		expect(
			(await oauth.provider.verifyAccessToken(tokens.access_token)).clientId,
		).toBe(client.client_id);
	});

	test("accepts the static token under its own client id", async () => {
		const info = await oauth.provider.verifyAccessToken(STATIC_TOKEN);

		expect(info.clientId).not.toBe("");
		expect(info.token).toBe(STATIC_TOKEN);
	});

	test("refuses a token it never issued", async () => {
		await expect(
			oauth.provider.verifyAccessToken("x".repeat(40)),
		).rejects.toThrow();
	});

	test("refuses an expired access token", async () => {
		const client = await clientOf();
		const tokens = await oauth.provider.exchangeAuthorizationCode(
			client as never,
			await codeFor(client),
		);
		now = new Date("2026-08-19T12:00:01.000Z");

		await expect(
			oauth.provider.verifyAccessToken(tokens.access_token),
		).rejects.toThrow();
	});

	test("refuses a revoked access token", async () => {
		const client = await clientOf();
		const tokens = await oauth.provider.exchangeAuthorizationCode(
			client as never,
			await codeFor(client),
		);

		await oauth.provider.revokeToken?.(client as never, {
			token: tokens.access_token,
		});

		await expect(
			oauth.provider.verifyAccessToken(tokens.access_token),
		).rejects.toThrow();
	});
});
