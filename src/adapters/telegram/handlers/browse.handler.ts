import type { Context } from "telegraf";
import { toFolderId } from "@/domain/folder/folder";
import type { TelegramUseCases } from "../bot";
import type { BrowseCallback } from "../callbacks/callback-data";
import { browseScreen } from "../presenters/browse.presenter";
import { render } from "../screen";

export function browseHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, callback: BrowseCallback): Promise<void> => {
		const view = await useCases.browseFolder.execute({
			folderId:
				callback.folderId === undefined
					? undefined
					: toFolderId(callback.folderId),
		});

		await render(ctx, browseScreen(view, callback.leaf, callback.page ?? 0));
	};
}
