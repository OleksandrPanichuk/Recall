import { eq } from "drizzle-orm";
import { type OwnerId, toOwnerId } from "@/application/ports/owner";
import type { RecallDatabase } from "@/db/client";
import { pageShares } from "@/db/schema";
import { type FolderId, toFolderId } from "@/domain/folder/folder";

export interface SharedPageOwner {
	readonly owner: OwnerId;
	readonly pageId: FolderId;
}

export async function ownerForShare(
	db: RecallDatabase,
	token: string,
): Promise<SharedPageOwner | undefined> {
	if (token.length === 0) {
		return undefined;
	}

	const [row] = await db
		.select({ ownerId: pageShares.ownerId, pageId: pageShares.pageId })
		.from(pageShares)
		.where(eq(pageShares.token, token))
		.limit(1);

	return row === undefined
		? undefined
		: { owner: toOwnerId(row.ownerId), pageId: toFolderId(row.pageId) };
}
