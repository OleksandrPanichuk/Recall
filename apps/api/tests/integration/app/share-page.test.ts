import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	type AppSession,
	bodyOf as json,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";
import { aPage } from "../../fixtures/app-shapes";

const available = await postgresAvailable();

let session: AppSession;
let call: AppSession["app"];

interface Shared {
	readonly folderId: string;
	readonly name: string;
	readonly token: string;
}

interface PublicView {
	readonly name: string;
	readonly summary?: string;
	readonly icon?: string;
}

const publicly = (path: string): Promise<Response> =>
	fetch(`${session.origin}/public/${path}`);

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({ name: "app-share-page" });
	call = session.app;
});

afterAll(async () => {
	await session?.close();
});

describe.skipIf(!available)("sharing a page by link", () => {
	let folderId: string;
	let token: string;

	test("a page starts unshared, and browse says so", async () => {
		folderId = await aPage(call, "Durability");

		await call("pages/summary", {
			folderId,
			summary: "WAL is the write-ahead log.",
		});

		const view = await json<{ shareToken?: string }>(
			await call("browse", { folderId }),
		);

		expect(view.shareToken).toBeUndefined();
	});

	test("sharing mints a token long enough to be a link", async () => {
		const shared = await json<Shared>(await call("pages/share", { folderId }));

		token = shared.token;

		expect(shared.folderId).toBe(folderId);
		expect(shared.name).toBe("Durability");
		expect(token.length).toBeGreaterThanOrEqual(32);
		expect(token).not.toContain("-");
	});

	test("and browse hands the owner the same token back, so the link can be copied twice", async () => {
		const view = await json<{ shareToken?: string }>(
			await call("browse", { folderId }),
		);

		expect(view.shareToken).toBe(token);
	});

	test("sharing again is idempotent, not a new link every click", async () => {
		const again = await json<Shared>(await call("pages/share", { folderId }));

		expect(again.token).toBe(token);
	});

	test("the link reads the page with no session at all", async () => {
		const response = await publicly(`pages/${token}`);

		expect(response.status).toBe(200);

		const view = await json<PublicView>(response);

		expect(view.name).toBe("Durability");
		expect(view.summary).toContain("write-ahead log");
	});

	test("a token nobody minted is a 404, not an empty page", async () => {
		expect((await publicly("pages/not-a-real-token")).status).toBe(404);
	});

	test("rotating replaces the link, and the old one stops working", async () => {
		const rotated = await json<Shared>(
			await call("pages/share", { folderId, rotate: true }),
		);

		expect(rotated.token).not.toBe(token);
		expect((await publicly(`pages/${token}`)).status).toBe(404);
		expect((await publicly(`pages/${rotated.token}`)).status).toBe(200);

		token = rotated.token;
	});

	test("an image in a shared page is served without a session", async () => {
		const pixel = Uint8Array.from([
			0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
			0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
			0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
			0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
		]);
		const form = new FormData();

		form.append("file", new Blob([pixel], { type: "image/gif" }), "dot.gif");

		const uploaded = await fetch(`${session.origin}/app/uploads`, {
			method: "POST",
			headers: { cookie: session.cookie },
			body: form,
		});

		if (uploaded.status !== 201 && uploaded.status !== 200) {
			return;
		}

		const { id } = await json<{ id: string }>(uploaded);

		await call("pages/summary", {
			folderId,
			summary: `WAL is the write-ahead log.\n\n![dot](/app/uploads/${id})`,
		});

		const served = await publicly(`uploads/${token}/${id}`);

		expect(served.status).toBe(200);
		expect(served.headers.get("content-type")).toBe("image/gif");
	});

	test("but an upload the page never mentions is not", async () => {
		expect(
			(await publicly(`uploads/${token}/00000000-0000-4000-8000-000000000000`))
				.status,
		).toBe(404);
	});

	test("unsharing closes the link", async () => {
		expect((await call("pages/unshare", { folderId })).status).toBe(204);
		expect((await publicly(`pages/${token}`)).status).toBe(404);

		const view = await json<{ shareToken?: string }>(
			await call("browse", { folderId }),
		);

		expect(view.shareToken).toBeUndefined();
	});

	test("unsharing something that was never shared is not an error", async () => {
		expect((await call("pages/unshare", { folderId })).status).toBe(204);
	});

	test("a page that does not exist cannot be shared", async () => {
		const response = await call("pages/share", {
			folderId: "00000000-0000-4000-8000-000000000000",
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect((await json<{ error: string }>(response)).error).toBe(
			"FolderNotFoundError",
		);
	});
});
