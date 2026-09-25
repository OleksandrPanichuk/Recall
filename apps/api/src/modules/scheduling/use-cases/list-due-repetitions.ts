import { Injectable } from "@nestjs/common";
import { startOfDayIn } from "@recall/kit";
import { Clock } from "@/core/ports/clock";
import { Timezone } from "@/core/ports/timezone";
import { UseCase } from "@/core/use-case";
import {
	type QuestionId,
	type QuizSetId,
	QuizSetStatus,
	QuizzesRepository,
} from "@/modules/quizzes";
import { type DueSet, ScheduleEntity } from "..";
import { SchedulesRepository } from "../scheduling.repository";

export type ListDueRepetitionsUseCaseOptions = Readonly<Record<string, never>>;

interface Bucket {
	readonly questionIds: QuestionId[];
	overdueDays: number;
}

type Options = ListDueRepetitionsUseCaseOptions;
type Result = readonly DueSet[];

@Injectable()
export class ListDueRepetitionsUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly schedules: SchedulesRepository,
		private readonly quizzes: QuizzesRepository,
		private readonly clock: Clock,
		private readonly timezone: Timezone,
	) {
		super();
	}

	async execute(
		_request: ListDueRepetitionsUseCaseOptions,
	): Promise<readonly DueSet[]> {
		const at = this.clock.now();
		const todayStart = startOfDayIn(at, this.timezone.name());
		const due = await this.schedules.listDue(at);

		if (due.length === 0) {
			return [];
		}

		const setOfQuestion = new Map<QuestionId, QuizSetId>();
		const titles = new Map<QuizSetId, string>();

		for (const found of await this.quizzes.locateQuestions(
			due.map((schedule) => schedule.questionId),
		)) {
			if (found.quizSetStatus !== QuizSetStatus.Published) {
				continue;
			}

			titles.set(found.quizSetId, found.quizSetTitle);
			setOfQuestion.set(found.questionId, found.quizSetId);
		}

		const buckets = new Map<QuizSetId, Bucket>();

		for (const schedule of due) {
			const quizSetId = setOfQuestion.get(schedule.questionId);

			if (quizSetId === undefined) {
				continue;
			}

			const bucket = buckets.get(quizSetId) ?? {
				questionIds: [],
				overdueDays: 0,
			};

			bucket.questionIds.push(schedule.questionId);
			bucket.overdueDays = Math.max(
				bucket.overdueDays,
				ScheduleEntity.overdueDaysOf(schedule, todayStart),
			);
			buckets.set(quizSetId, bucket);
		}

		return [...buckets.entries()]
			.map(([quizSetId, bucket]) => ({
				quizSetId,
				title: titles.get(quizSetId) ?? "—",
				dueCount: bucket.questionIds.length,
				overdueDays: bucket.overdueDays,
				dueQuestionIds: bucket.questionIds,
			}))
			.toSorted((one, other) => other.overdueDays - one.overdueDays);
	}
}
