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
import { callerIsBot, SurfaceGuard } from "@/modules/auth";
import { toQuestionId, toQuizSetId } from "@/modules/quizzes";
import { parseBody } from "@/shared/http/parse-body";
import { startOwnPracticeDto, startPracticeDto } from "./dto";
import { practiceResultToWire } from "./practice.model";
import { StartPracticeSessionUseCase } from "./use-cases";

@ApiExcludeController()
@UseGuards(SurfaceGuard)
@Controller(["bot", "app"])
export class PracticeController {
	constructor(
		private readonly startPracticeSession: StartPracticeSessionUseCase,
	) {}

	@Post(BOT_ROUTES.practice)
	@HttpCode(HttpStatus.OK)
	async practice(@Body() body: unknown) {
		const command = parseBody(
			callerIsBot() ? startPracticeDto : startOwnPracticeDto,
			body,
		);

		return practiceResultToWire(
			await this.startPracticeSession.execute({
				...command,
				quizSetId: toQuizSetId(command.quizSetId),
				questionIds: command.questionIds?.map(toQuestionId),
			}),
		);
	}
}
