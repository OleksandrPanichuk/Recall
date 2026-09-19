import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { type QuestionId, QuizzesRepository } from "@/modules/quizzes";
import { locateQuestions } from "../question-locator";
import { ScheduleEntity } from "../schedule.entity";
import { QuestionNotFoundError } from "../scheduling.errors";
import { SchedulesRepository } from "../scheduling.repository";

export interface RetireQuestionUseCaseOptions {
	readonly questionId: QuestionId;
	readonly retired: boolean;
}

export interface RetireQuestionResult {
	readonly questionId: QuestionId;
	readonly retired: boolean;
}

type Options = RetireQuestionUseCaseOptions;
type Result = RetireQuestionResult;

@Injectable()
export class RetireQuestionUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly schedules: SchedulesRepository,
		private readonly quizzes: QuizzesRepository,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	async execute(options: Options): Promise<Result> {
		return this.transaction.run(async () => {
			const located = await locateQuestions(this.quizzes, [options.questionId]);

			if (!located.has(options.questionId)) {
				throw new QuestionNotFoundError(options.questionId);
			}

			const [existing] = await this.schedules.findSchedules([
				options.questionId,
			]);
			const next = this.nextFor(existing, options);

			if (next !== undefined) {
				await this.schedules.saveSchedules([next]);
			}

			return { questionId: options.questionId, retired: options.retired };
		});
	}

	private nextFor(
		existing: ScheduleEntity | undefined,
		options: Options,
	): ScheduleEntity | undefined {
		const alreadyRetired = existing?.retiredAt !== undefined;

		if (options.retired) {
			return alreadyRetired
				? undefined
				: ScheduleEntity.retire(existing, options.questionId, this.clock.now());
		}

		return existing === undefined || !alreadyRetired
			? undefined
			: ScheduleEntity.unretire(existing, this.clock.now());
	}
}
