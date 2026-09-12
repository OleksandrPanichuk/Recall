import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import {
	type QuestionId,
	type QuizSetId,
	QuizzesRepository,
} from "@/modules/quizzes";
import { DEFAULT_LEECH_THRESHOLD } from "..";
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

		if (stuck.length === 0) {
			return [];
		}

		const lapsesOf = new Map(
			stuck.map((schedule) => [schedule.questionId, schedule.lapses]),
		);
		const views: LeechView[] = [];

		for (const summary of await this.quizzes.list()) {
			const quizSet = await this.quizzes.findById(summary.id);

			if (quizSet === undefined) {
				continue;
			}

			for (const question of quizSet.questions) {
				const lapses = lapsesOf.get(question.id);

				if (lapses === undefined) {
					continue;
				}

				views.push({
					questionId: question.id,
					quizSetId: quizSet.id,
					quizSetTitle: quizSet.title,
					prompt: question.prompt,
					lapses,
				});
			}
		}

		return views.toSorted((one, other) => other.lapses - one.lapses);
	}
}
