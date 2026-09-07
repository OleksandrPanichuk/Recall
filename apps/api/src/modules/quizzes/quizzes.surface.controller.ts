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
import { toPageId } from "@/modules/pages";
import { parseBody } from "@/shared/http/parse-body";
import {
	addQuestionsDto,
	createQuizSetDto,
	deleteQuestionDto,
	listQuestionsDto,
	listQuizSetsDto,
	moveQuizSetDto,
	quizSetIdDto,
	updateQuestionDto,
	updateQuizSetDto,
} from "./dto";
import { toQuestionId } from "./question.entity";
import { questionRowToWire } from "./question.model";
import { answerOptionsOf, toQuestionInput } from "./question-input.helpers";
import { quizDetailToWire, quizSummaryToWire } from "./quiz.model";
import { toQuizSetId } from "./quiz-set.entity";
import {
	AddQuestionsUseCase,
	ArchiveQuizSetUseCase,
	CreateQuizSetUseCase,
	DeleteQuestionUseCase,
	GetQuizSetUseCase,
	ListQuestionsUseCase,
	ListQuizSetsUseCase,
	MoveQuizSetUseCase,
	PublishQuizSetUseCase,
	UpdateQuestionUseCase,
	UpdateQuizSetUseCase,
} from "./use-cases";

@ApiExcludeController()
@UseGuards(SessionGuard)
@Controller(APP_ROUTE_PREFIX)
export class QuizzesSurfaceController {
	constructor(
		private readonly createSet: CreateQuizSetUseCase,
		private readonly updateSet: UpdateQuizSetUseCase,
		private readonly moveSet: MoveQuizSetUseCase,
		private readonly publishSet: PublishQuizSetUseCase,
		private readonly archiveSet: ArchiveQuizSetUseCase,
		private readonly getSet: GetQuizSetUseCase,
		private readonly listSets: ListQuizSetsUseCase,
		private readonly listQuestions: ListQuestionsUseCase,
		private readonly addQuestions: AddQuestionsUseCase,
		private readonly updateQuestion: UpdateQuestionUseCase,
		private readonly deleteQuestion: DeleteQuestionUseCase,
	) {}

	@Post(BOT_ROUTES.createQuizSet)
	@HttpCode(HttpStatus.OK)
	async createQuizSet(@Body() body: unknown) {
		const command = parseBody(createQuizSetDto, body);
		const { quizSetId } = await this.createSet.execute({
			...command,
			folderId:
				command.folderId === undefined ? undefined : toPageId(command.folderId),
		});

		return { quizSetId: String(quizSetId) };
	}

	@Post(BOT_ROUTES.updateQuizSet)
	@HttpCode(HttpStatus.NO_CONTENT)
	async updateQuizSet(@Body() body: unknown) {
		const command = parseBody(updateQuizSetDto, body);

		await this.updateSet.execute({
			...command,
			quizSetId: toQuizSetId(command.quizSetId),
		});
	}

	@Post(BOT_ROUTES.moveQuizSet)
	@HttpCode(HttpStatus.NO_CONTENT)
	async moveQuizSet(@Body() body: unknown) {
		const command = parseBody(moveQuizSetDto, body);

		await this.moveSet.execute({
			quizSetId: toQuizSetId(command.quizSetId),
			folderId:
				command.folderId === undefined ? undefined : toPageId(command.folderId),
		});
	}

	@Post(BOT_ROUTES.publishQuizSet)
	@HttpCode(HttpStatus.NO_CONTENT)
	async publishQuizSet(@Body() body: unknown) {
		const command = parseBody(quizSetIdDto, body);

		await this.publishSet.execute({
			quizSetId: toQuizSetId(command.quizSetId),
		});
	}

	@Post(BOT_ROUTES.archiveQuizSet)
	@HttpCode(HttpStatus.NO_CONTENT)
	async archiveQuizSet(@Body() body: unknown) {
		const command = parseBody(quizSetIdDto, body);

		await this.archiveSet.execute({
			quizSetId: toQuizSetId(command.quizSetId),
		});
	}

	@Post(BOT_ROUTES.getQuizSet)
	@HttpCode(HttpStatus.OK)
	async getQuizSet(@Body() body: unknown) {
		const command = parseBody(quizSetIdDto, body);

		return quizDetailToWire(
			await this.getSet.execute({ quizSetId: toQuizSetId(command.quizSetId) }),
		);
	}

	@Post(BOT_ROUTES.listQuizSets)
	@HttpCode(HttpStatus.OK)
	async listQuizSets(@Body() body: unknown) {
		const command = parseBody(listQuizSetsDto, body);

		return (await this.listSets.execute(command)).map(quizSummaryToWire);
	}

	@Post(BOT_ROUTES.listQuestions)
	@HttpCode(HttpStatus.OK)
	async questions(@Body() body: unknown) {
		const command = parseBody(listQuestionsDto, body);

		return (
			await this.listQuestions.execute({
				quizSetId:
					command.quizSetId === undefined
						? undefined
						: toQuizSetId(command.quizSetId),
			})
		).map(questionRowToWire);
	}

	@Post(BOT_ROUTES.addQuestions)
	@HttpCode(HttpStatus.OK)
	async add(@Body() body: unknown) {
		const command = parseBody(addQuestionsDto, body);
		const result = await this.addQuestions.execute({
			quizSetId: toQuizSetId(command.quizSetId),
			questions: command.questions.map(toQuestionInput),
		});

		return {
			addedQuestionIds: result.addedQuestionIds.map(String),
			alreadyPresent: result.alreadyPresent,
		};
	}

	@Post(BOT_ROUTES.updateQuestion)
	@HttpCode(HttpStatus.NO_CONTENT)
	async update(@Body() body: unknown) {
		const command = parseBody(updateQuestionDto, body);

		await this.updateQuestion.execute({
			...command,
			quizSetId: toQuizSetId(command.quizSetId),
			questionId: toQuestionId(command.questionId),
			options: answerOptionsOf(command),
		});
	}

	@Post(BOT_ROUTES.deleteQuestion)
	@HttpCode(HttpStatus.OK)
	async remove(@Body() body: unknown) {
		const command = parseBody(deleteQuestionDto, body);
		const result = await this.deleteQuestion.execute({
			quizSetId: toQuizSetId(command.quizSetId),
			questionId: toQuestionId(command.questionId),
		});

		return {
			questionId: String(result.questionId),
			remaining: result.remaining,
		};
	}
}
