import {
	Controller,
	Get,
	Inject,
	NotFoundException,
	Param,
	Res,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";
import { USE_CASES_FOR } from "@/application/tokens";
import { referencedUploads } from "@/application/use-cases/sharing/referenced-uploads";
import { DatabaseConnection } from "@/db/connection";
import { ObjectStore } from "@/modules/attachments";
import { ownerForShare } from "@/persistence/postgres/share";
import { scopeFor } from "@/persistence/postgres/unit-of-work";
import { sharedPageViewToWire } from "../bot/wire";
import type { UseCasesFor } from "../shared/database/use-cases-for";

@ApiExcludeController()
@Controller("public")
export class PublicController {
	constructor(
		@Inject(USE_CASES_FOR) private readonly useCasesFor: UseCasesFor,
		private readonly connection: DatabaseConnection,
		private readonly objects: ObjectStore,
	) {}

	private async sharedPage(token: string) {
		const share = await ownerForShare(this.connection.db, token);

		if (share === undefined) {
			throw new NotFoundException();
		}

		try {
			return {
				share,
				view: await this.useCasesFor(share.owner).readSharedPage.execute({
					folderId: share.pageId,
				}),
			};
		} catch {
			throw new NotFoundException();
		}
	}

	@Get("pages/:token")
	async page(@Param("token") token: string) {
		return sharedPageViewToWire((await this.sharedPage(token)).view);
	}

	@Get("uploads/:token/:id")
	async upload(
		@Param("token") token: string,
		@Param("id") id: string,
		@Res() response: Response,
	): Promise<void> {
		const { share, view } = await this.sharedPage(token);

		if (!referencedUploads(view.summary).has(id.toLowerCase())) {
			throw new NotFoundException();
		}

		const attachment = await scopeFor(
			this.connection.db,
			share.owner,
		).attachments.findById(id);

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
