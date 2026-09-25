import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ApiErrorName } from "@recall/contracts";
import postgres from "postgres";
import {
	type AppSession,
	bodyOf as json,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";
import { aPage } from "../../fixtures/app-shapes";

const available = await postgresAvailable();

const PIXEL = Uint8Array.from([
	0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
	0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
	0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
	0x44, 0x01, 0x00, 0x3b,
]);
const SVG = new TextEncoder().encode(
	'<svg xmlns="http://www.w3.org/2000/svg"><script>fetch("/app/browse")</script></svg>',
);
const QUOTA = PIXEL.length * 3;

let session: AppSession;
let sql: postgres.Sql;

const upload = (
	bytes: Uint8Array<ArrayBuffer>,
	type: string,
	name: string,
	cookie: string = session.cookie,
): Promise<Response> => {
	const form = new FormData();

	form.append("file", new Blob([bytes], { type }), name);

	return fetch(`${session.origin}/app/uploads`, {
		method: "POST",
		headers: { cookie },
		body: form,
	});
};

const read = (id: string, cookie: string = session.cookie): Promise<Response> =>
	fetch(`${session.origin}/app/uploads/${id}`, { headers: { cookie } });

const expectHardened = (response: Response): void => {
	expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	expect(response.headers.get("content-security-policy")).toBe(
		"default-src 'none'; sandbox",
	);
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({
		name: "app-uploads",
		env: { UPLOAD_QUOTA_BYTES: String(QUOTA) },
	});
	sql = postgres(process.env.DATABASE_URL as string, {
		max: 1,
		prepare: false,
		onnotice: () => {},
	});
});

afterAll(async () => {
	await sql?.end({ timeout: 5 });
	await session?.close();
});

describe.skipIf(!available)("uploading an image", () => {
	let gifId: string;

	test("an svg is refused, because it is a document that runs script on the api's origin", async () => {
		const response = await upload(SVG, "image/svg+xml", "logo.svg");

		expect(response.status).toBe(400);
		expect((await json<{ error: string }>(response)).error).toBe(
			"UnsupportedImageError",
		);
	});

	test("markup that calls itself a png is refused on its bytes", async () => {
		const response = await upload(SVG, "image/png", "logo.png");

		expect(response.status).toBe(400);
		expect((await json<{ error: string }>(response)).error).toBe(
			"UnsupportedImageError",
		);
	});

	test("a gif is stored and served inline, but never as something to sniff", async () => {
		const response = await upload(PIXEL, "image/gif", "dot.gif");

		expect(response.status).toBe(201);

		gifId = (await json<{ id: string }>(response)).id;

		const served = await read(gifId);

		expect(served.status).toBe(200);
		expect(served.headers.get("content-type")).toBe("image/gif");
		expect(served.headers.get("content-disposition")).toStartWith("inline");
		expectHardened(served);
		expect(new Uint8Array(await served.arrayBuffer())).toEqual(PIXEL);
	});

	test("the shared route is hardened the same way", async () => {
		const folderId = await aPage(session.app, "Pixels");

		await session.app("pages/summary", {
			folderId,
			summary: `![dot](/app/uploads/${gifId})`,
		});

		const { token } = await json<{ token: string }>(
			await session.app("pages/share", { folderId }),
		);
		const served = await fetch(
			`${session.origin}/public/uploads/${token}/${gifId}`,
		);

		expect(served.status).toBe(200);
		expect(served.headers.get("content-type")).toBe("image/gif");
		expect(served.headers.get("content-disposition")).toStartWith("inline");
		expectHardened(served);
	});

	test("an svg stored before they were refused still reads, as a download", async () => {
		const [row] = await sql<{ id: string }[]>`
			update attachments
			set content_type = 'image/svg+xml'::text
			where id = ${gifId}::uuid
			returning id`;

		expect(row?.id).toBe(gifId);

		const served = await read(gifId);

		expect(served.status).toBe(200);
		expect(served.headers.get("content-disposition")).toStartWith("attachment");
		expectHardened(served);
	});

	test("an account that fills its quota is refused by name, and only that account", async () => {
		const other = await session.signUp("quota@example.com", "a-long-password");

		for (let index = 0; index < 3; index += 1) {
			expect((await upload(PIXEL, "image/gif", "dot.gif", other)).status).toBe(
				201,
			);
		}

		const refused = await upload(PIXEL, "image/gif", "dot.gif", other);

		expect(refused.status).toBe(413);
		expect((await json<{ error: string }>(refused)).error).toBe(
			ApiErrorName.UploadQuotaExceeded,
		);

		expect((await upload(PIXEL, "image/gif", "dot.gif")).status).toBe(201);
	});
});
