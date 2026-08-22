import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { Question } from "@/domain/quiz-set/question";
import type { QuizSetId, QuizSetStatus } from "@/domain/quiz-set/quiz-set";

export interface QuestionRow {
	readonly question: Question;
	readonly quizSetId: QuizSetId;
	readonly setTitle: string;
	readonly setStatus: QuizSetStatus;
	readonly answerCount: number;
}

export interface ListQuestionsCommand {
	readonly quizSetId?: QuizSetId;
}

export interface ListQuestionsDependencies {
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
}

export class ListQuestions
	implements UseCase<Command<ListQuestionsCommand>, readonly QuestionRow[]>
{
	private readonly quizSets: QuizSetRepository;
	private readonly attempts: QuizAttemptRepository;

	constructor(dependencies: ListQuestionsDependencies) {
		this.quizSets = dependencies.quizSets;
		this.attempts = dependencies.attempts;
	}

	async execute(
		request: Command<ListQuestionsCommand>,
	): Promise<readonly QuestionRow[]> {
		const ids =
			request.quizSetId === undefined
				? this.quizSets.list().map((summary) => summary.id)
				: [request.quizSetId];
		const rows: QuestionRow[] = [];

		for (const id of ids) {
			const quizSet = this.quizSets.findById(id);

			if (quizSet === undefined) {
				continue;
			}

			for (const question of quizSet.questions) {
				rows.push({
					question,
					quizSetId: quizSet.id,
					setTitle: quizSet.title,
					setStatus: quizSet.status,
					answerCount: this.attempts.answerCount(question.id),
				});
			}
		}

		return rows;
	}
}
