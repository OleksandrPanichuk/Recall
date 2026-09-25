import { describe, expect, test } from "bun:test";
import { contentDisposition } from "./content-disposition";

describe("how a served attachment names itself", () => {
	test("without a name it is only the disposition", () => {
		expect(contentDisposition("inline")).toBe("inline");
		expect(contentDisposition("attachment")).toBe("attachment");
	});

	test("a plain name is quoted and repeated in the extended form", () => {
		expect(contentDisposition("inline", "dot.gif")).toBe(
			`inline; filename="dot.gif"; filename*=UTF-8''dot.gif`,
		);
	});

	test("a quote, a backslash or a line break cannot escape the header", () => {
		const header = contentDisposition(
			"attachment",
			'a"b\\c\r\nSet-Cookie: x=1.svg',
		);

		expect(header).not.toContain("\r");
		expect(header).not.toContain("\n");
		expect(header.split('"').length).toBe(3);
		expect(header).toContain(
			"filename*=UTF-8''a%22b%5Cc%0D%0ASet-Cookie%3A%20x%3D1.svg",
		);
	});

	test("a name outside ascii keeps its meaning in the extended form", () => {
		expect(contentDisposition("inline", "кіт's (1).png")).toBe(
			`inline; filename="___'s (1).png"; filename*=UTF-8''%D0%BA%D1%96%D1%82%27s%20%281%29.png`,
		);
	});
});
