import { Client } from "minio";
import type {
	ObjectBody,
	ObjectStore,
	StoredObject,
} from "@/application/ports/object-store";

export interface MinioOptions {
	readonly endpoint: URL;
	readonly accessKey: string;
	readonly secretKey: string;
	readonly bucket: string;
}

export function createMinioObjectStore(options: MinioOptions): ObjectStore {
	const client = new Client({
		endPoint: options.endpoint.hostname,
		port: Number(
			options.endpoint.port ||
				(options.endpoint.protocol === "https:" ? 443 : 80),
		),
		useSSL: options.endpoint.protocol === "https:",
		accessKey: options.accessKey,
		secretKey: options.secretKey,
	});

	const ready = (async () => {
		if (!(await client.bucketExists(options.bucket))) {
			await client.makeBucket(options.bucket);
		}
	})();

	return {
		async put(
			key: string,
			body: Buffer,
			contentType: string,
		): Promise<StoredObject> {
			await ready;
			await client.putObject(options.bucket, key, body, body.length, {
				"Content-Type": contentType,
			});

			return { key, contentType, size: body.length };
		},

		async get(key: string): Promise<ObjectBody | undefined> {
			await ready;

			try {
				const stat = await client.statObject(options.bucket, key);
				const stream = await client.getObject(options.bucket, key);

				return {
					stream,
					contentType:
						stat.metaData?.["content-type"] ?? "application/octet-stream",
					size: stat.size,
				};
			} catch {
				return undefined;
			}
		},

		async remove(key: string): Promise<void> {
			await ready;
			await client.removeObject(options.bucket, key);
		},
	};
}
