import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { VocabularyItemId } from "@/domain/vocabulary/vocabulary-item";
import { QuizSetNotFoundError } from "./update-quiz-set";

export interface VocabularyItemView {
	readonly itemId: VocabularyItemId;
	readonly terms: readonly string[];
	readonly translations: readonly string[];
	readonly transcription?: string;
	readonly example?: string;
	readonly topic?: string;
	readonly questionIds: readonly string[];
}

export interface ListVocabularyCommand {
	readonly quizSetId: QuizSetId;
}

export type ListVocabularyDependencies = ApplicationDependencies;

export class ListVocabularyUseCase
	implements
		UseCase<Command<ListVocabularyCommand>, readonly VocabularyItemView[]>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: ListVocabularyDependencies) {
		this.scope = dependencies.scope;
	}

	async execute(
		request: Command<ListVocabularyCommand>,
	): Promise<readonly VocabularyItemView[]> {
		const { quizzes, termPairs } = this.scope;
		const quizSet = await quizzes.findById(request.quizSetId);

		if (quizSet === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		return (await termPairs.listForQuiz(request.quizSetId)).map((item) => ({
			itemId: item.id,
			terms: item.terms,
			translations: item.translations,
			transcription: item.transcription,
			example: item.example,
			topic: item.topic,
			questionIds: quizSet.questions
				.filter((question) => question.vocabularyItemId === String(item.id))
				.map((question) => question.id),
		}));
	}
}
