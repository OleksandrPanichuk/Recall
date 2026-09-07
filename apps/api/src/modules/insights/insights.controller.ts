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
import { SurfaceGuard } from "@/modules/auth";
import { parseBody } from "@/shared/http/parse-body";
import { getInsightsDto } from "./dto";
import { insightsToWire } from "./insights.model";
import { GetInsightsUseCase } from "./use-cases";

@ApiExcludeController()
@UseGuards(SurfaceGuard)
@Controller(["bot", "app"])
export class InsightsController {
	constructor(private readonly getInsights: GetInsightsUseCase) {}

	@Post(BOT_ROUTES.insights)
	@HttpCode(HttpStatus.OK)
	async insights(@Body() body: unknown) {
		const command = parseBody(getInsightsDto, body);

		return insightsToWire(await this.getInsights.execute(command));
	}
}
