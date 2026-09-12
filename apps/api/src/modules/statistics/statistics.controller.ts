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
import { toQuizAttemptId } from "@/modules/attempts";
import { SurfaceGuard } from "@/modules/auth";
import { toQuizSetId } from "@/modules/quizzes";
import { parseBody } from "@/shared/http/parse-body";
import { getAttemptDetailDto, getStatisticsDto } from "./dto";
import { attemptDetailToWire, statisticsToWire } from "./statistics.model";
import { GetAttemptDetailUseCase, GetQuizStatisticsUseCase } from "./use-cases";

@ApiExcludeController()
@UseGuards(SurfaceGuard)
@Controller(["bot", "app"])
export class StatisticsController {
	constructor(
		private readonly getQuizStatistics: GetQuizStatisticsUseCase,
		private readonly getAttemptDetail: GetAttemptDetailUseCase,
	) {}

	@Post(BOT_ROUTES.statistics)
	@HttpCode(HttpStatus.OK)
	async statistics(@Body() body: unknown) {
		const command = parseBody(getStatisticsDto, body);

		return statisticsToWire(
			await this.getQuizStatistics.execute({
				...command,
				quizSetId: toQuizSetId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.attemptDetail)
	@HttpCode(HttpStatus.OK)
	async attemptDetail(@Body() body: unknown) {
		const command = parseBody(getAttemptDetailDto, body);

		return attemptDetailToWire(
			await this.getAttemptDetail.execute({
				...command,
				attemptId: toQuizAttemptId(command.attemptId),
			}),
		);
	}
}
