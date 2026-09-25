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

const emptyBrowse = { breadcrumb: [], children: [], sets: [], attached: [] };

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

	test("cannot mint a login link, which would hand out a session", () => {
		const client = createAppClient({ baseUrl: "http://api.test" });

		expect(
			(client as unknown as Record<string, unknown>).issueLoginLink,
		).toBeUndefined();
	});

	test("can mint a token for itself, and cannot name whose", async () => {
		const { send, calls } = recording({
			id: "t1",
			name: "mcp",
			token: "recall_pat_x",
		});

		await createAppClient({
			baseUrl: "http://api.test",
			fetch: send,
		}).issueApiToken.execute({ name: "mcp" });

		expect(calls[0]?.url).toBe("http://api.test/app/auth/tokens/issue");
		expect(Object.keys(JSON.parse(calls[0]?.body ?? "{}"))).toEqual(["name"]);
	});

	test("a telegram id in a token command is dropped, not forwarded", async () => {
		const { send, calls } = recording({
			id: "t1",
			name: "mcp",
			token: "recall_pat_x",
		});

		await createAppClient({
			baseUrl: "http://api.test",
			fetch: send,
		}).issueApiToken.execute({
			name: "mcp",
			telegramUserId: 616161,
		} as never);

		expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({ name: "mcp" });
	});

	test("a telegram id in a start command is dropped, not forwarded", async () => {
		const { send, calls } = recording({
			attemptId: "a1",
			questionCount: 1,
		});
		const client = createAppClient({ baseUrl: "http://api.test", fetch: send });

		await client.startQuizAttempt
			.execute({ quizSetId: "q1", telegramUserId: 616161 } as never)
			.catch(() => undefined);
		await client.startPracticeSession
			.execute({
				quizSetId: "q1",
				mode: "mistakes",
				telegramUserId: 616161,
			} as never)
			.catch(() => undefined);

		expect(calls.map((call) => JSON.parse(call.body))).toEqual([
			{ quizSetId: "q1" },
			{ quizSetId: "q1", mode: "mistakes" },
		]);
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

	test("cannot reach the routes only a session is served", () => {
		const client = createBotClient({
			baseUrl: "http://api.test/bot/",
			token: "t".repeat(40),
		});
		const appOnly = [
			"createQuizSet",
			"listQuizSets",
			"addQuestions",
			"listVocabulary",
			"addVocabulary",
			"sharePage",
			"unsharePage",
		];

		// @ts-expect-error
		expect(client.createQuizSet).toBeUndefined();
		// @ts-expect-error
		expect(client.sharePage).toBeUndefined();

		for (const name of appOnly) {
			expect((client as unknown as Record<string, unknown>)[name]).toBe(
				undefined,
			);
		}
	});
});
