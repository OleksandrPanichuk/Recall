import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { APP_ROUTE_PREFIX, BOT_ROUTES } from "@recall/contracts";
import { SessionGuard } from "@/modules/auth";
import { toPageId } from "@/modules/pages";
import { parseBody } from "@/shared/http/parse-body";
import { sharePageDto, unsharePageDto } from "./dto";
import { sharedPageToWire } from "./page-share.model";
import { SharePageUseCase, UnsharePageUseCase } from "./use-cases";

@ApiExcludeController()
@UseGuards(SessionGuard)
@Controller(APP_ROUTE_PREFIX)
export class PageSharesSurfaceController {
	constructor(
		private readonly share: SharePageUseCase,
		private readonly unshare: UnsharePageUseCase,
	) {}

	@Post(BOT_ROUTES.sharePage)
	@HttpCode(HttpStatus.OK)
	async sharePage(@Body() body: unknown) {
		const command = parseBody(sharePageDto, body);

		return sharedPageToWire(
			await this.share.execute({
				folderId: toPageId(command.folderId),
				rotate: command.rotate,
			}),
		);
	}

	@Post(BOT_ROUTES.unsharePage)
	@HttpCode(HttpStatus.NO_CONTENT)
	async unsharePage(@Body() body: unknown) {
		const command = parseBody(unsharePageDto, body);

		await this.unshare.execute({ folderId: toPageId(command.folderId) });
	}
}
