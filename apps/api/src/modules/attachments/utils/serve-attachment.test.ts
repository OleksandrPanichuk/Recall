import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import type { ServedAttachment } from "../attachments.types";
import { serveAttachment } from "./serve-attachment";

let server: Server | undefined;
let finished: Promise<unknown>[] = [];

afterEach(async () => {
	await Promise.allSettled(finished);
	finished = [];
	await new Promise<void>((resolve) =>
		server === undefined ? resolve() : server.close(() => resolve()),
	);
	server = undefined;
});

const serving = async (make: () => ServedAttachment): Promise<string> => {
	server = createServer((_request, response) => {
		finished.push(serveAttachment(response, make(), "private, max-age=60"));
	});
	await new Promise<void>((resolve) =>
		server?.listen(0, "127.0.0.1", () => resolve()),
	);

	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

const image = (
	contentType: string,
	originalName?: string,
): ServedAttachment => ({
	stream: Readable.from([Buffer.from("GIF89a")]),
	contentType,
	size: 6,
	originalName,
});

describe("serving a stored attachment", () => {
	test("a raster image renders inline but can never be sniffed into a document", async () => {
		const origin = await serving(() => image("image/gif", "dot.gif"));
		const response = await fetch(origin);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/gif");
		expect(response.headers.get("content-length")).toBe("6");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("content-security-policy")).toBe(
			"default-src 'none'; sandbox",
		);
		expect(response.headers.get("content-disposition")).toBe(
			`inline; filename="dot.gif"; filename*=UTF-8''dot.gif`,
		);
		expect(response.headers.get("cache-control")).toBe("private, max-age=60");
		expect(await response.text()).toBe("GIF89a");
	});

	test("an svg stored before they were refused downloads instead of rendering", async () => {
		const origin = await serving(() => image("image/svg+xml", "logo.svg"));
		const response = await fetch(origin);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toStartWith(
			"attachment",
		);
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("content-security-policy")).toBe(
			"default-src 'none'; sandbox",
		);
	});

	test("a store that drops the stream mid-body ends that response, not the process", async () => {
		const broken = (): ServedAttachment => {
			const stream = new Readable({ read() {} });

			stream.push(Buffer.from("GIF8"));
			setTimeout(
				() =>
					stream.destroy(
						Object.assign(new Error("socket hang up"), {
							code: "ECONNRESET",
						}),
					),
				10,
			);

			return {
				stream,
				contentType: "image/gif",
				size: 1024,
			};
		};
		const origin = await serving(broken);

		const received = await fetch(origin)
			.then((response) => response.arrayBuffer())
			.then(
				(body) => body.byteLength,
				() => 0,
			);

		expect(received).toBeLessThan(1024);
		expect(await Promise.allSettled(finished)).toEqual([
			{ status: "fulfilled", value: undefined },
		]);

		const again = await fetch(origin).then(
			() => "answered",
			() => "refused",
		);

		expect(again).toBe("answered");
	});
});
