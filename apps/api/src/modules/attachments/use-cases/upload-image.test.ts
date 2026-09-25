import { beforeEach, describe, expect, test } from "bun:test";
import { createMemoryAttachmentRepository } from "@tests/fixtures/memory/attachment.repository";
import { emptyStore, type MemoryStore } from "@tests/fixtures/memory/store";
import { toOwnerId } from "@/core/owner";
import { IdGenerator } from "@/core/ports/id-generator";
import { FixedOwnerContext } from "@/shared/request-context/fixed-owner-context";
import type { AttachmentEntity } from "../attachment.entity";
import {
	UnsupportedImageError,
	UploadQuotaExceededError,
} from "../attachments.errors";
import type { AttachmentsRepository } from "../attachments.repository";
import {
	type ObjectBody,
	ObjectStore,
	type StoredObject,
} from "../ports/object-store";
import { UploadQuota } from "../upload-quota";
import { UploadImageUseCase } from "./upload-image";

const OWNER = toOwnerId("owner-1");

const PNG = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const SVG = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>',
);

class RecordingObjectStore extends ObjectStore {
	readonly objects = new Map<string, { body: Buffer; contentType: string }>();

	async put(
		key: string,
		body: Buffer,
		contentType: string,
	): Promise<StoredObject> {
		this.objects.set(key, { body, contentType });

		return { key, contentType, size: body.length };
	}

	async get(): Promise<ObjectBody | undefined> {
		return undefined;
	}

	async remove(key: string): Promise<void> {
		this.objects.delete(key);
	}
}

class CountingIds extends IdGenerator {
	private next = 0;

	generate(): string {
		this.next += 1;

		return `00000000-0000-4000-8000-${String(this.next).padStart(12, "0")}`;
	}
}

let store: MemoryStore;
let attachments: AttachmentsRepository;
let objects: RecordingObjectStore;

const uploader = (
	quotaBytes = 1024,
	repository: AttachmentsRepository = attachments,
): UploadImageUseCase =>
	new UploadImageUseCase(
		repository,
		objects,
		new FixedOwnerContext(OWNER),
		new CountingIds(),
		new UploadQuota(quotaBytes),
	);

const upload = (
	body: Buffer,
	contentType: string,
	use: UploadImageUseCase = uploader(),
) => use.execute({ body, contentType, originalName: "x" });

beforeEach(() => {
	store = emptyStore();
	attachments = createMemoryAttachmentRepository(store);
	objects = new RecordingObjectStore();
});

describe("UploadImageUseCase", () => {
	test("stores a raster image under the type its bytes say it is", async () => {
		const { id, url } = await upload(PNG, "image/png");

		expect(url).toBe(`/app/uploads/${id}`);
		expect((await attachments.findById(id))?.contentType).toBe("image/png");
		expect([...objects.objects.values()][0]?.contentType).toBe("image/png");
	});

	test("refuses an svg, which is a document that can run script", async () => {
		await expect(upload(SVG, "image/svg+xml")).rejects.toBeInstanceOf(
			UnsupportedImageError,
		);
		expect(objects.objects.size).toBe(0);
	});

	test("refuses markup that claims to be a png", async () => {
		await expect(upload(SVG, "image/png")).rejects.toBeInstanceOf(
			UnsupportedImageError,
		);
		expect(objects.objects.size).toBe(0);
	});

	test("reads the claimed type without regard to case or padding", async () => {
		const { id } = await upload(PNG, " Image/PNG ");

		expect((await attachments.findById(id))?.contentType).toBe("image/png");
	});

	test("refuses a png that claims to be something else", async () => {
		await expect(upload(PNG, "image/gif")).rejects.toBeInstanceOf(
			UnsupportedImageError,
		);
		expect(objects.objects.size).toBe(0);
	});

	test("removes the stored object when the row cannot be written", async () => {
		const failing: AttachmentsRepository = {
			save: async () => {
				throw new Error("insert failed");
			},
			findById: attachments.findById,
			totalSize: attachments.totalSize,
		};

		await expect(
			upload(PNG, "image/png", uploader(1024, failing)),
		).rejects.toThrow("insert failed");
		expect(objects.objects.size).toBe(0);
	});

	test("refuses an upload that would take the owner past the quota", async () => {
		const use = uploader(PNG.length * 2);

		await upload(PNG, "image/png", use);
		await upload(PNG, "image/png", use);

		await expect(upload(PNG, "image/png", use)).rejects.toBeInstanceOf(
			UploadQuotaExceededError,
		);
		expect(objects.objects.size).toBe(2);
	});

	test("counts what is already stored, not what this process uploaded", async () => {
		const existing: AttachmentEntity = {
			id: "00000000-0000-4000-8000-00000000ffff",
			objectKey: "owner-1/old",
			contentType: "image/png",
			size: 1000,
		};

		await attachments.save(existing);

		await expect(
			upload(PNG, "image/png", uploader(1005)),
		).rejects.toBeInstanceOf(UploadQuotaExceededError);
	});
});
