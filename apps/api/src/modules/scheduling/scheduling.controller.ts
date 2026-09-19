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
import { toQuestionId } from "@/modules/quizzes";
import { parseBody } from "@/shared/http/parse-body";
import {
	listDueRepetitionsDto,
	listLeechesDto,
	listRetiredDto,
	retireQuestionDto,
} from "./dto";
import {
	dueSetToWire,
	leechToWire,
	retiredQuestionToWire,
	retiredToWire,
} from "./schedule.model";
import {
	ListDueRepetitionsUseCase,
	ListLeechesUseCase,
	ListRetiredUseCase,
	RetireQuestionUseCase,
} from "./use-cases";

@ApiExcludeController()
@UseGuards(SurfaceGuard)
@Controller(["bot", "app"])
export class SchedulingController {
	constructor(
		private readonly listDueRepetitions: ListDueRepetitionsUseCase,
		private readonly listLeeches: ListLeechesUseCase,
		private readonly listRetired: ListRetiredUseCase,
		private readonly retireQuestion: RetireQuestionUseCase,
	) {}

	@Post(BOT_ROUTES.dueRepetitions)
	@HttpCode(HttpStatus.OK)
	async due(@Body() body: unknown) {
		const command = parseBody(listDueRepetitionsDto, body);

		return (await this.listDueRepetitions.execute(command)).map(dueSetToWire);
	}

	@Post(BOT_ROUTES.leeches)
	@HttpCode(HttpStatus.OK)
	async leeches(@Body() body: unknown) {
		const command = parseBody(listLeechesDto, body);

		return (await this.listLeeches.execute(command)).map(leechToWire);
	}

	@Post(BOT_ROUTES.retired)
	@HttpCode(HttpStatus.OK)
	async retired(@Body() body: unknown) {
		const command = parseBody(listRetiredDto, body);

		return (await this.listRetired.execute(command)).map(retiredToWire);
	}

	@Post(BOT_ROUTES.retireQuestion)
	@HttpCode(HttpStatus.OK)
	async retire(@Body() body: unknown) {
		const command = parseBody(retireQuestionDto, body);

		return retiredQuestionToWire(
			await this.retireQuestion.execute({
				questionId: toQuestionId(command.questionId),
				retired: command.retired,
			}),
		);
	}
}
