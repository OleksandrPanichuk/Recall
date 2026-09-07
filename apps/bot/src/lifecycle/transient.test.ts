import { describe, expect, test } from "bun:test";
import { isTransientNetworkError } from "./transient";

const droppedMidResponse = async (): Promise<unknown> => {
	const server = Bun.listen({
		hostname: "127.0.0.1",
		port: 0,
		socket: {
			data(socket) {
				socket.write("HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\n{");
				setTimeout(() => socket.end(), 5);
			},
			open() {},
		},
	});

	try {
		const response = await fetch(`http://127.0.0.1:${server.port}/`);

		await response.text();

		return undefined;
	} catch (error) {
		return error;
	} finally {
		server.stop(true);
	}
};

describe("what bun actually raises when a poll dies", () => {
	test("a socket closed mid-response is transient", async () => {
		const error = await droppedMidResponse();

		expect((error as { code?: string }).code).toBe("ECONNRESET");
		expect(isTransientNetworkError(error)).toBe(true);
	});

	test("a refused connection is transient", async () => {
		let error: unknown;

		try {
			await fetch("http://127.0.0.1:1/");
		} catch (raised) {
			error = raised;
		}

		expect(isTransientNetworkError(error)).toBe(true);
	});

	test("so is a name that will not resolve", async () => {
		let error: unknown;

		try {
			await fetch("http://recall-does-not-exist.invalid/");
		} catch (raised) {
			error = raised;
		}

		expect(isTransientNetworkError(error)).toBe(true);
	});
});

describe("what is not a dropped connection", () => {
	test("the TypeError telegraf makes of an abort is not transient", () => {
		expect(
			isTransientNetworkError(
				new TypeError("Attempted to assign to readonly property."),
			),
		).toBe(false);
	});

	test("neither is a 401 from telegram", () => {
		const error = Object.assign(new Error("401: Unauthorized"), {
			code: 401,
		});

		expect(isTransientNetworkError(error)).toBe(false);
	});

	test("nor anything that is not an object", () => {
		expect(isTransientNetworkError("ECONNRESET")).toBe(false);
		expect(isTransientNetworkError(undefined)).toBe(false);
		expect(isTransientNetworkError(null)).toBe(false);
	});

	test("node-fetch's own name still counts, since telegraf tests for it", () => {
		const error = new Error("request to … failed");

		error.name = "FetchError";

		expect(isTransientNetworkError(error)).toBe(true);
	});

	test("a transient cause under an opaque wrapper counts", () => {
		const error = new Error("fetch failed", {
			cause: Object.assign(new Error("read ECONNRESET"), {
				code: "ECONNRESET",
			}),
		});

		expect(isTransientNetworkError(error)).toBe(true);
	});
});
