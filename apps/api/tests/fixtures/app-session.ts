import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createApiApp } from "@/entrypoints/api";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "./postgres";

export { postgresAvailable };

const BOT_TOKEN = "b".repeat(40);
const TELEGRAM_ID = 616161;

export interface AppSessionOptions {
	readonly name: string;
	readonly telegramUserId?: number;
	readonly env?: Readonly<Record<string, string>>;
}

export interface AppSession {
	readonly origin: string;
	readonly cookie: string;
	readonly botToken: string;
	readonly telegramUserId: number;
	app(path: string, body?: unknown): Promise<Response>;
	bot(path: string, body?: unknown): Promise<Response>;
	as(cookie: string): (path: string, body?: unknown) => Promise<Response>;
	signUp(email: string, password: string): Promise<string>;
	close(): Promise<void>;
}

export const bodyOf = async <TBody>(response: Response): Promise<TBody> =>
	(await response.json()) as TBody;

const cookieOf = (response: Response): string =>
	(response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

export async function openAppSession(
	options: AppSessionOptions,
): Promise<AppSession> {
	const telegramUserId = options.telegramUserId ?? TELEGRAM_ID;
	const taken: { name: string; previous: string | undefined }[] = [];

	const override = (name: string, value: string): void => {
		taken.push({ name, previous: process.env[name] });
		process.env[name] = value;
	};

	const harness: PostgresHarness = await openPostgres(options.name);

	await applyMigration(harness);

	override("DATABASE_URL", harness.url);
	override("BOT_API_TOKEN", BOT_TOKEN);
	override("BETTER_AUTH_SECRET", "s".repeat(40));
	override("ALLOWED_TELEGRAM_USER_ID", String(telegramUserId));
	override("AUTH_RATE_LIMIT", "off");

	for (const [name, value] of Object.entries(options.env ?? {})) {
		override(name, value);
	}

	const app: INestApplication = await createApiApp();

	await app.listen(0, "127.0.0.1");

	const address = app.getHttpServer().address() as AddressInfo;
	const origin = `http://127.0.0.1:${address.port}`;

	process.env.BETTER_AUTH_URL = origin;

	const post = (
		prefix: string,
		path: string,
		body: unknown,
		headers: Readonly<Record<string, string>>,
	): Promise<Response> =>
		fetch(`${origin}/${prefix}/${path}`, {
			method: "POST",
			headers: { "content-type": "application/json", ...headers },
			body: JSON.stringify(body ?? {}),
		});

	const bot = (path: string, body: unknown = {}): Promise<Response> =>
		post("bot", path, body, { authorization: `Bearer ${BOT_TOKEN}` });

	const { url } = await bodyOf<{ url: string }>(
		await bot("auth/login-link", { telegramUserId }),
	);
	const cookie = cookieOf(
		await fetch(url.replace(/^https?:\/\/[^/]+/, origin), {
			redirect: "manual",
		}),
	);

	const as =
		(who: string) =>
		(path: string, body: unknown = {}): Promise<Response> =>
			post("app", path, body, { cookie: who });

	return {
		origin,
		cookie,
		botToken: BOT_TOKEN,
		telegramUserId,
		app: as(cookie),
		bot,
		as,
		signUp: async (email, password) =>
			cookieOf(
				await fetch(`${origin}/api/auth/sign-up/email`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ email, password, name: email }),
				}),
			),
		close: async () => {
			await app.close();
			await harness.close();

			for (const { name, previous } of taken.reverse()) {
				if (previous === undefined) {
					delete process.env[name];
				} else {
					process.env[name] = previous;
				}
			}
		},
	};
}
