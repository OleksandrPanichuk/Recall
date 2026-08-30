import { beforeEach, describe, expect, test } from "bun:test";
import type { Update } from "telegraf/types";
import { createSeenUpdates } from "../src/telegram/seen-updates";
import { createWebhookHandler } from "../src/telegram/webhook";
import { SECRET_HEADER } from "../src/telegram/webhook.constants";

const SECRET = "a-secret-telegram-and-we-share";
const PATH = "/telegram/updates";

let handled: number[];
let errors: unknown[];
let failWith: Error | undefined;

const handler = () =>
	createWebhookHandler({
		path: PATH,
		secret: SECRET,
		handleUpdate: async (update: Update) => {
			handled.push(update.update_id);

			if (failWith !== undefined) {
				throw failWith;
			}
		},
		onError: (error) => {
			errors.push(error);
		},
	});

const post = (
	body: unknown,
	headers: Record<string, string> = { [SECRET_HEADER]: SECRET },
	path = PATH,
): Request =>
	new Request(`http://bot.invalid${path}`, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});

const anUpdate = (updateId: number) => ({
	update_id: updateId,
	message: { text: "/start" },
});

beforeEach(() => {
	handled = [];
	errors = [];
	failWith = undefined;
});

describe("who is allowed to post an update", () => {
	test("telegram, carrying the secret it was given", async () => {
		const response = await handler()(post(anUpdate(1)));

		expect(response.status).toBe(200);
		expect(handled).toEqual([1]);
	});

	test("nobody without the header", async () => {
		const response = await handler()(post(anUpdate(1), {}));

		expect(response.status).toBe(403);
		expect(handled).toEqual([]);
	});

	test("nobody with the wrong secret", async () => {
		const response = await handler()(
			post(anUpdate(1), { [SECRET_HEADER]: "not-the-secret-at-all-no" }),
		);

		expect(response.status).toBe(403);
		expect(handled).toEqual([]);
	});

	test("the secret alone is not enough on another path", async () => {
		const response = await handler()(post(anUpdate(1), undefined, "/"));

		expect(response.status).toBe(404);
		expect(handled).toEqual([]);
	});

	test("a GET is refused even on the right path", async () => {
		const response = await handler()(
			new Request(`http://bot.invalid${PATH}`, {
				method: "GET",
				headers: { [SECRET_HEADER]: SECRET },
			}),
		);

		expect(response.status).toBe(405);
	});
});

describe("what arrives", () => {
	test("a body that is not an update is refused", async () => {
		expect((await handler()(post({ hello: "world" }))).status).toBe(400);
		expect((await handler()(post("nonsense"))).status).toBe(400);
		expect(handled).toEqual([]);
	});

	test("unparsable json is refused rather than thrown", async () => {
		const response = await handler()(
			new Request(`http://bot.invalid${PATH}`, {
				method: "POST",
				headers: { [SECRET_HEADER]: SECRET },
				body: "{ not json",
			}),
		);

		expect(response.status).toBe(400);
	});

	test("a handler that throws still answers 200, so telegram stops retrying", async () => {
		failWith = new Error("the api is down");

		const response = await handler()(post(anUpdate(7)));

		expect(response.status).toBe(200);
		expect(errors).toHaveLength(1);
	});

	test("liveness needs no secret", async () => {
		const response = await handler()(
			new Request("http://bot.invalid/health/live"),
		);

		expect(response.status).toBe(200);
	});
});

describe("a retry of an update already taken", () => {
	test("is answered without handling it twice", async () => {
		const post_ = handler();

		await post_(post(anUpdate(42)));
		const again = await post_(post(anUpdate(42)));

		expect(again.status).toBe(200);
		expect(handled).toEqual([42]);
	});

	test("arriving three at once is still taken exactly once", async () => {
		const slow = createWebhookHandler({
			path: PATH,
			secret: SECRET,
			handleUpdate: async (update: Update) => {
				handled.push(update.update_id);
				await Bun.sleep(20);
			},
			onError: (error) => {
				errors.push(error);
			},
		});

		const answers = await Promise.all([
			slow(post(anUpdate(9))),
			slow(post(anUpdate(9))),
			slow(post(anUpdate(9))),
		]);

		expect(answers.map((answer) => answer.status)).toEqual([200, 200, 200]);
		expect(handled).toEqual([9]);
	});

	test("does not block a genuinely new update", async () => {
		const post_ = handler();

		await post_(post(anUpdate(1)));
		await post_(post(anUpdate(1)));
		await post_(post(anUpdate(2)));

		expect(handled).toEqual([1, 2]);
	});
});

describe("remembering only so many updates", () => {
	test("forgets the oldest once it is full, and stays bounded", () => {
		const seen = createSeenUpdates(3);

		for (const id of [1, 2, 3, 4]) {
			expect(seen.firstSighting(id)).toBe(true);
		}

		expect(seen.size).toBe(3);
		expect(seen.firstSighting(1)).toBe(true);
		expect(seen.firstSighting(4)).toBe(false);
	});
});
