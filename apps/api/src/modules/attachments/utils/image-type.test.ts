import { describe, expect, test } from "bun:test";
import { imageTypeOf } from "./image-type";

const bytes = (...values: number[]): Buffer => Buffer.from(values);

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const GIF87 = Buffer.from("GIF87a\x01\x00", "latin1");
const GIF89 = Buffer.from("GIF89a\x01\x00", "latin1");
const WEBP = Buffer.concat([
	Buffer.from("RIFF", "latin1"),
	bytes(0x24, 0x00, 0x00, 0x00),
	Buffer.from("WEBPVP8 ", "latin1"),
]);

describe("what an uploaded file really is", () => {
	test("reads each raster format from its signature", () => {
		expect(imageTypeOf(PNG)).toBe("image/png");
		expect(imageTypeOf(JPEG)).toBe("image/jpeg");
		expect(imageTypeOf(GIF87)).toBe("image/gif");
		expect(imageTypeOf(GIF89)).toBe("image/gif");
		expect(imageTypeOf(WEBP)).toBe("image/webp");
	});

	test("an svg is not an image it will serve, whatever it calls itself", () => {
		expect(
			imageTypeOf(
				Buffer.from(
					'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
				),
			),
		).toBeUndefined();
	});

	test("html is not an image", () => {
		expect(imageTypeOf(Buffer.from("<!doctype html><script>"))).toBeUndefined();
	});

	test("a riff container that is not webp is not an image", () => {
		expect(
			imageTypeOf(
				Buffer.concat([
					Buffer.from("RIFF", "latin1"),
					bytes(0x24, 0x00, 0x00, 0x00),
					Buffer.from("WAVEfmt ", "latin1"),
				]),
			),
		).toBeUndefined();
	});

	test("a file too short to carry a signature is not an image", () => {
		expect(imageTypeOf(bytes())).toBeUndefined();
		expect(imageTypeOf(bytes(0x89, 0x50))).toBeUndefined();
	});
});
