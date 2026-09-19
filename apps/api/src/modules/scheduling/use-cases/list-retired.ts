import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import {
	type QuestionId,
	type QuizSetId,
	QuizzesRepository,
} from "@/modules/quizzes";
import { locateQuestions } from "../question-locator";
import { SchedulesRepository } from "../scheduling.repository";

export interface RetiredView {
	readonly questionId: QuestionId;
	readonly quizSetId: QuizSetId;
	readonly quizSetTitle: string;
	readonly prompt: string;
	readonly retiredAt: Date;
}

export type ListRetiredUseCaseOptions = Readonly<Record<string, never>>;

type Options = ListRetiredUseCaseOptions;
type Result = readonly RetiredView[];

@Injectable()
export class ListRetiredUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly schedules: SchedulesRepository,
		private readonly quizzes: QuizzesRepository,
	) {
		super();
	}

	async execute(_options: Options): Promise<Result> {
		const retired = await this.schedules.listRetired();
		const located = await locateQuestions(
			this.quizzes,
			retired.map((schedule) => schedule.questionId),
		);

		return retired.flatMap((schedule) => {
			const question = located.get(schedule.questionId);

			return question === undefined || schedule.retiredAt === undefined
				? []
				: [{ ...question, retiredAt: schedule.retiredAt }];
		});
	}
}
