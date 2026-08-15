import type { Clock } from "@/application/ports/clock";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
import { type QuizSetId, QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import { overdueDaysOf } from "@/domain/repetition/repetition";
import { startOfDayIn } from "@/shared/utils/timezone";

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
	readonly timezone: string;
}

export class ListDueRepetitions
	implements
		UseCase<Command<ListDueRepetitionsCommand>, readonly DueRepetitionView[]>
{
	private readonly repetition: RepetitionRepository;
	private readonly quizSets: QuizSetRepository;
	private readonly clock: Clock;
	private readonly timezone: string;

	constructor(dependencies: ListDueRepetitionsDependencies) {
		this.repetition = dependencies.repetition;
		this.quizSets = dependencies.quizSets;
		this.clock = dependencies.clock;
		this.timezone = dependencies.timezone;
	}

	async execute(
		request: Command<ListDueRepetitionsCommand>,
	): Promise<readonly DueRepetitionView[]> {
		const at = this.clock.now();
		const todayStart = startOfDayIn(at, this.timezone);
		const published = new Map(
			this.quizSets
				.list({ statuses: [QuizSetStatus.Published] })
				.map((summary) => [summary.id, summary.title]),
		);
		const views: DueRepetitionView[] = [];

		for (const schedule of this.repetition.listDue(
			request.telegramUserId,
			at,
		)) {
			const title = published.get(schedule.quizSetId);

			if (title === undefined || schedule.dueAt === undefined) {
				continue;
			}

			views.push({
				quizSetId: schedule.quizSetId,
				title,
				dueAt: schedule.dueAt,
				overdueDays: overdueDaysOf(schedule, todayStart),
				repetitionCount: schedule.repetitionCount,
			});
		}

		return views;
	}
}
