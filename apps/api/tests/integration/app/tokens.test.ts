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
const BOT_TOKEN = "b".repeat(40);
const TELEGRAM_ID = 616161;
const STRANGER = "stranger@example.com";
const PASSWORD = "a passphrase long enough";

const overrides: { name: string; previous: string | undefined }[] = [];

const override = (name: string, value: string): void => {
	overrides.push({ name, previous: process.env[name] });
	process.env[name] = value;
};

let harness: PostgresHarness;
let app: INestApplication;
let origin: string;
let owner: string;
let stranger: string;

const json = async <TBody>(response: Response): Promise<TBody> =>
	(await response.json()) as TBody;

const post = (
	prefix: string,
	path: string,
	body: unknown,
	headers: Record<string, string>,
): Promise<Response> =>
	fetch(`${origin}/${prefix}/${path}`, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});

const asOwner = (path: string, body: unknown = {}): Promise<Response> =>
	post("app", path, body, { cookie: owner });

const asStranger = (path: string, body: unknown = {}): Promise<Response> =>
	post("app", path, body, { cookie: stranger });

const cookieOf = (response: Response): string =>
	(response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("app-tokens");
	await applyMigration(harness);

	override("DATABASE_URL", harness.url);
	override("BOT_API_TOKEN", BOT_TOKEN);
	override("BETTER_AUTH_SECRET", "s".repeat(40));
	override("ALLOWED_TELEGRAM_USER_ID", String(TELEGRAM_ID));
	override("AUTH_RATE_LIMIT", "off");

	app = await createApiApp();
	await app.listen(0, "127.0.0.1");

	const address = app.getHttpServer().address() as AddressInfo;

	origin = `http://127.0.0.1:${address.port}`;
	process.env.BETTER_AUTH_URL = origin;

	const { url } = await json<{ url: string }>(
		await post(
			"bot",
			"auth/login-link",
			{ telegramUserId: TELEGRAM_ID },
			{ authorization: `Bearer ${BOT_TOKEN}` },
		),
	);

	owner = cookieOf(
		await fetch(url.replace(/^https?:\/\/[^/]+/, origin), {
			redirect: "manual",
		}),
	);
	stranger = cookieOf(
		await fetch(`${origin}/api/auth/sign-up/email`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				email: STRANGER,
				password: PASSWORD,
				name: "Stranger",
			}),
		}),
	);
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

describe.skipIf(!available)("minting an mcp token from the web", () => {
	let tokenId: string;
	let secret: string;

	test("both accounts really are signed in", () => {
		expect(owner).not.toBe("");
		expect(stranger).not.toBe("");
		expect(owner).not.toBe(stranger);
	});

	test("a session mints a token without naming anyone", async () => {
		const response = await asOwner("auth/tokens/issue", { name: "Claude" });

		expect(response.status).toBe(200);

		const issued = await json<{ id: string; name: string; token: string }>(
			response,
		);

		expect(issued.name).toBe("Claude");
		expect(issued.token.startsWith("recall_pat_")).toBe(true);

		tokenId = issued.id;
		secret = issued.token;
	});

	test("the secret is shown once and never listed again", async () => {
		const listed = await json<Record<string, unknown>[]>(
			await asOwner("auth/tokens/list"),
		);

		expect(listed).toHaveLength(1);
		expect(listed[0]?.id).toBe(tokenId);
		expect(listed[0]).not.toHaveProperty("token");
		expect(JSON.stringify(listed)).not.toContain(secret);
	});

	test("the bot surface sees the same token, because it is the same owner", async () => {
		const listed = await json<{ id: string }[]>(
			await post(
				"bot",
				"auth/tokens/list",
				{ telegramUserId: TELEGRAM_ID },
				{ authorization: `Bearer ${BOT_TOKEN}` },
			),
		);

		expect(listed.map((token) => token.id)).toContain(tokenId);
	});

	test("another account sees none of it", async () => {
		const listed = await json<unknown[]>(await asStranger("auth/tokens/list"));

		expect(listed).toEqual([]);
	});

	test("another account cannot revoke it either", async () => {
		const refused = await json<{ revoked: boolean }>(
			await asStranger("auth/tokens/revoke", { tokenId }),
		);

		expect(refused.revoked).toBe(false);

		const still = await json<unknown[]>(await asOwner("auth/tokens/list"));

		expect(still).toHaveLength(1);
	});

	test("its owner can revoke it, and then it is gone", async () => {
		const gone = await json<{ revoked: boolean }>(
			await asOwner("auth/tokens/revoke", { tokenId }),
		);

		expect(gone.revoked).toBe(true);
		expect(await json<unknown[]>(await asOwner("auth/tokens/list"))).toEqual(
			[],
		);
	});

	test("no session at all is refused", async () => {
		const response = await fetch(`${origin}/app/auth/tokens/list`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{}",
		});

		expect(response.ok).toBe(false);
	});

	test("a telegram id in the body is ignored, not honoured", async () => {
		const issued = await json<{ id: string }>(
			await asStranger("auth/tokens/issue", {
				name: "sneaky",
				telegramUserId: TELEGRAM_ID,
			}),
		);
		const mine = await json<{ id: string }[]>(
			await asStranger("auth/tokens/list"),
		);
		const theirs = await json<unknown[]>(await asOwner("auth/tokens/list"));

		expect(mine.map((token) => token.id)).toEqual([issued.id]);
		expect(theirs).toEqual([]);
	});
});
