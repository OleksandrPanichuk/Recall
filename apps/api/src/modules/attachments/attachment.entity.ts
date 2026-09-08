export interface AttachmentEntity {
	readonly id: string;
	readonly objectKey: string;
	readonly contentType: string;
	readonly size: number;
	readonly originalName?: string;
}

export class AttachmentEntity {
	private constructor() {}

	static readonly ALLOWED_TYPES: readonly string[] = [
		"image/png",
		"image/jpeg",
		"image/gif",
		"image/webp",
		"image/svg+xml",
	];

	static readonly MAX_BYTES = 5 * 1024 * 1024;

	static objectKeyFor(owner: string, id: string): string {
		return `${owner}/${id}`;
	}

	static isAllowedType(contentType: string): boolean {
		return AttachmentEntity.ALLOWED_TYPES.includes(contentType);
	}

	static urlFor(id: string): string {
		return `/app/uploads/${id}`;
	}
}
