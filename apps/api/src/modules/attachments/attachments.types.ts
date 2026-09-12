export interface UploadedImage {
	readonly buffer: Buffer;
	readonly mimetype: string;
	readonly size: number;
	readonly originalname: string;
}
