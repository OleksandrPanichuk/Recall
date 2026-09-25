import { describe, expect, mock, test } from "bun:test";
import { createShutdown, silentLogger } from "@recall/kit";
import { delayFor, MAX_CONSECUTIVE_FAILURES } from "./keep-polling";
import { registerWebhook, type WebhookRegistration } from "./register-webhook";

const dropped = (): Error =>
	Object.assign(new TypeError("The socket connection was closed"), {
		code: "ECONNRESET",
	});

const URL_HREF = "https://recall.example/telegram/hook";
const SECRET = "s".repeat(32);

const harnessOf = (outcomes: readonly (Error | "resolve")[]) => {
	const calls: { url: string; options: WebhookRegistration }[] = [];
	const waits: number[] = [];
	const onFatal = mock((_error: unknown) => undefined);
	const onListening = mock(() => undefined);
	const shutdown = createShutdown({ logger: silentLogger });

	return {
		calls,
		waits,
		onFatal,
		onListening,
		shutdown,
		run: () =>
			registerWebhook({
				setWebhook: async (url, options) => {
					calls.push({ url, options });

					const outcome = outcomes[calls.length - 1] ?? "resolve";

					if (outcome !== "resolve") {
						throw outcome;
					}

					return true;
				},
				url: URL_HREF,
				secret: SECRET,
				logger: silentLogger,
				shutdown,
				onFatal,
				onListening,
				wait: async (ms) => {
					waits.push(ms);
				},
			}),
	};
};

describe("registering the webhook at startup", () => {
	test("keeps the updates telegram queued during the deploy", async () => {
		const harness = harnessOf(["resolve"]);

		await harness.run();

		expect(harness.calls).toEqual([
			{
				url: URL_HREF,
				options: { secret_token: SECRET, drop_pending_updates: false },
			},
		]);
		expect(harness.onListening).toHaveBeenCalledTimes(1);
		expect(harness.onFatal).not.toHaveBeenCalled();
	});

	test("retries a dropped connection with backoff instead of exiting", async () => {
		const harness = harnessOf([dropped(), dropped(), "resolve"]);

		await harness.run();

		expect(harness.calls).toHaveLength(3);
		expect(harness.waits).toEqual([delayFor(1), delayFor(2)]);
		expect(harness.onListening).toHaveBeenCalledTimes(1);
		expect(harness.onFatal).not.toHaveBeenCalled();
	});

	test("gives up after a bounded number of attempts", async () => {
		const harness = harnessOf(
			Array.from({ length: MAX_CONSECUTIVE_FAILURES + 5 }, dropped),
		);

		await harness.run();

		expect(harness.calls).toHaveLength(MAX_CONSECUTIVE_FAILURES);
		expect(harness.onFatal).toHaveBeenCalledTimes(1);
		expect(harness.onListening).not.toHaveBeenCalled();
	});

	test("a refusal that is not the network fails at once", async () => {
		const refused = new Error("401: Unauthorized");
		const harness = harnessOf([refused]);

		await harness.run();

		expect(harness.calls).toHaveLength(1);
		expect(harness.waits).toEqual([]);
		expect(harness.onFatal).toHaveBeenCalledWith(refused);
	});

	test("a telegram rate limit is waited out, as long as telegram asks", async () => {
		const limited = Object.assign(
			new Error("429: Too Many Requests: retry after 7"),
			{ code: 429, parameters: { retry_after: 7 } },
		);
		const harness = harnessOf([limited, "resolve"]);

		await harness.run();

		expect(harness.calls).toHaveLength(2);
		expect(harness.waits).toEqual([7_000]);
		expect(harness.onFatal).not.toHaveBeenCalled();
	});

	test("a telegram server error is retried", async () => {
		const harness = harnessOf([
			Object.assign(new Error("502: Bad Gateway"), { code: 502 }),
			"resolve",
		]);

		await harness.run();

		expect(harness.calls).toHaveLength(2);
		expect(harness.onListening).toHaveBeenCalledTimes(1);
	});

	test("a shutdown during the backoff stops retrying", async () => {
		const calls: unknown[] = [];
		const onFatal = mock((_error: unknown) => undefined);
		const onListening = mock(() => undefined);
		const shutdown = createShutdown({ logger: silentLogger });

		await registerWebhook({
			setWebhook: async (url) => {
				calls.push(url);
				throw dropped();
			},
			url: URL_HREF,
			secret: SECRET,
			logger: silentLogger,
			shutdown,
			onFatal,
			onListening,
			wait: (_ms, interruptible) =>
				new Promise<void>((resolve) => {
					interruptible(resolve);
					void shutdown.trigger("deploy");
				}),
		});

		expect(calls).toHaveLength(1);
		expect(onFatal).not.toHaveBeenCalled();
		expect(onListening).not.toHaveBeenCalled();
	});
});
