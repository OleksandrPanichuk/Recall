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
import { ApiTokensService } from "./api-tokens.service";
import { issueApiTokenDto, listApiTokensDto, revokeApiTokenDto } from "./dto";

@ApiExcludeController()
@UseGuards(BotTokenGuard)
@Controller("bot")
export class ApiTokensBotController {
	constructor(private readonly tokens: ApiTokensService) {}

	@Post(BOT_ROUTES.issueApiToken)
	@HttpCode(HttpStatus.OK)
	async issue(@Body() body: unknown) {
		const command = parseBody(issueApiTokenDto, body);
		const issued = await this.tokens.issue(
			await this.tokens.ownerForTelegram(command.telegramUserId),
			{ name: command.name, expiresInDays: command.expiresInDays },
		);

		return {
			id: issued.id,
			name: issued.name,
			token: issued.token,
			expiresAt: issued.expiresAt?.toISOString(),
		};
	}

	@Post(BOT_ROUTES.listApiTokens)
	@HttpCode(HttpStatus.OK)
	async list(@Body() body: unknown) {
		const command = parseBody(listApiTokensDto, body);
		const tokens = await this.tokens.list(
			await this.tokens.ownerForTelegram(command.telegramUserId),
		);

		return tokens.map((token) => ({
			id: token.id,
			name: token.name,
			scopes: [...token.scopes],
			lastUsedAt: token.lastUsedAt?.toISOString(),
			expiresAt: token.expiresAt?.toISOString(),
			createdAt: token.createdAt.toISOString(),
		}));
	}

	@Post(BOT_ROUTES.revokeApiToken)
	@HttpCode(HttpStatus.OK)
	async revoke(@Body() body: unknown) {
		const command = parseBody(revokeApiTokenDto, body);

		return {
			revoked: await this.tokens.revoke(
				await this.tokens.ownerForTelegram(command.telegramUserId),
				command.tokenId,
			),
		};
	}
}
