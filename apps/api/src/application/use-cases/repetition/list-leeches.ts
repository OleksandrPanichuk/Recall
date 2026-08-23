import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import type { QuestionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { DEFAULT_LEECH_THRESHOLD } from "@/domain/repetition/repetition";

export interface LeechView {
	readonly questionId: QuestionId;
	readonly quizSetId: QuizSetId;
	readonly quizSetTitle: string;
	readonly prompt: string;
	readonly lapses: number;
}

export interface ListLeechesCommand {
	readonly telegramUserId: number;
	readonly threshold?: number;
}

export type ListLeechesDependencies = ApplicationDependencies;

export class ListLeechesUseCase
	implements UseCase<Command<ListLeechesCommand>, readonly LeechView[]>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: ListLeechesDependencies) {
		this.scope = dependencies.scope;
	}

	async execute(
		request: Command<ListLeechesCommand>,
	): Promise<readonly LeechView[]> {
		const { quizzes, reviews } = this.scope;
		const stuck = await reviews.listLeeches(
			request.telegramUserId,
			request.threshold ?? DEFAULT_LEECH_THRESHOLD,
		);

		if (stuck.length === 0) {
			return [];
		}

		const lapsesOf = new Map(
			stuck.map((schedule) => [schedule.questionId, schedule.lapses]),
		);
		const views: LeechView[] = [];

		for (const summary of await quizzes.list()) {
			const quizSet = await quizzes.findById(summary.id);

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
