import { describe, expect, test } from "bun:test";
import {
	clip,
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

	test("stops walking past the requested depth", () => {
		expect(sanitiseFields({ a: { b: { c: "deep" } } }, 1)).toEqual({
			a: { b: "[nested]" },
		});
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
