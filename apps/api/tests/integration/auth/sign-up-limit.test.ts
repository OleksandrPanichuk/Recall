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
const ALLOWED_PER_HOUR = 2;
const PASSWORD = "correct horse battery staple";

const overrides: { name: string; previous: string | undefined }[] = [];

const override = (name: string, value: string): void => {
	overrides.push({ name, previous: process.env[name] });
	process.env[name] = value;
};

let harness: PostgresHarness;
let app: INestApplication;
let origin: string;

const signUp = (email: string): Promise<Response> =>
	fetch(`${origin}/api/auth/sign-up/email`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ email, password: PASSWORD, name: email }),
	});

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("auth-signup-limit");
	await applyMigration(harness);

	override("DATABASE_URL", harness.url);
	override("BOT_API_TOKEN", "b".repeat(40));
	override("BETTER_AUTH_SECRET", "s".repeat(40));
	override("ALLOWED_TELEGRAM_USER_ID", "515151");
	override("AUTH_RATE_LIMIT", "on");
	override("SIGN_UPS_PER_HOUR", String(ALLOWED_PER_HOUR));

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

describe.skipIf(!available)("open registration has a ceiling", () => {
	test("refuses the flood once the hourly allowance is spent", async () => {
		const statuses: number[] = [];

		for (let attempt = 0; attempt < ALLOWED_PER_HOUR + 2; attempt += 1) {
			statuses.push((await signUp(`flood-${attempt}@example.com`)).status);
		}

		expect(statuses.slice(0, ALLOWED_PER_HOUR).every((s) => s < 400)).toBe(
			true,
		);
		expect(statuses.at(-1)).toBe(429);
	});

	test("the accounts beyond the allowance were never created", async () => {
		const [row] = await harness.client<{ n: number }[]>`
			select count(*)::int as n from "user" where email like 'flood-%'
		`;

		expect(row?.n).toBe(ALLOWED_PER_HOUR);
	});
});
