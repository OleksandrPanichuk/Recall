import { Client } from "minio";

export interface MinioOptions {
	readonly endpoint: URL;
	readonly accessKey: string;
	readonly secretKey: string;
	readonly bucket: string;
}

export type MinioClient = Client;

export const createMinioClient = (options: MinioOptions): MinioClient =>
	new Client({
		endPoint: options.endpoint.hostname,
		port: Number(
			options.endpoint.port ||
				(options.endpoint.protocol === "https:" ? 443 : 80),
		),
		useSSL: options.endpoint.protocol === "https:",
		accessKey: options.accessKey,
		secretKey: options.secretKey,
	});
