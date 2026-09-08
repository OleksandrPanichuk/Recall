import {
	createMinioClient,
	type MinioClient,
	type MinioOptions,
} from "@/infrastructure/minio/minio.client";
import {
	type ObjectBody,
	ObjectStore,
	type StoredObject,
} from "@/modules/attachments/ports/object-store";

export class MinioObjectStore extends ObjectStore {
	private readonly client: MinioClient;

	private readonly ready: Promise<void>;

	constructor(private readonly options: MinioOptions) {
		super();
		const client = createMinioClient(options);

		this.client = client;
		this.ready = (async () => {
			if (!(await client.bucketExists(options.bucket))) {
				await client.makeBucket(options.bucket);
			}
		})();
	}

	async put(
		key: string,
		body: Buffer,
		contentType: string,
	): Promise<StoredObject> {
		await this.ready;
		await this.client.putObject(this.options.bucket, key, body, body.length, {
			"Content-Type": contentType,
		});

		return { key, contentType, size: body.length };
	}

	async get(key: string): Promise<ObjectBody | undefined> {
		await this.ready;

		try {
			const stat = await this.client.statObject(this.options.bucket, key);
			const stream = await this.client.getObject(this.options.bucket, key);

			return {
				stream,
				contentType:
					stat.metaData?.["content-type"] ?? "application/octet-stream",
				size: stat.size,
			};
		} catch {
			return undefined;
		}
	}

	async remove(key: string): Promise<void> {
		await this.ready;
		await this.client.removeObject(this.options.bucket, key);
	}
}
