import { Inject, Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import type { AttemptsRepository } from "@/modules/attempts";
import { QuestionEntity, type QuizSetId, QuizSetStatus } from "..";
import { QuizzesRepository } from "../quizzes.repository";
import { ATTEMPTS } from "../quizzes.tokens";

export interface QuestionRow {
	readonly question: QuestionEntity;
	readonly quizSetId: QuizSetId;
	readonly setTitle: string;
	readonly setStatus: QuizSetStatus;
	readonly answerCount: number;
}

export interface ListQuestionsUseCaseOptions {
	readonly quizSetId?: QuizSetId;
}

type Options = ListQuestionsUseCaseOptions;
type Result = readonly QuestionRow[];

@Injectable()
export class ListQuestionsUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly quizzes: QuizzesRepository,
		@Inject(ATTEMPTS) private readonly attempts: AttemptsRepository,
	) {
		super();
	}

	async execute(
		options: ListQuestionsUseCaseOptions,
	): Promise<readonly QuestionRow[]> {
		const ids =
			options.quizSetId === undefined
				? (await this.quizzes.list()).map((summary) => summary.id)
				: [options.quizSetId];
		const rows: QuestionRow[] = [];

		for (const id of ids) {
			const quizSet = await this.quizzes.findById(id);

			if (quizSet === undefined) {
				continue;
			}

			for (const question of quizSet.questions) {
				rows.push({
					question,
					quizSetId: quizSet.id,
					setTitle: quizSet.title,
					setStatus: quizSet.status,
					answerCount: await this.attempts.answerCount(question.id),
				});
			}
		}

		return rows;
	}
}
