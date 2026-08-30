export interface Attachment {
	readonly id: string;
	readonly objectKey: string;
	readonly contentType: string;
	readonly size: number;
	readonly originalName?: string;
}

export interface AttachmentRepository {
	save(attachment: Attachment): Promise<void>;
	findById(id: string): Promise<Attachment | undefined>;
}
