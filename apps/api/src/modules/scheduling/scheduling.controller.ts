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
import { listDueRepetitionsDto, listLeechesDto } from "./dto";
import { dueSetToWire, leechToWire } from "./schedule.model";
import { ListDueRepetitionsUseCase, ListLeechesUseCase } from "./use-cases";

@ApiExcludeController()
@UseGuards(SurfaceGuard)
@Controller(["bot", "app"])
export class SchedulingController {
	constructor(
		private readonly listDueRepetitions: ListDueRepetitionsUseCase,
		private readonly listLeeches: ListLeechesUseCase,
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
}
