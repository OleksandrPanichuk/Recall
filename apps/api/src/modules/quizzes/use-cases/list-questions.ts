import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import { QuestionEntity, type QuizSetId, QuizSetStatus } from "..";
import { QuizzesRepository } from "../quizzes.repository";

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
	constructor(private readonly quizzes: QuizzesRepository) {
		super();
	}

	async execute(
		options: ListQuestionsUseCaseOptions,
	): Promise<readonly QuestionRow[]> {
		const listed = await this.quizzes.listQuestions({
			quizSetId: options.quizSetId,
		});
		const answers = await this.quizzes.answerCounts(
			listed.map((row) => row.question.id),
		);
		const rows = listed.map((row) => ({
			...row,
			answerCount: answers.get(row.question.id) ?? 0,
		}));

		return rows;
	}
}
