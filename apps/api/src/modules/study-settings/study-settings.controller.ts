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
import { toQuizSetId } from "@/modules/quizzes";
import { parseBody } from "@/shared/http/parse-body";
import { resolveSettingsDto, updateSettingsDto } from "./dto";
import { resolvedSettingsToWire, settingsToWire } from "./study-settings.model";
import {
	ResolveQuizSettingsUseCase,
	UpdateQuizSettingsUseCase,
} from "./use-cases";

@ApiExcludeController()
@UseGuards(SurfaceGuard)
@Controller(["bot", "app"])
export class StudySettingsController {
	constructor(
		private readonly resolveQuizSettings: ResolveQuizSettingsUseCase,
		private readonly updateQuizSettings: UpdateQuizSettingsUseCase,
	) {}

	@Post(BOT_ROUTES.resolveSettings)
	@HttpCode(HttpStatus.OK)
	async resolveSettings(@Body() body: unknown) {
		const command = parseBody(resolveSettingsDto, body);

		return resolvedSettingsToWire(
			await this.resolveQuizSettings.execute({
				quizSetId:
					command.quizSetId === undefined
						? undefined
						: toQuizSetId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.updateSettings)
	@HttpCode(HttpStatus.OK)
	async updateSettings(@Body() body: unknown) {
		const command = parseBody(updateSettingsDto, body);

		return settingsToWire(
			await this.updateQuizSettings.execute({
				...command,
				repetition:
					command.repetition === undefined
						? undefined
						: {
								scheduler: command.repetition.scheduler,
								intervalsDays: [...command.repetition.intervalsDays],
								maxIntervalDays: command.repetition.maxIntervalDays,
								maxRepetitions: command.repetition.maxRepetitions,
								desiredRetention: command.repetition.desiredRetention,
							},
				quizSetId:
					command.quizSetId === undefined
						? undefined
						: toQuizSetId(command.quizSetId),
			}),
		);
	}
}
