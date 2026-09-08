import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { BOT_ROUTES } from "@recall/contracts";
import type { Response } from "express";
import { SurfaceGuard } from "@/modules/auth";
import { toQuestionId, toQuizSetId } from "@/modules/quizzes";
import { parseBody } from "@/shared/http/parse-body";
import { toQuizAttemptId } from "./attempt.entity";
import {
	answerResultToWire,
	currentQuestionToWire,
	finishResultToWire,
	resumedAttemptToWire,
	startResultToWire,
} from "./attempt.model";
import {
	abandonAttemptDto,
	answerQuestionDto,
	currentQuestionDto,
	finishAttemptDto,
	pauseAttemptDto,
	rateRecallDto,
	startAttemptDto,
} from "./dto";
import {
	AbandonQuizAttemptUseCase,
	AnswerQuestionUseCase,
	FinishQuizAttemptUseCase,
	GetCurrentQuestionUseCase,
	PauseQuizAttemptUseCase,
	RateRecallUseCase,
	ResumeQuizAttemptUseCase,
	StartQuizAttemptUseCase,
} from "./use-cases";

@ApiExcludeController()
@UseGuards(SurfaceGuard)
@Controller(["bot", "app"])
export class AttemptsController {
	constructor(
		private readonly startQuizAttempt: StartQuizAttemptUseCase,
		private readonly getCurrentQuestion: GetCurrentQuestionUseCase,
		private readonly answerQuestion: AnswerQuestionUseCase,
		private readonly finishQuizAttempt: FinishQuizAttemptUseCase,
		private readonly recall: RateRecallUseCase,
		private readonly pauseQuizAttempt: PauseQuizAttemptUseCase,
		private readonly resumeQuizAttempt: ResumeQuizAttemptUseCase,
		private readonly abandonQuizAttempt: AbandonQuizAttemptUseCase,
	) {}

	@Post(BOT_ROUTES.startAttempt)
	@HttpCode(HttpStatus.OK)
	async start(@Body() body: unknown) {
		const command = parseBody(startAttemptDto, body);

		return startResultToWire(
			await this.startQuizAttempt.execute({
				...command,
				quizSetId: toQuizSetId(command.quizSetId),
			}),
		);
	}

	@Post(BOT_ROUTES.currentQuestion)
	async current(@Body() body: unknown, @Res() response: Response) {
		const command = parseBody(currentQuestionDto, body);
		const view = await this.getCurrentQuestion.execute(command);

		if (view === undefined) {
			response.status(HttpStatus.NO_CONTENT).send();

			return;
		}

		response.status(HttpStatus.OK).json(currentQuestionToWire(view));
	}

	@Post(BOT_ROUTES.answer)
	@HttpCode(HttpStatus.OK)
	async answer(@Body() body: unknown) {
		const command = parseBody(answerQuestionDto, body);

		return answerResultToWire(
			await this.answerQuestion.execute({
				...command,
				questionId: toQuestionId(command.questionId),
			}),
		);
	}

	@Post(BOT_ROUTES.finish)
	@HttpCode(HttpStatus.OK)
	async finish(@Body() body: unknown) {
		const command = parseBody(finishAttemptDto, body);

		return finishResultToWire(await this.finishQuizAttempt.execute(command));
	}

	@Post(BOT_ROUTES.rateRecall)
	@HttpCode(HttpStatus.NO_CONTENT)
	async rateRecall(@Body() body: unknown) {
		const command = parseBody(rateRecallDto, body);

		await this.recall.execute({
			questionId: toQuestionId(command.questionId),
			recall: command.recall,
		});
	}

	@Post(BOT_ROUTES.pause)
	@HttpCode(HttpStatus.NO_CONTENT)
	async pause(@Body() body: unknown) {
		parseBody(pauseAttemptDto, body);

		await this.pauseQuizAttempt.execute({});
	}

	@Post(BOT_ROUTES.resume)
	@HttpCode(HttpStatus.OK)
	async resume(@Body() body: unknown) {
		parseBody(pauseAttemptDto, body);

		return resumedAttemptToWire(await this.resumeQuizAttempt.execute({}));
	}

	@Post(BOT_ROUTES.abandon)
	@HttpCode(HttpStatus.OK)
	async abandon(@Body() body: unknown) {
		const command = parseBody(abandonAttemptDto, body);

		return this.abandonQuizAttempt.execute({
			attemptId:
				command.attemptId === undefined
					? undefined
					: toQuizAttemptId(command.attemptId),
		});
	}
}
