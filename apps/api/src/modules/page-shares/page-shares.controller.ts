import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";
import { AttachmentsRepository, ObjectStore } from "@/modules/attachments";
import { runAs } from "@/shared/request-context";
import { PageShareEntity } from "./page-share.entity";
import { ShareTokens } from "./page-shares.repository";
import { ReadSharedPageUseCase, type SharedPageView } from "./use-cases";

@ApiExcludeController()
@Controller("public")
export class PageSharesController {
	constructor(
		private readonly tokens: ShareTokens,
		private readonly readSharedPage: ReadSharedPageUseCase,
		private readonly attachments: AttachmentsRepository,
		private readonly objects: ObjectStore,
	) {}

	private async sharedPage(token: string): Promise<{
		readonly pageId: string;
		readonly owner: string;
		readonly view: SharedPageView;
	}> {
		const share = await this.tokens.ownerFor(token);

		if (share === undefined) {
			throw new NotFoundException();
		}

		try {
			const view = await runAs(
				{ kind: "share", owner: share.owner, pageId: String(share.pageId) },
				() => this.readSharedPage.execute({ folderId: share.pageId }),
			);

			return { pageId: String(share.pageId), owner: String(share.owner), view };
		} catch {
			throw new NotFoundException();
		}
	}

	@Get("pages/:token")
	async page(@Param("token") token: string): Promise<{
		readonly name: string;
		readonly icon?: string;
		readonly summary?: string;
		readonly updatedAt: string;
	}> {
		const { view } = await this.sharedPage(token);

		return {
			name: view.name,
			icon: view.icon,
			summary: view.summary,
			updatedAt: view.updatedAt.toISOString(),
		};
	}

	@Get("uploads/:token/:id")
	async upload(
		@Param("token") token: string,
		@Param("id") id: string,
		@Res() response: Response,
	): Promise<void> {
		const { owner, view } = await this.sharedPage(token);

		if (
			!PageShareEntity.referencedUploads(view.summary).has(id.toLowerCase())
		) {
			throw new NotFoundException();
		}

		const attachment = await runAs(
			{ kind: "instance", owner: owner as never },
			() => this.attachments.findById(id),
		);

		if (attachment === undefined) {
			throw new NotFoundException();
		}

		const body = await this.objects.get(attachment.objectKey);

		if (body === undefined) {
			throw new NotFoundException();
		}

		response.setHeader("content-type", body.contentType);
		response.setHeader("content-length", String(body.size));
		response.setHeader("cache-control", "public, max-age=3600");
		body.stream.pipe(response);
	}
}
