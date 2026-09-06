import { describe, expect, test } from "bun:test";
import { displayUrl, sharedUrl } from "@/features/pages/lib/uploads";
import { shareLink } from "@/shared/constants/sharing";

const TOKEN = "9f8e7d6c5b4a39281706f5e4d3c2b1a0";
const IMAGE = "11111111-1111-4111-8111-111111111111";

describe("the link a reader is given", () => {
	test("hangs off the origin the owner is looking at", () => {
		expect(shareLink("https://recall.example.com", TOKEN)).toBe(
			`https://recall.example.com/p/${TOKEN}`,
		);
	});

	test("does not double the slash when the origin has one", () => {
		expect(shareLink("https://recall.example.com/", TOKEN)).toBe(
			`https://recall.example.com/p/${TOKEN}`,
		);
	});
});

describe("images inside a shared page", () => {
	test("go to the public route, not the one that needs a session", () => {
		expect(sharedUrl(TOKEN)(`/app/uploads/${IMAGE}`)).toContain(
			`/public/uploads/${TOKEN}/${IMAGE}`,
		);
	});

	test("and never to /app/uploads, which would 404 for a stranger", () => {
		expect(sharedUrl(TOKEN)(`/app/uploads/${IMAGE}`)).not.toContain(
			"/app/uploads",
		);
	});

	test("an outside url is left exactly as written", () => {
		const external = "https://example.com/cat.png";

		expect(sharedUrl(TOKEN)(external)).toBe(external);
		expect(displayUrl(external)).toBe(external);
	});

	test("the owner's own view still uses the session route", () => {
		expect(displayUrl(`/app/uploads/${IMAGE}`)).toContain(
			`/app/uploads/${IMAGE}`,
		);
	});
});
