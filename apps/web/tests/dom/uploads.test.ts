import { describe, expect, test } from "bun:test";
import { displayUrl } from "@/features/pages/lib/uploads";
import { API_ORIGIN } from "@/features/pages/lib/uploads.constants";

describe("where an uploaded image is fetched from", () => {
	test("resolves a stored path against the api that serves it", () => {
		expect(displayUrl("/app/uploads/abc")).toBe(
			`${API_ORIGIN}/app/uploads/abc`,
		);
	});

	test("leaves an external image alone", () => {
		expect(displayUrl("https://example.com/cat.png")).toBe(
			"https://example.com/cat.png",
		);
	});

	test("leaves a data uri alone", () => {
		expect(displayUrl("data:image/png;base64,AAAA")).toBe(
			"data:image/png;base64,AAAA",
		);
	});

	test("what is stored stays relative, so the markdown survives a move", () => {
		expect(displayUrl("/app/uploads/abc").endsWith("/app/uploads/abc")).toBe(
			true,
		);
	});
});
