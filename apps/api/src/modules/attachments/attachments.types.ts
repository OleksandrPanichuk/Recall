export interface UploadedImage {
	readonly buffer: Buffer;
	readonly mimetype: string;
	readonly size: number;
	readonly originalname: string;
}

export interface ServedAttachment {
	readonly stream: NodeJS.ReadableStream;
	readonly contentType: string;
	readonly size: number;
	readonly originalName?: string;
}
