import { describe, expect, test } from "bun:test";
import { PageShareEntity } from "./page-share.entity";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("which uploads a shared page is allowed to serve", () => {
	test("none, when the page has no summary at all", () => {
		expect(PageShareEntity.referencedUploads(undefined).size).toBe(0);
		expect(PageShareEntity.referencedUploads("").size).toBe(0);
	});

	test("the one an image points at", () => {
		expect([
			...PageShareEntity.referencedUploads(`![a](/app/uploads/${A})`),
		]).toEqual([A]);
	});

	test("every distinct one, counted once", () => {
		const markdown = `![a](/app/uploads/${A}) ![b](/app/uploads/${B}) ![again](/app/uploads/${A})`;

		expect(PageShareEntity.referencedUploads(markdown).size).toBe(2);
	});

	test("one written in upper case, because a uuid is not case sensitive", () => {
		expect(
			PageShareEntity.referencedUploads(`/app/uploads/${A.toUpperCase()}`).has(
				A,
			),
		).toBe(true);
	});

	test("not one that merely appears as text, without the upload path", () => {
		expect(PageShareEntity.referencedUploads(`the id is ${A}`).size).toBe(0);
	});

	test("and not one behind a different path that ends the same way", () => {
		expect(PageShareEntity.referencedUploads(`/api/uploads/${A}`).size).toBe(0);
	});

	test("a reference inside a link, not only an image", () => {
		expect(
			PageShareEntity.referencedUploads(`[the file](/app/uploads/${A})`).has(A),
		).toBe(true);
	});
});
