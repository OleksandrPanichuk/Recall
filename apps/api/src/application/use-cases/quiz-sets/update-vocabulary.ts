import type { Clock } from "@/application/ports/clock";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { VocabularyRepository } from "@/application/ports/repositories/vocabulary.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { Command, UseCase } from "@/application/use-case";
import { createQuestion } from "@/domain/quiz-set/create-question";
import {
	type Question,
	type QuestionId,
	QuestionType,
	toQuestionOptionId,
} from "@/domain/quiz-set/question";
import { replaceQuestions } from "@/domain/quiz-set/quiz-set";
import {
	cardsOf,
	restoreVocabularyItem,
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
	readonly removedQuestionCount: number;
}

export interface UpdateVocabularyDependencies {
	readonly vocabulary: VocabularyRepository;
	readonly quizSets: QuizSetRepository;
	readonly clock: Clock;
	readonly transaction: Transaction;
}

const BOTH_WAYS = [
	VocabularyDirection.TermToTranslation,
	VocabularyDirection.TranslationToTerm,
];

interface Rebuild {
	readonly replacements: readonly Question[];
	readonly removedIds: readonly QuestionId[];
}

const cardsByDirection = (
	item: VocabularyItem,
): Map<VocabularyDirection, VocabularyCard> =>
	new Map(cardsOf(item, BOTH_WAYS).map((card) => [card.direction, card]));

const rebuiltFrom = (
	question: Question,
	card: VocabularyCard,
	example: string | undefined,
): Question =>
	createQuestion({
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
		explanation: example,
		hint: card.hint,
		topic: question.topic,
		vocabularyItemId: question.vocabularyItemId,
	});

function planRebuild(
	questions: readonly Question[],
	stored: VocabularyItem,
	updated: VocabularyItem,
): Rebuild {
	const before = cardsByDirection(stored);
	const after = cardsByDirection(updated);
	const unclaimed = new Map(
		[...before].map(
			([direction, card]) =>
				[normaliseForComparison(card.prompt), direction] as const,
		),
	);
	const replacements: Question[] = [];
	const removedIds: QuestionId[] = [];

	for (const question of questions) {
		const key = normaliseForComparison(question.prompt);
		const direction = unclaimed.get(key);

		if (direction === undefined) {
			continue;
		}

		unclaimed.delete(key);

		const card = after.get(direction);

		if (card === undefined) {
			removedIds.push(question.id);
			continue;
		}

		after.delete(direction);
		replacements.push(rebuiltFrom(question, card, updated.example));
	}

	return { replacements, removedIds };
}

export class UpdateVocabularyUseCase
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
		const at = this.clock.now();

		return this.transaction.run(() => {
			const stored = this.vocabulary.findById(request.itemId);

			if (stored === undefined) {
				throw new VocabularyItemNotFoundError(request.itemId);
			}

			const quizSet = this.quizSets.findById(stored.quizSetId);

			if (quizSet === undefined) {
				throw new QuizSetNotFoundError(stored.quizSetId);
			}

			const updated = restoreVocabularyItem({
				id: stored.id,
				quizSetId: stored.quizSetId,
				terms: request.term ?? stored.terms,
				translations: request.translation ?? stored.translations,
				transcription: request.transcription ?? stored.transcription,
				example: request.example ?? stored.example,
				topic: stored.topic,
				createdAt: stored.createdAt,
				updatedAt: at,
			});

			const owned = quizSet.questions.filter(
				(question) => question.vocabularyItemId === String(stored.id),
			);
			const { replacements, removedIds } = planRebuild(owned, stored, updated);

			this.vocabulary.save(updated);
			this.quizSets.save(
				replaceQuestions(quizSet, replacements, removedIds, at),
			);

			return {
				itemId: updated.id,
				rebuiltQuestionCount: replacements.length,
				removedQuestionCount: removedIds.length,
			};
		});
	}
}
