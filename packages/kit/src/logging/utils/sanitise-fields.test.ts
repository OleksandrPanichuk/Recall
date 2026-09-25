import { describe, expect, test } from "bun:test";
import {
	clip,
	MAX_ERROR_DEPTH,
	MAX_ERROR_MESSAGE_LENGTH,
	MAX_FIELD_LENGTH,
	REDACTED,
	sanitiseFields,
} from "./sanitise-fields";

describe("sanitiseFields", () => {
	test("passes through primitives and dates", () => {
		expect(
			sanitiseFields({
				count: 3,
				ok: true,
				at: new Date("2026-08-01T10:00:00.000Z"),
				missing: undefined,
			}),
		).toEqual({
			count: 3,
			ok: true,
			at: "2026-08-01T10:00:00.000Z",
			missing: undefined,
		});
	});

	test("refuses to serialise a function", () => {
		expect(sanitiseFields({ callback: () => {} }).callback).toBe(
			"[unloggable]",
		);
	});

	test("redacts a sensitive key at any depth within the walked levels", () => {
		expect(sanitiseFields({ nested: { apiKey: "abc" } })).toEqual({
			nested: { apiKey: REDACTED },
		});
	});

	test("stops at the depth bound even when the leaf is a string", () => {
		const fields = sanitiseFields({
			update: { message: { text: "the whole message body of the user" } },
		});

		expect(fields).toEqual({ update: { message: { text: "[nested]" } } });
		expect(JSON.stringify(fields)).not.toContain("message body");
	});

	test("stops walking past the requested depth", () => {
		expect(sanitiseFields({ a: { b: { c: "deep" } } }, 1)).toEqual({
			a: { b: "[nested]" },
		});
	});
});

describe("sanitiseFields on an error", () => {
	test("keeps the chain of causes that explains it", () => {
		const error = new Error("could not start attempt", {
			cause: new Error("query failed", {
				cause: new Error("connect ECONNREFUSED 127.0.0.1:55432"),
			}),
		});

		expect(sanitiseFields({ error }).error).toEqual({
			name: "Error",
			message: "could not start attempt",
			cause: {
				name: "Error",
				message: "query failed",
				cause: {
					name: "Error",
					message: "connect ECONNREFUSED 127.0.0.1:55432",
				},
			},
		});
	});

	test("stops following causes past the depth bound", () => {
		let error = new Error("level 0");

		for (let level = 1; level <= MAX_ERROR_DEPTH + 2; level += 1) {
			error = new Error(`level ${level}`, { cause: error });
		}

		const text = JSON.stringify(sanitiseFields({ error }));

		expect(text).toContain(`level ${MAX_ERROR_DEPTH + 2}`);
		expect(text).toContain("[nested]");
		expect(text).not.toContain('"level 0"');
	});

	test("carries code, status and errorName when the error has them", () => {
		const error = Object.assign(new Error("refused"), {
			code: "ECONNRESET",
			status: 409,
			errorName: "AttemptAlreadyInProgressError",
		});

		expect(sanitiseFields({ error }).error).toEqual({
			name: "Error",
			message: "refused",
			code: "ECONNRESET",
			status: 409,
			errorName: "AttemptAlreadyInProgressError",
		});
	});

	test("clips an error message at its own, longer bound", () => {
		const long = "m".repeat(MAX_ERROR_MESSAGE_LENGTH + 3);
		const { message } = sanitiseFields({ error: new Error(long) }).error as {
			message: string;
		};

		expect(MAX_ERROR_MESSAGE_LENGTH).toBeGreaterThan(MAX_FIELD_LENGTH);
		expect(message).toStartWith("m".repeat(MAX_ERROR_MESSAGE_LENGTH));
		expect(message).toEndWith("…(+3)");
	});

	test("a cause that is not an error is logged as a value", () => {
		const error = new Error("wrapped", { cause: { reason: "timeout" } });

		expect(sanitiseFields({ error }).error).toEqual({
			name: "Error",
			message: "wrapped",
			cause: { reason: "timeout" },
		});
	});

	test("a secret carried in a cause is still redacted", () => {
		const error = new Error("wrapped", {
			cause: { apiToken: "recall_pat_abc", reason: "expired" },
		});

		expect(JSON.stringify(sanitiseFields({ error }))).not.toContain(
			"recall_pat_abc",
		);
	});

	test("does not carry arbitrary properties off an error", () => {
		const error = Object.assign(new Error("boom"), {
			password: "hunter2",
			body: { text: "private" },
		});

		expect(JSON.stringify(sanitiseFields({ error }))).not.toContain("hunter2");
		expect(JSON.stringify(sanitiseFields({ error }))).not.toContain("private");
	});
});

describe("clip", () => {
	test("leaves a short value untouched", () => {
		expect(clip("short")).toBe("short");
	});

	test("reports how much it removed", () => {
		expect(clip("C".repeat(MAX_FIELD_LENGTH + 5))).toEndWith("…(+5)");
	});
});
