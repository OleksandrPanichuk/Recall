import type { OwnerId } from "@/core/owner";
import type { PageId } from "@/modules/pages";
import type { PageShareEntity } from "./page-share.entity";

export interface SharedPageOwner {
	readonly owner: OwnerId;
	readonly pageId: PageId;
}

export abstract class PageSharesRepository {
	abstract shareOf(id: PageId): Promise<PageShareEntity | undefined>;
	abstract save(share: PageShareEntity): Promise<void>;
	abstract delete(id: PageId): Promise<void>;
}

export abstract class ShareTokens {
	abstract ownerFor(token: string): Promise<SharedPageOwner | undefined>;
}
