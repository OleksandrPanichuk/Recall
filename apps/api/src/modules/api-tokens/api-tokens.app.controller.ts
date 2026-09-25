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
import { parseBody } from "@/shared/http/parse-body";
import { ApiTokensService } from "./api-tokens.service";
import {
	issueOwnApiTokenDto,
	listOwnApiTokensDto,
	revokeOwnApiTokenDto,
} from "./dto";

@ApiExcludeController()
@UseGuards(SessionGuard)
@Controller(APP_ROUTE_PREFIX)
export class ApiTokensAppController {
	constructor(private readonly tokens: ApiTokensService) {}

	@Post(BOT_ROUTES.issueApiToken)
	@HttpCode(HttpStatus.OK)
	async issue(@Body() body: unknown) {
		const command = parseBody(issueOwnApiTokenDto, body);
		const issued = await this.tokens.issue({
			name: command.name,
			expiresInDays: command.expiresInDays,
		});

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
		parseBody(listOwnApiTokensDto, body);

		return (await this.tokens.list()).map((token) => ({
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
		const command = parseBody(revokeOwnApiTokenDto, body);

		return { revoked: await this.tokens.revoke(command.tokenId) };
	}
}
