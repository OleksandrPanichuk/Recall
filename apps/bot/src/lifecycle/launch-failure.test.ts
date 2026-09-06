import { describe, expect, mock, test } from "bun:test";
import { createShutdown, silentLogger } from "@recall/kit";
import { onLaunchFailure } from "./launch-failure";

const abortError = (): Error => {
	const error = new Error("aborted");

	error.name = "AbortError";

	return error;
};

describe("a telegram launch that rejects", () => {
	test("is fatal when nothing asked the bot to stop", async () => {
		const shutdown = createShutdown({ logger: silentLogger });
		const onFatal = mock(() => undefined);
		const stopped = mock(() => undefined);

		shutdown.register({ name: "telegram", run: stopped });

		onLaunchFailure({ logger: silentLogger, shutdown, onFatal })(
			new Error("401 unauthorized"),
		);

		await shutdown.trigger("launch-failed");

		expect(stopped).toHaveBeenCalled();
		expect(onFatal).toHaveBeenCalled();
	});

	test("is not fatal once a signal has already begun the shutdown", async () => {
		const shutdown = createShutdown({ logger: silentLogger });
		const onFatal = mock(() => undefined);

		await shutdown.trigger("SIGTERM");

		onLaunchFailure({ logger: silentLogger, shutdown, onFatal })(abortError());

		await Promise.resolve();

		expect(onFatal).not.toHaveBeenCalled();
	});

	test("and neither is the TypeError telegraf turns that abort into", async () => {
		const shutdown = createShutdown({ logger: silentLogger });
		const onFatal = mock(() => undefined);

		await shutdown.trigger("SIGTERM");

		onLaunchFailure({ logger: silentLogger, shutdown, onFatal })(
			new TypeError("Attempted to assign to readonly property."),
		);

		await Promise.resolve();

		expect(onFatal).not.toHaveBeenCalled();
	});

	test("the reason it is not fatal is the shutdown, not the error", async () => {
		const shutdown = createShutdown({ logger: silentLogger });
		const onFatal = mock(() => undefined);

		onLaunchFailure({ logger: silentLogger, shutdown, onFatal })(abortError());

		await shutdown.trigger("launch-failed");

		expect(onFatal).toHaveBeenCalled();
	});
});
