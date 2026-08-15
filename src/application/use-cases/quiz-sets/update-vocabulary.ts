import type { Clock } from "@/application/ports/clock";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { VocabularyRepository } from "@/application/ports/repositories/vocabulary.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { Command, UseCase } from "@/application/use-case";
import { createQuestion } from "@/domain/quiz-set/create-question";
import {
	type Question,
	QuestionType,
	toQuestionOptionId,
} from "@/domain/quiz-set/question";
import {
	cardsOf,
	createVocabularyItem,
	type VocabularyCard,
	VocabularyDirection,
	type VocabularyItem,
	type VocabularyItemId,
} from "@/domain/vocabulary/vocabulary-item";
import { normaliseForComparison } from "@/shared/utils/text";
import { QuizSetNotFoundError } from "./update-quiz-set";

export class VocabularyItemNotFoundError extends Error {
	readonly itemId: VocabularyItemId;

	constructor(itemId: VocabularyItemId) {
		super(`Vocabulary item ${itemId} does not exist`);
		this.name = "VocabularyItemNotFoundError";
		this.itemId = itemId;
	}
}

export interface UpdateVocabularyCommand {
	readonly itemId: VocabularyItemId;
	readonly term?: readonly string[];
	readonly translation?: readonly string[];
	readonly transcription?: string;
	readonly example?: string;
}

export interface UpdateVocabularyResult {
	readonly itemId: VocabularyItemId;
	readonly rebuiltQuestionCount: number;
}

export interface UpdateVocabularyDependencies {
	readonly vocabulary: VocabularyRepository;
	readonly quizSets: QuizSetRepository;
	readonly clock: Clock;
	readonly transaction: Transaction;
}

const directionOf = (
	question: Question,
	item: VocabularyItem,
): VocabularyDirection => {
	const prompt = normaliseForComparison(question.prompt);
	const isTerm = item.terms.some(
		(term) => normaliseForComparison(term) === prompt,
	);

	return isTerm
		? VocabularyDirection.TermToTranslation
		: VocabularyDirection.TranslationToTerm;
};

export class UpdateVocabulary
	implements UseCase<Command<UpdateVocabularyCommand>, UpdateVocabularyResult>
{
	private readonly vocabulary: VocabularyRepository;
	private readonly quizSets: QuizSetRepository;
	private readonly clock: Clock;
	private readonly transaction: Transaction;

	constructor(dependencies: UpdateVocabularyDependencies) {
		this.vocabulary = dependencies.vocabulary;
		this.quizSets = dependencies.quizSets;
		this.clock = dependencies.clock;
		this.transaction = dependencies.transaction;
	}

	async execute(
		request: Command<UpdateVocabularyCommand>,
	): Promise<UpdateVocabularyResult> {
		const stored = this.vocabulary.findById(request.itemId);

		if (stored === undefined) {
			throw new VocabularyItemNotFoundError(request.itemId);
		}

		const quizSet = this.quizSets.findById(stored.quizSetId);

		if (quizSet === undefined) {
			throw new QuizSetNotFoundError(stored.quizSetId);
		}

		const at = this.clock.now();
		const updated = createVocabularyItem({
			id: stored.id,
			quizSetId: stored.quizSetId,
			terms: request.term ?? stored.terms,
			translations: request.translation ?? stored.translations,
			transcription: request.transcription ?? stored.transcription,
			example: request.example ?? stored.example,
			topic: stored.topic,
			createdAt: stored.createdAt,
		});

		const cards = new Map<VocabularyDirection, VocabularyCard>(
			cardsOf(updated, [
				VocabularyDirection.TermToTranslation,
				VocabularyDirection.TranslationToTerm,
			]).map((card) => [card.direction, card]),
		);

		let rebuilt = 0;
		const questions = quizSet.questions.map((question) => {
			if (question.vocabularyItemId !== String(stored.id)) {
				return question;
			}

			const card = cards.get(directionOf(question, stored));

			if (card === undefined) {
				return question;
			}

			rebuilt += 1;

			return createQuestion({
				id: question.id,
				type: QuestionType.TypedAnswer,
				prompt: card.prompt,
				difficulty: question.difficulty,
				position: question.position,
				options: card.acceptedAnswers.map((text, index) => ({
					id: toQuestionOptionId(`${question.id}-${index}`),
					text,
					isCorrect: true,
					position: index,
				})),
				explanation: updated.example,
				hint: card.hint,
				topic: question.topic,
				vocabularyItemId: question.vocabularyItemId,
			});
		});

		this.transaction.run(() => {
			this.vocabulary.save({ ...updated, updatedAt: at });
			this.quizSets.save({ ...quizSet, questions, updatedAt: at });
		});

		return { itemId: updated.id, rebuiltQuestionCount: rebuilt };
	}
}
