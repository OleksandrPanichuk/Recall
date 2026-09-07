import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import { QuizSetStatus } from "..";
import { type QuizSummary, QuizzesRepository } from "../quizzes.repository";

export interface ListQuizSetsUseCaseOptions {
	readonly includeUnpublished?: boolean;
}

type Options = ListQuizSetsUseCaseOptions;
type Result = readonly QuizSummary[];

@Injectable()
export class ListQuizSetsUseCase extends UseCase<Options, Result> {
	constructor(private readonly quizzes: QuizzesRepository) {
		super();
	}

	async execute(
		options: ListQuizSetsUseCaseOptions,
	): Promise<readonly QuizSummary[]> {
		return this.quizzes.list(
			options.includeUnpublished === true
				? undefined
				: { statuses: [QuizSetStatus.Published] },
		);
	}
}
