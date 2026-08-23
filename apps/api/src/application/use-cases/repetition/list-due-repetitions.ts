import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import type { QuestionId } from "@/domain/quiz-set/question";
import { type QuizSetId, QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import { type DueSet, overdueDaysOf } from "@/domain/repetition/repetition";
import { startOfDayIn } from "@/shared/utils/timezone";

export type { DueSet } from "@/domain/repetition/repetition";

export interface ListDueRepetitionsCommand {
	readonly telegramUserId: number;
}

export type ListDueRepetitionsDependencies = ApplicationDependencies;

interface Bucket {
	readonly questionIds: QuestionId[];
	overdueDays: number;
}

export class ListDueRepetitionsUseCase
	implements UseCase<Command<ListDueRepetitionsCommand>, readonly DueSet[]>
{
	private readonly scope: RepositoryScope;
	private readonly clock: Clock;
	private readonly timezone: string;

	constructor(dependencies: ListDueRepetitionsDependencies) {
		this.scope = dependencies.scope;
		this.clock = dependencies.clock;
		this.timezone = dependencies.timezone;
	}

	async execute(
		request: Command<ListDueRepetitionsCommand>,
	): Promise<readonly DueSet[]> {
		const { quizzes, reviews } = this.scope;
		const at = this.clock.now();
		const todayStart = startOfDayIn(at, this.timezone);
		const due = await reviews.listDue(request.telegramUserId, at);

		if (due.length === 0) {
			return [];
		}

		const setOfQuestion = new Map<QuestionId, QuizSetId>();
		const titles = new Map<QuizSetId, string>();

		for (const summary of await quizzes.list({
			statuses: [QuizSetStatus.Published],
		})) {
			const quizSet = await quizzes.findById(summary.id);

			if (quizSet === undefined) {
				continue;
			}

			titles.set(quizSet.id, quizSet.title);

			for (const question of quizSet.questions) {
				setOfQuestion.set(question.id, quizSet.id);
			}
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
				overdueDaysOf(schedule, todayStart),
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
