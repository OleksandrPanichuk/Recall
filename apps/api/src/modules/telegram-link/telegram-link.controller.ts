import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { BOT_ROUTES } from "@recall/contracts";
import { BotTokenGuard } from "@/modules/auth";
import { parseBody } from "@/shared/http/parse-body";
import { issueLoginLinkDto } from "./dto";
import { IssueLoginLinkUseCase } from "./use-cases";

@ApiExcludeController()
@UseGuards(BotTokenGuard)
@Controller("bot")
export class TelegramLinkController {
	constructor(private readonly issueLoginLink: IssueLoginLinkUseCase) {}

	@Post(BOT_ROUTES.loginLink)
	@HttpCode(HttpStatus.OK)
	async loginLink(@Body() body: unknown) {
		const command = parseBody(issueLoginLinkDto, body);
		const link = await this.issueLoginLink.execute({
			telegramUserId: command.telegramUserId,
			displayName: command.displayName,
		});

		return { url: link.url, expiresAt: link.expiresAt.toISOString() };
	}
}
