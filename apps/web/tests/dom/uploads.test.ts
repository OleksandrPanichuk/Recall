import { afterEach, describe, expect, test } from "bun:test";
import { displayUrl, uploadImage } from "@/features/pages/lib/uploads";
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

describe("what the editor will try to upload", () => {
	const realFetch = globalThis.fetch;
	let requested: string[] = [];

	afterEach(() => {
		globalThis.fetch = realFetch;
		requested = [];
	});

	const recordingFetch = (): void => {
		globalThis.fetch = (async (input: string | URL | Request) => {
			requested.push(String(input));

			return new Response(JSON.stringify({ id: "abc" }), { status: 201 });
		}) as typeof fetch;
	};

	test("an svg is refused before it leaves the browser", async () => {
		recordingFetch();

		await expect(
			uploadImage(new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" })),
		).rejects.toThrow("PNG, JPEG, GIF or WebP");
		expect(requested).toEqual([]);
	});

	test("a raster image is sent and comes back as a relative path", async () => {
		recordingFetch();

		expect(
			await uploadImage(new File(["x"], "dot.gif", { type: "image/gif" })),
		).toBe("/app/uploads/abc");
		expect(requested).toEqual([`${API_ORIGIN}/app/uploads`]);
	});
});
