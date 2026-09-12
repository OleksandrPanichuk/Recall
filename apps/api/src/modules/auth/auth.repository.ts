import type { OwnerId } from "@/core/owner";

export interface LinkAccountData {
	readonly id: string;
	readonly ownerId: OwnerId;
	readonly providerId: string;
	readonly accountId: string;
	readonly at: Date;
}

export interface RecordAuthEventData {
	readonly id: string;
	readonly kind: string;
	readonly subject: string;
	readonly ownerId?: OwnerId;
}

export abstract class AuthRepository {
	abstract findOwnerByAccount(
		providerId: string,
		accountId: string,
	): Promise<OwnerId | undefined>;

	abstract linkAccount(data: LinkAccountData): Promise<void>;

	abstract recordEvent(data: RecordAuthEventData): Promise<void>;
}
