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
const BOT_TOKEN = "o".repeat(40);
const TELEGRAM_ID = 646464;
const WEB_ORIGIN = "http://127.0.0.1:3000";

const overrides: { name: string; previous: string | undefined }[] = [];

const override = (name: string, value: string): void => {
	overrides.push({ name, previous: process.env[name] });
	process.env[name] = value;
};

let harness: PostgresHarness;
let app: INestApplication;
let origin: string;

const post = (
	path: string,
	headers: Readonly<Record<string, string>>,
	body: unknown = {},
): Promise<Response> =>
	fetch(`${origin}/api/auth/${path}`, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});

const mint = async (): Promise<string> => {
	const { url } = (await (
		await fetch(`${origin}/bot/auth/login-link`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${BOT_TOKEN}`,
			},
			body: JSON.stringify({ telegramUserId: TELEGRAM_ID }),
		})
	).json()) as { url: string };
	const verified = await fetch(url.replace(/^https?:\/\/[^/]+/, origin), {
		redirect: "manual",
	});

	return (verified.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
};

const signedIn = async (cookie: string): Promise<boolean> => {
	const body = (await (
		await fetch(`${origin}/api/auth/get-session`, { headers: { cookie } })
	).json()) as { user?: { id?: string } } | null;

	return body?.user?.id !== undefined;
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("auth-origin");
	await applyMigration(harness);

	override("DATABASE_URL", harness.url);
	override("BOT_API_TOKEN", BOT_TOKEN);
	override("BETTER_AUTH_SECRET", "s".repeat(40));
	override("ALLOWED_TELEGRAM_USER_ID", String(TELEGRAM_ID));
	override("AUTH_RATE_LIMIT", "off");
	override("WEB_APP_URL", WEB_ORIGIN);

	app = await createApiApp();
	await app.listen(0, "127.0.0.1");

	origin = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
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

describe.skipIf(!available)("signing out from the web", () => {
	test("a fresh link really does sign someone in", async () => {
		expect(await signedIn(await mint())).toBe(true);
	});

	test("the web app's origin is accepted and the session really ends", async () => {
		const cookie = await mint();

		expect(
			(await post("sign-out", { cookie, origin: WEB_ORIGIN })).status,
		).toBe(200);
		expect(await signedIn(cookie)).toBe(false);
	});

	test("and the app surface stops answering for that cookie", async () => {
		const cookie = await mint();

		await post("sign-out", { cookie, origin: WEB_ORIGIN });

		const response = await fetch(`${origin}/app/browse`, {
			method: "POST",
			headers: { "content-type": "application/json", cookie },
			body: "{}",
		});

		expect(response.status).toBe(401);
	});

	test("one link is one session: signing one out leaves the other alone", async () => {
		const first = await mint();
		const second = await mint();

		await post("sign-out", { cookie: first, origin: WEB_ORIGIN });

		expect(await signedIn(first)).toBe(false);
		expect(await signedIn(second)).toBe(true);
	});

	test("a login link cannot be spent twice", async () => {
		const { url } = (await (
			await fetch(`${origin}/bot/auth/login-link`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${BOT_TOKEN}`,
				},
				body: JSON.stringify({ telegramUserId: TELEGRAM_ID }),
			})
		).json()) as { url: string };
		const local = url.replace(/^https?:\/\/[^/]+/, origin);
		const first = await fetch(local, { redirect: "manual" });
		const second = await fetch(local, { redirect: "manual" });

		expect(first.headers.get("set-cookie")).toBeTruthy();
		expect(second.headers.get("set-cookie")).toBeFalsy();
	});
});
