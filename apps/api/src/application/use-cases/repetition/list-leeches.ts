import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
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

export interface ListLeechesDependencies {
	readonly repetition: RepetitionRepository;
	readonly quizSets: QuizSetRepository;
}

export class ListLeechesUseCase
	implements UseCase<Command<ListLeechesCommand>, readonly LeechView[]>
{
	private readonly repetition: RepetitionRepository;
	private readonly quizSets: QuizSetRepository;

	constructor(dependencies: ListLeechesDependencies) {
		this.repetition = dependencies.repetition;
		this.quizSets = dependencies.quizSets;
	}

	async execute(
		request: Command<ListLeechesCommand>,
	): Promise<readonly LeechView[]> {
		const stuck = this.repetition.listLeeches(
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

		for (const summary of this.quizSets.list()) {
			const quizSet = this.quizSets.findById(summary.id);

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
