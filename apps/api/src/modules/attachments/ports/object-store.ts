export interface StoredObject {
	readonly key: string;
	readonly contentType: string;
	readonly size: number;
}

export interface ObjectBody {
	readonly stream: NodeJS.ReadableStream;
	readonly contentType: string;
	readonly size: number;
}

export abstract class ObjectStore {
	abstract put(
		key: string,
		body: Buffer,
		contentType: string,
	): Promise<StoredObject>;
	abstract get(key: string): Promise<ObjectBody | undefined>;
	abstract remove(key: string): Promise<void>;
}
