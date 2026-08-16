import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { VocabularyRepository } from "@/application/ports/repositories/vocabulary.repository";
import type { Command, UseCase } from "@/application/use-case";
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

export interface ListVocabularyDependencies {
	readonly vocabulary: VocabularyRepository;
	readonly quizSets: QuizSetRepository;
}

export class ListVocabulary
	implements
		UseCase<Command<ListVocabularyCommand>, readonly VocabularyItemView[]>
{
	private readonly vocabulary: VocabularyRepository;
	private readonly quizSets: QuizSetRepository;

	constructor(dependencies: ListVocabularyDependencies) {
		this.vocabulary = dependencies.vocabulary;
		this.quizSets = dependencies.quizSets;
	}

	async execute(
		request: Command<ListVocabularyCommand>,
	): Promise<readonly VocabularyItemView[]> {
		const quizSet = this.quizSets.findById(request.quizSetId);

		if (quizSet === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		return this.vocabulary.listBySet(request.quizSetId).map((item) => ({
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
