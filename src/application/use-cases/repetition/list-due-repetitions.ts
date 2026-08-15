import type { Clock } from "@/application/ports/clock";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { overdueDaysOf } from "@/domain/repetition/repetition";

export interface DueRepetitionView {
	readonly quizSetId: QuizSetId;
	readonly title: string;
	readonly dueAt: Date;
	readonly overdueDays: number;
	readonly repetitionCount: number;
}

export interface ListDueRepetitionsCommand {
	readonly telegramUserId: number;
}

export interface ListDueRepetitionsDependencies {
	readonly repetition: RepetitionRepository;
	readonly quizSets: QuizSetRepository;
	readonly clock: Clock;
}

export class ListDueRepetitions
	implements
		UseCase<Command<ListDueRepetitionsCommand>, readonly DueRepetitionView[]>
{
	private readonly repetition: RepetitionRepository;
	private readonly quizSets: QuizSetRepository;
	private readonly clock: Clock;

	constructor(dependencies: ListDueRepetitionsDependencies) {
		this.repetition = dependencies.repetition;
		this.quizSets = dependencies.quizSets;
		this.clock = dependencies.clock;
	}

	async execute(
		request: Command<ListDueRepetitionsCommand>,
	): Promise<readonly DueRepetitionView[]> {
		const at = this.clock.now();
		const views: DueRepetitionView[] = [];

		for (const schedule of this.repetition.listDue(
			request.telegramUserId,
			at,
		)) {
			const quizSet = this.quizSets.findById(schedule.quizSetId);

			if (quizSet === undefined || schedule.dueAt === undefined) {
				continue;
			}

			views.push({
				quizSetId: schedule.quizSetId,
				title: quizSet.title,
				dueAt: schedule.dueAt,
				overdueDays: overdueDaysOf(schedule, at),
				repetitionCount: schedule.repetitionCount,
			});
		}

		return views;
	}
}
