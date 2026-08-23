import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
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

export type ListQuestionsDependencies = ApplicationDependencies;

export class ListQuestionsUseCase
	implements UseCase<Command<ListQuestionsCommand>, readonly QuestionRow[]>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: ListQuestionsDependencies) {
		this.scope = dependencies.scope;
	}

	async execute(
		request: Command<ListQuestionsCommand>,
	): Promise<readonly QuestionRow[]> {
		const { quizzes, attempts } = this.scope;
		const ids =
			request.quizSetId === undefined
				? (await quizzes.list()).map((summary) => summary.id)
				: [request.quizSetId];
		const rows: QuestionRow[] = [];

		for (const id of ids) {
			const quizSet = await quizzes.findById(id);

			if (quizSet === undefined) {
				continue;
			}

			for (const question of quizSet.questions) {
				rows.push({
					question,
					quizSetId: quizSet.id,
					setTitle: quizSet.title,
					setStatus: quizSet.status,
					answerCount: await attempts.answerCount(question.id),
				});
			}
		}

		return rows;
	}
}
