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

export interface ObjectStore {
	put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
	get(key: string): Promise<ObjectBody | undefined>;
	remove(key: string): Promise<void>;
}
