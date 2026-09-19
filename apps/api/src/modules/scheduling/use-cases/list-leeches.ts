import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import {
	type QuestionId,
	type QuizSetId,
	QuizzesRepository,
} from "@/modules/quizzes";
import { DEFAULT_LEECH_THRESHOLD } from "..";
import { locateQuestions } from "../question-locator";
import { SchedulesRepository } from "../scheduling.repository";

export interface LeechView {
	readonly questionId: QuestionId;
	readonly quizSetId: QuizSetId;
	readonly quizSetTitle: string;
	readonly prompt: string;
	readonly lapses: number;
}

export interface ListLeechesUseCaseOptions {
	readonly threshold?: number;
}

type Options = ListLeechesUseCaseOptions;
type Result = readonly LeechView[];

@Injectable()
export class ListLeechesUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly schedules: SchedulesRepository,
		private readonly quizzes: QuizzesRepository,
	) {
		super();
	}

	async execute(
		options: ListLeechesUseCaseOptions,
	): Promise<readonly LeechView[]> {
		const stuck = await this.schedules.listLeeches(
			options.threshold ?? DEFAULT_LEECH_THRESHOLD,
		);
		const located = await locateQuestions(
			this.quizzes,
			stuck.map((schedule) => schedule.questionId),
		);

		return stuck
			.flatMap((schedule) => {
				const question = located.get(schedule.questionId);

				return question === undefined
					? []
					: [{ ...question, lapses: schedule.lapses }];
			})
			.toSorted((one, other) => other.lapses - one.lapses);
	}
}
