import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createApiApp } from "@/entrypoints/api";
import { identifierFor } from "@/modules/auth/telegram-link.plugin";
import { verification } from "@/persistence/postgres/auth-schema";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

const BOT_TOKEN = "b".repeat(40);
const AUTH_SECRET = "s".repeat(40);
const SUCCESS_URL = "http://127.0.0.1:3999";
const OWNER_TELEGRAM_ID = 424242;

const overrides: { name: string; previous: string | undefined }[] = [];

const override = (name: string, value: string): void => {
	overrides.push({ name, previous: process.env[name] });
	process.env[name] = value;
};

let harness: PostgresHarness;
let app: INestApplication;
let origin: string;

const issue = (
	body: Record<string, unknown>,
	token: string = BOT_TOKEN,
): Promise<Response> =>
	fetch(`${origin}/bot/auth/login-link`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});

const linkFor = async (telegramUserId: number): Promise<string> => {
	const response = await issue({ telegramUserId });
	const body = (await response.json()) as { url: string };

	return body.url;
};

const follow = (url: string): Promise<Response> =>
	fetch(url, { redirect: "manual" });

const countOf = async (table: string): Promise<number> => {
	const rows = await harness.client.unsafe(
		`select count(*)::int as n from "${table}"`,
	);

	return Number(rows[0]?.n ?? 0);
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("auth-telegram");
	await applyMigration(harness);

	override("DATABASE_URL", harness.url);
	override("BOT_API_TOKEN", BOT_TOKEN);
	override("BETTER_AUTH_SECRET", AUTH_SECRET);
	override("WEB_APP_URL", SUCCESS_URL);
	override("ALLOWED_TELEGRAM_USER_ID", String(OWNER_TELEGRAM_ID));

	app = await createApiApp();
	await app.listen(0, "127.0.0.1");

	const address = app.getHttpServer().address() as AddressInfo;

	origin = `http://127.0.0.1:${address.port}`;
	process.env.BETTER_AUTH_URL = origin;
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

describe.skipIf(!available)("logging in from the telegram bot", () => {
	test("the api has an owner once the first link is followed", async () => {
		await follow(await linkFor(OWNER_TELEGRAM_ID));

		const response = await fetch(`${origin}/bot/attempts/current`, {
			method: "POST",
			headers: {
				authorization: `Bearer ${BOT_TOKEN}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ telegramUserId: OWNER_TELEGRAM_ID }),
		});

		expect(response.status).toBe(204);
	});

	test("only the bot can ask for a login link", async () => {
		expect((await issue({}, "wrong")).status).toBe(401);
		expect(
			(
				await fetch(`${origin}/bot/auth/login-link`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({}),
				})
			).status,
		).toBe(401);
	});

	test("refuses a request that does not name a telegram user", async () => {
		expect((await issue({})).status).toBe(400);
	});

	test("the link carries a token, not a user id", async () => {
		const url = new URL(await linkFor(OWNER_TELEGRAM_ID));

		expect(url.pathname).toBe("/api/auth/telegram/verify");
		expect(url.searchParams.get("token")).toBeString();
		expect(url.search).not.toContain(String(OWNER_TELEGRAM_ID));
	});

	test("following the link sets a session cookie and lands on the app", async () => {
		const response = await follow(await linkFor(OWNER_TELEGRAM_ID));

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(SUCCESS_URL);

		const cookie = response.headers.getSetCookie().join("; ");

		expect(cookie).toContain("better-auth.session_token=");
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
	});

	test("the cookie identifies the user to the api", async () => {
		const link = await linkFor(OWNER_TELEGRAM_ID);
		const login = await follow(link);
		const cookie = login.headers
			.getSetCookie()
			.map((entry) => entry.split(";")[0])
			.join("; ");

		const session = await fetch(`${origin}/api/auth/get-session`, {
			headers: { cookie },
		});
		const body = (await session.json()) as {
			user?: { id?: string };
			session?: { userId?: string };
		};

		expect(body.session?.userId).toBeString();
	});

	test("a link works once", async () => {
		const link = await linkFor(OWNER_TELEGRAM_ID);

		expect((await follow(link)).headers.get("location")).toBe(SUCCESS_URL);
		expect((await follow(link)).headers.get("location")).toBe(
			new URL("/?error=invalid_token", SUCCESS_URL).href,
		);
	});

	test("an expired link is spent, not honoured", async () => {
		const token = "expired-on-purpose";

		await harness.db.insert(verification).values({
			id: randomUUID(),
			identifier: identifierFor(token),
			value: randomUUID(),
			expiresAt: new Date(Date.now() - 60_000),
		});

		const response = await follow(
			`${origin}/api/auth/telegram/verify?token=${token}`,
		);

		expect(response.headers.get("location")).toBe(
			new URL("/?error=invalid_token", SUCCESS_URL).href,
		);
	});

	test("a made-up token is refused", async () => {
		const response = await follow(
			`${origin}/api/auth/telegram/verify?token=nothing-like-a-real-token`,
		);

		expect(response.headers.get("location")).toBe(
			new URL("/?error=invalid_token", SUCCESS_URL).href,
		);
	});

	test("the same telegram account is the same user on every device", async () => {
		await follow(await linkFor(OWNER_TELEGRAM_ID));
		await follow(await linkFor(OWNER_TELEGRAM_ID));

		expect(await countOf("user")).toBe(1);

		const sessions = await harness.client`
			select count(distinct s.user_id)::int as n
			from session s
			join account a on a.user_id = s.user_id
			where a.account_id = ${String(OWNER_TELEGRAM_ID)}
		`;

		expect(Number(sessions[0]?.n ?? 0)).toBe(1);
	});

	test("asking for a link for anyone else is refused, and creates nobody", async () => {
		const before = await countOf("user");

		expect((await issue({ telegramUserId: 3001 })).status).toBe(403);
		expect(await countOf("user")).toBe(before);
	});

	test("the bot cannot act for a telegram account this api does not serve", async () => {
		const response = await fetch(`${origin}/bot/attempts/current`, {
			method: "POST",
			headers: {
				authorization: `Bearer ${BOT_TOKEN}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ telegramUserId: 5150 }),
		});

		expect(response.status).toBe(403);
	});

	test("it can act for the one it does", async () => {
		const response = await fetch(`${origin}/bot/attempts/current`, {
			method: "POST",
			headers: {
				authorization: `Bearer ${BOT_TOKEN}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ telegramUserId: OWNER_TELEGRAM_ID }),
		});

		expect(response.status).toBe(204);
	});

	test("a stranger cannot sign themselves up", async () => {
		const before = await countOf("user");
		const response = await fetch(`${origin}/api/auth/sign-up/email`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				email: "stranger@example.com",
				password: "correct horse battery staple",
				name: "Stranger",
			}),
		});

		expect(response.ok).toBe(false);
		expect(await countOf("user")).toBe(before);
	});

	test("a stranger cannot sign in with a password either", async () => {
		const response = await fetch(`${origin}/api/auth/sign-in/email`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				email: `telegram-${OWNER_TELEGRAM_ID}@telegram.invalid`,
				password: "correct horse battery staple",
			}),
		});

		expect(response.ok).toBe(false);
	});

	test("every issued link is recorded for audit", async () => {
		const rows = await harness.client`
			select kind, count(*)::int as n from auth_events group by kind
		`;
		const kinds = new Map(
			rows.map((row) => [String(row.kind), Number(row.n)] as const),
		);

		expect(kinds.get("telegram-link-issued")).toBeGreaterThan(0);
		expect(kinds.get("telegram-user-created")).toBeGreaterThan(0);
	});
});
