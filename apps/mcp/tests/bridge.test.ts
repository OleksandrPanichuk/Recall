import { describe, expect, test } from "bun:test";
import { createBridge, type Fetch } from "../src/bridge";
import type { BridgeConfiguration } from "../src/config";

const configuration: BridgeConfiguration = {
	endpoint: new URL("http://127.0.0.1:8765/mcp"),
	token: "t".repeat(32),
	timeoutMs: 5_000,
};

const request = JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/list" });

const bridgeOver = (send: Fetch) =>
	createBridge({ configuration, fetch: send });

describe("the stdio bridge", () => {
	test("forwards a request and returns the api's answer verbatim", async () => {
		let seen: RequestInit | undefined;
		let target: string | URL | undefined;

		const bridge = bridgeOver((input, init) => {
			target = input;
			seen = init;

			return Promise.resolve(
				new Response('{"jsonrpc":"2.0","id":7,"result":{"tools":[]}}\n', {
					headers: { "content-type": "application/json" },
				}),
			);
		});

		const answer = await bridge.handle(request);

		expect(answer).toBe('{"jsonrpc":"2.0","id":7,"result":{"tools":[]}}');
		expect(String(target)).toBe("http://127.0.0.1:8765/mcp");
		expect(seen?.body).toBe(request);
		expect((seen?.headers as Record<string, string>).authorization).toBe(
			`Bearer ${configuration.token}`,
		);
	});

	test("reads an answer delivered as an event stream", async () => {
		const bridge = bridgeOver(() =>
			Promise.resolve(
				new Response(
					'event: message\ndata: {"jsonrpc":"2.0","id":7,"result":{}}\n\n',
					{ headers: { "content-type": "text/event-stream" } },
				),
			),
		);

		expect(await bridge.handle(request)).toBe(
			'{"jsonrpc":"2.0","id":7,"result":{}}',
		);
	});

	test("stays silent when a notification is accepted", async () => {
		const bridge = bridgeOver(() =>
			Promise.resolve(new Response(null, { status: 202 })),
		);

		expect(
			await bridge.handle(
				JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
			),
		).toBeUndefined();
	});

	test("turns an unreachable api into a jsonrpc error, not a crash", async () => {
		const warnings: string[] = [];
		const bridge = createBridge({
			configuration,
			fetch: () => Promise.reject(new Error("connection refused")),
			onWarning: (message) => warnings.push(message),
		});

		const answer = await bridge.handle(request);

		expect(JSON.parse(answer ?? "")).toMatchObject({
			id: 7,
			error: { code: -32603 },
		});
		expect(warnings.join("\n")).toContain("connection refused");
	});

	test("reports a rejected token as an error against the request id", async () => {
		const bridge = bridgeOver(() =>
			Promise.resolve(new Response("Unauthorized", { status: 401 })),
		);

		expect(JSON.parse((await bridge.handle(request)) ?? "")).toMatchObject({
			id: 7,
			error: { code: -32603, message: expect.stringContaining("401") },
		});
	});

	test("says nothing to the client when a notification cannot be delivered", async () => {
		const bridge = bridgeOver(() => Promise.reject(new Error("down")));

		expect(
			await bridge.handle(
				JSON.stringify({ jsonrpc: "2.0", method: "notifications/cancelled" }),
			),
		).toBeUndefined();
	});

	test("answers a line that is not json with a parse error", async () => {
		const bridge = bridgeOver(() => {
			throw new Error("the bridge should not have called the api");
		});

		expect(JSON.parse((await bridge.handle("{ not json")) ?? "")).toMatchObject(
			{
				id: null,
				error: { code: -32700 },
			},
		);
	});

	test("passes a batch through and keeps the batched answer", async () => {
		const batch = JSON.stringify([
			{ jsonrpc: "2.0", id: 1, method: "tools/list" },
			{ jsonrpc: "2.0", id: 2, method: "tools/list" },
		]);
		const bridge = bridgeOver(() =>
			Promise.resolve(
				new Response('[{"jsonrpc":"2.0","id":1},{"jsonrpc":"2.0","id":2}]', {
					headers: { "content-type": "application/json" },
				}),
			),
		);

		expect(await bridge.handle(batch)).toBe(
			'[{"jsonrpc":"2.0","id":1},{"jsonrpc":"2.0","id":2}]',
		);
	});

	test("answers every request in a batch when the api cannot be reached", async () => {
		const batch = JSON.stringify([
			{ jsonrpc: "2.0", id: 1, method: "tools/list" },
			{ jsonrpc: "2.0", method: "notifications/initialized" },
			{ jsonrpc: "2.0", id: "two", method: "tools/list" },
		]);
		const bridge = bridgeOver(() => Promise.reject(new Error("down")));

		const answer = JSON.parse((await bridge.handle(batch)) ?? "") as {
			id: unknown;
			error: { code: number };
		}[];

		expect(answer.map((entry) => entry.id)).toEqual([1, "two"]);
		expect(answer.every((entry) => entry.error.code === -32603)).toBe(true);
	});

	test("answers every request in a batch the api refused", async () => {
		const batch = JSON.stringify([
			{ jsonrpc: "2.0", id: 1, method: "tools/list" },
			{ jsonrpc: "2.0", id: 2, method: "tools/list" },
		]);
		const bridge = bridgeOver(() =>
			Promise.resolve(new Response("Unauthorized", { status: 401 })),
		);

		const answer = JSON.parse((await bridge.handle(batch)) ?? "") as {
			id: unknown;
			error: { message: string };
		}[];

		expect(answer.map((entry) => entry.id)).toEqual([1, 2]);
		expect(answer[1]?.error.message).toContain("401");
	});

	test("forwards the api's own jsonrpc error instead of replacing it", async () => {
		const refusal =
			'{"jsonrpc":"2.0","id":7,"error":{"code":-32600,"message":"Bad Request: the session is gone"}}';
		const bridge = bridgeOver(() =>
			Promise.resolve(
				new Response(`${refusal}\n`, {
					status: 400,
					headers: { "content-type": "application/json" },
				}),
			),
		);

		expect(await bridge.handle(request)).toBe(refusal);
	});

	test("replaces a refusal that is json but not jsonrpc", async () => {
		const bridge = bridgeOver(() =>
			Promise.resolve(
				Response.json(
					{ error: "invalid_token", error_description: "expired" },
					{ status: 401 },
				),
			),
		);

		expect(JSON.parse((await bridge.handle(request)) ?? "")).toMatchObject({
			jsonrpc: "2.0",
			id: 7,
			error: { code: -32603, message: expect.stringContaining("401") },
		});
	});

	test("puts an api error with no id against the ids the client asked with", async () => {
		const batch = JSON.stringify([
			{ jsonrpc: "2.0", id: 1, method: "tools/list" },
			{ jsonrpc: "2.0", id: 2, method: "tools/list" },
		]);
		const bridge = bridgeOver(() =>
			Promise.resolve(
				Response.json(
					{
						jsonrpc: "2.0",
						id: null,
						error: { code: -32000, message: "Not Acceptable: nope" },
					},
					{ status: 406 },
				),
			),
		);

		const single = JSON.parse((await bridge.handle(request)) ?? "") as {
			id: unknown;
			error: { message: string };
		};

		expect(single.id).toBe(7);
		expect(single.error.message).toContain("Not Acceptable: nope");

		const answers = JSON.parse((await bridge.handle(batch)) ?? "") as {
			id: unknown;
			error: { message: string };
		}[];

		expect(answers.map((answer) => answer.id)).toEqual([1, 2]);
		expect(answers[0]?.error.message).toContain("Not Acceptable: nope");
	});

	test("answers with an error when the api's answer cannot be read", async () => {
		const bridge = bridgeOver(() =>
			Promise.resolve(
				new Response(
					new ReadableStream({
						start(controller) {
							controller.error(new Error("socket closed"));
						},
					}),
					{ headers: { "content-type": "application/json" } },
				),
			),
		);

		expect(JSON.parse((await bridge.handle(request)) ?? "")).toMatchObject({
			id: 7,
			error: {
				code: -32603,
				message: expect.stringContaining("socket closed"),
			},
		});
	});
});
