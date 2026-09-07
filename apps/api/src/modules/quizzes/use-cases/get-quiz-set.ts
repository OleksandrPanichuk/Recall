import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import { QuizSetEntity, type QuizSetId } from "..";
import { QuizSetNotFoundError } from "../quizzes.errors";
import { QuizzesRepository } from "../quizzes.repository";

export interface GetQuizSetUseCaseOptions {
	readonly quizSetId: QuizSetId;
}

type Options = GetQuizSetUseCaseOptions;
type Result = QuizSetEntity;

@Injectable()
export class GetQuizSetUseCase extends UseCase<Options, Result> {
	constructor(private readonly quizzes: QuizzesRepository) {
		super();
	}

	async execute(options: GetQuizSetUseCaseOptions): Promise<QuizSetEntity> {
		const stored = await this.quizzes.findById(options.quizSetId);

		if (stored === undefined) {
			throw new QuizSetNotFoundError(options.quizSetId);
		}

		return stored;
	}
}
