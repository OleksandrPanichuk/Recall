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
import { toQuizSetId } from "@/modules/quizzes";
import { parseBody } from "@/shared/http/parse-body";
import {
	addVocabularyDto,
	listVocabularyDto,
	updateVocabularyDto,
} from "./dto";
import { toVocabularyItemId } from "./term-pair.entity";
import {
	AddVocabularyUseCase,
	ListVocabularyUseCase,
	UpdateVocabularyUseCase,
} from "./use-cases";

@ApiExcludeController()
@UseGuards(SessionGuard)
@Controller(APP_ROUTE_PREFIX)
export class VocabularyController {
	constructor(
		private readonly listVocabulary: ListVocabularyUseCase,
		private readonly addVocabulary: AddVocabularyUseCase,
		private readonly updateVocabulary: UpdateVocabularyUseCase,
	) {}

	@Post(BOT_ROUTES.listVocabulary)
	@HttpCode(HttpStatus.OK)
	async list(@Body() body: unknown) {
		const command = parseBody(listVocabularyDto, body);

		return (
			await this.listVocabulary.execute({
				quizSetId: toQuizSetId(command.quizSetId),
			})
		).map((item) => ({
			itemId: String(item.itemId),
			terms: [...item.terms],
			translations: [...item.translations],
			transcription: item.transcription,
			example: item.example,
			topic: item.topic,
			questionIds: [...item.questionIds],
		}));
	}

	@Post(BOT_ROUTES.addVocabulary)
	@HttpCode(HttpStatus.OK)
	async add(@Body() body: unknown) {
		const command = parseBody(addVocabularyDto, body);
		const result = await this.addVocabulary.execute({
			...command,
			quizSetId: toQuizSetId(command.quizSetId),
		});

		return {
			itemIds: result.itemIds.map(String),
			addedQuestionCount: result.addedQuestionCount,
			alreadyPresent: result.alreadyPresent,
		};
	}

	@Post(BOT_ROUTES.updateVocabulary)
	@HttpCode(HttpStatus.OK)
	async update(@Body() body: unknown) {
		const command = parseBody(updateVocabularyDto, body);
		const result = await this.updateVocabulary.execute({
			...command,
			itemId: toVocabularyItemId(command.itemId),
		});

		return {
			itemId: String(result.itemId),
			rebuiltQuestionCount: result.rebuiltQuestionCount,
			removedQuestionCount: result.removedQuestionCount,
		};
	}
}
