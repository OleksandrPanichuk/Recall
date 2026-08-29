import { describe, expect, test } from "bun:test";
import { createAppClient, createBotClient, type Fetch } from "../src/client";

const ok = (body: unknown): Response =>
	new Response(JSON.stringify(body), {
		headers: { "content-type": "application/json" },
	});

interface Seen {
	readonly url: string;
	readonly headers: Record<string, string>;
	readonly body: string;
}

const recording = (
	body: unknown,
): { readonly send: Fetch; readonly calls: Seen[] } => {
	const calls: Seen[] = [];

	return {
		calls,
		send: (input, init) => {
			calls.push({
				url: String(input),
				headers: (init?.headers ?? {}) as Record<string, string>,
				body: String(init?.body ?? ""),
			});

			return Promise.resolve(ok(body));
		},
	};
};

const emptyBrowse = { breadcrumb: [], children: [], sets: [] };

describe("the app client", () => {
	test("posts under the app prefix and sends the cookie", async () => {
		const { send, calls } = recording(emptyBrowse);
		const client = createAppClient({
			baseUrl: "http://api.test",
			cookie: "better-auth.session_token=abc",
			fetch: send,
		});

		await client.browseFolder.execute({});

		expect(calls[0]?.url).toBe("http://api.test/app/browse");
		expect(calls[0]?.headers.cookie).toBe("better-auth.session_token=abc");
		expect(calls[0]?.headers.authorization).toBeUndefined();
	});

	test("sends no cookie header when the browser had none", async () => {
		const { send, calls } = recording(emptyBrowse);

		await createAppClient({
			baseUrl: "http://api.test",
			fetch: send,
		}).browseFolder.execute({});

		expect(calls[0]?.headers.cookie).toBeUndefined();
	});

	test("cannot mint credentials", () => {
		const client = createAppClient({ baseUrl: "http://api.test" });

		expect(
			(client as unknown as Record<string, unknown>).issueLoginLink,
		).toBeUndefined();
		expect(
			(client as unknown as Record<string, unknown>).issueApiToken,
		).toBeUndefined();
	});
});

describe("the bot client", () => {
	test("posts under the bot prefix with the bearer token", async () => {
		const { send, calls } = recording(emptyBrowse);
		const client = createBotClient({
			baseUrl: "http://api.test/bot/",
			token: "t".repeat(40),
			fetch: send,
		});

		await client.browseFolder.execute({});

		expect(calls[0]?.url).toBe("http://api.test/bot/browse");
		expect(calls[0]?.headers.authorization).toBe(`Bearer ${"t".repeat(40)}`);
		expect(calls[0]?.headers.cookie).toBeUndefined();
	});

	test("still mints credentials, which the app client cannot", async () => {
		const { send } = recording({
			url: "http://api.test/verify?token=x",
			expiresAt: new Date().toISOString(),
		});
		const client = createBotClient({
			baseUrl: "http://api.test/bot/",
			token: "t".repeat(40),
			fetch: send,
		});

		expect(
			(await client.issueLoginLink.execute({ telegramUserId: 42 })).url,
		).toContain("token=");
	});
});
