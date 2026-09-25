import { beforeEach, describe, expect, test } from "bun:test";
import { createMemoryOAuthStore } from "@tests/fixtures/memory-oauth.store";
import type { Response } from "express";
import { createOAuthProvider, type RecallOAuth } from "./provider";

const STATIC_TOKEN = "s".repeat(40);
const OWNER = "the-owner";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

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
	const approved = (await oauth.consent.approve(pending, OWNER)) as string;

	return new URL(approved).searchParams.get("code") as string;
};

beforeEach(() => {
	now = new Date("2026-08-19T10:00:00.000Z");
	oauth = createOAuthProvider({
		store: createMemoryOAuthStore(() => now),
		staticToken: STATIC_TOKEN,
		instanceOwner: async () => OWNER,
		now: () => now,
	});
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

		const approved = new URL(
			(await oauth.consent.approve(pending, OWNER)) as string,
		);

		expect(approved.origin + approved.pathname).toBe(REDIRECT);
		expect(approved.searchParams.get("state")).toBe("state-xyz");
		expect(approved.searchParams.get("code")).toBeTruthy();
	});

	test("a pending authorization can only be approved once", async () => {
		const pending = pendingIdOf(await redirectFrom(await clientOf()));

		expect(await oauth.consent.approve(pending, OWNER)).toBeTruthy();
		expect(await oauth.consent.approve(pending, OWNER)).toBeUndefined();
	});

	test("an unknown pending id approves nothing", async () => {
		expect(await oauth.consent.approve("never-issued", OWNER)).toBeUndefined();
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

	test("lets only one of two concurrent refreshes of the same token through", async () => {
		const client = await clientOf();
		const first = await oauth.provider.exchangeAuthorizationCode(
			client as never,
			await codeFor(client),
		);

		const outcomes = await Promise.allSettled([
			oauth.provider.exchangeRefreshToken(
				client as never,
				first.refresh_token as string,
			),
			oauth.provider.exchangeRefreshToken(
				client as never,
				first.refresh_token as string,
			),
		]);

		expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([
			"fulfilled",
			"rejected",
		]);
	});

	test("refuses a refresh that asks for a scope the grant never had", async () => {
		const client = await clientOf();
		const first = await oauth.provider.exchangeAuthorizationCode(
			client as never,
			await codeFor(client),
		);

		await expect(
			oauth.provider.exchangeRefreshToken(
				client as never,
				first.refresh_token as string,
				["offline_access", "admin"],
			),
		).rejects.toThrow();

		const kept = await oauth.provider.exchangeRefreshToken(
			client as never,
			first.refresh_token as string,
		);

		expect(kept.scope).toBe("offline_access");
	});

	test("lets a refresh keep a subset of the granted scopes", async () => {
		const client = await clientOf();
		const first = await oauth.provider.exchangeAuthorizationCode(
			client as never,
			await codeFor(client),
		);

		const narrowed = await oauth.provider.exchangeRefreshToken(
			client as never,
			first.refresh_token as string,
			["offline_access"],
		);

		expect(narrowed.scope).toBe("offline_access");
	});

	test("refuses a refresh token that lay unused past its lifetime", async () => {
		const client = await clientOf();
		const first = await oauth.provider.exchangeAuthorizationCode(
			client as never,
			await codeFor(client),
		);
		now = new Date("2026-09-19T10:00:01.000Z");

		await expect(
			oauth.provider.exchangeRefreshToken(
				client as never,
				first.refresh_token as string,
			),
		).rejects.toThrow();
	});

	test("a refresh gives the new refresh token a fresh lifetime", async () => {
		const client = await clientOf();
		const first = await oauth.provider.exchangeAuthorizationCode(
			client as never,
			await codeFor(client),
		);
		now = new Date("2026-09-10T10:00:00.000Z");

		const second = await oauth.provider.exchangeRefreshToken(
			client as never,
			first.refresh_token as string,
		);
		now = new Date("2026-09-30T10:00:00.000Z");

		expect(
			(
				await oauth.provider.exchangeRefreshToken(
					client as never,
					second.refresh_token as string,
				)
			).access_token,
		).toBeTruthy();
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

	test("a client cannot revoke a token issued to another client", async () => {
		const client = await clientOf();
		const stranger = await clientOf();
		const tokens = await oauth.provider.exchangeAuthorizationCode(
			client as never,
			await codeFor(client),
		);

		await oauth.provider.revokeToken?.(stranger as never, {
			token: tokens.access_token,
		});

		expect(
			(await oauth.provider.verifyAccessToken(tokens.access_token)).clientId,
		).toBe(client.client_id);
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

describe("the consent gate under repeated wrong passphrases", () => {
	test("keeps a pending request open for a few refusals, then cancels it", async () => {
		const pending = pendingIdOf(await redirectFrom(await clientOf()));

		for (let attempt = 1; attempt < 5; attempt += 1) {
			expect(oauth.consent.refuse(pending, "198.51.100.7")).toBe(true);
		}

		expect(oauth.consent.refuse(pending, "198.51.100.7")).toBe(false);
		expect(oauth.consent.pending(pending)).toBeUndefined();
		expect(await oauth.consent.approve(pending, OWNER)).toBeUndefined();
	});

	test("throttles an address that keeps failing, across pending requests", async () => {
		const client = await clientOf();

		for (let attempt = 0; attempt < 10; attempt += 1) {
			const pending = pendingIdOf(await redirectFrom(client));

			expect(oauth.consent.throttled("198.51.100.7")).toBe(false);
			oauth.consent.refuse(pending, "198.51.100.7");
		}

		expect(oauth.consent.throttled("198.51.100.7")).toBe(true);
		expect(oauth.consent.throttled("203.0.113.9")).toBe(false);

		now = new Date(now.getTime() + 15 * 60 * 1000 + 1);

		expect(oauth.consent.throttled("198.51.100.7")).toBe(false);
	});

	test("stops listening to everyone once failures pile up across many addresses", async () => {
		const client = await clientOf();

		for (let attempt = 0; attempt < 50; attempt += 1) {
			oauth.consent.refuse(
				pendingIdOf(await redirectFrom(client)),
				`198.51.100.${attempt}`,
			);
		}

		expect(oauth.consent.throttled("203.0.113.9")).toBe(true);
	});
});
