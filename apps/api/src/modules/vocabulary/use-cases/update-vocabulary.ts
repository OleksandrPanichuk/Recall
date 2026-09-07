import { Injectable } from "@nestjs/common";
import { normaliseForComparison } from "@recall/kit";
import { Clock } from "@/core/ports/clock";
import { IdGenerator } from "@/core/ports/id-generator";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import {
	createQuestion,
	QuestionEntity,
	type QuestionId,
	QuestionType,
	QuizSetEntity,
	QuizSetNotFoundError,
	QuizzesRepository,
	toQuestionOptionId,
} from "@/modules/quizzes";
import {
	TermPairEntity,
	type VocabularyCard,
	VocabularyDirection,
	type VocabularyItemId,
} from "..";
import { TermPairsRepository } from "../vocabulary.repository";

export class VocabularyItemNotFoundError extends Error {
	readonly itemId: VocabularyItemId;

	constructor(itemId: VocabularyItemId) {
		super(`Vocabulary item ${itemId} does not exist`);
		this.name = "VocabularyItemNotFoundError";
		this.itemId = itemId;
	}
}

export interface UpdateVocabularyUseCaseOptions {
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

const BOTH_WAYS = [
	VocabularyDirection.TermToTranslation,
	VocabularyDirection.TranslationToTerm,
];

interface Rebuild {
	readonly replacements: readonly QuestionEntity[];
	readonly removedIds: readonly QuestionId[];
}

const cardsByDirection = (
	item: TermPairEntity,
): Map<VocabularyDirection, VocabularyCard> =>
	new Map(
		TermPairEntity.cards(item, BOTH_WAYS).map((card) => [card.direction, card]),
	);

const rebuiltFrom = (
	question: QuestionEntity,
	card: VocabularyCard,
	example: string | undefined,
	mintId: () => string,
): QuestionEntity =>
	createQuestion({
		id: question.id,
		type: QuestionType.TypedAnswer,
		prompt: card.prompt,
		difficulty: question.difficulty,
		position: question.position,
		options: card.acceptedAnswers.map((text, index) => ({
			id: toQuestionOptionId(mintId()),
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
	questions: readonly QuestionEntity[],
	stored: TermPairEntity,
	updated: TermPairEntity,
	mintId: () => string,
): Rebuild {
	const before = cardsByDirection(stored);
	const after = cardsByDirection(updated);
	const unclaimed = new Map(
		[...before].map(
			([direction, card]) =>
				[normaliseForComparison(card.prompt), direction] as const,
		),
	);
	const replacements: QuestionEntity[] = [];
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
		replacements.push(rebuiltFrom(question, card, updated.example, mintId));
	}

	return { replacements, removedIds };
}

type Options = UpdateVocabularyUseCaseOptions;
type Result = UpdateVocabularyResult;

@Injectable()
export class UpdateVocabularyUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly termPairs: TermPairsRepository,
		private readonly quizzes: QuizzesRepository,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
		private readonly ids: IdGenerator,
	) {
		super();
	}

	async execute(
		options: UpdateVocabularyUseCaseOptions,
	): Promise<UpdateVocabularyResult> {
		const at = this.clock.now();

		return this.transaction.run(async () => {
			const stored = await this.termPairs.findById(options.itemId);

			if (stored === undefined) {
				throw new VocabularyItemNotFoundError(options.itemId);
			}

			const quizSet = await this.quizzes.findById(stored.quizSetId);

			if (quizSet === undefined) {
				throw new QuizSetNotFoundError(stored.quizSetId);
			}

			const updated = TermPairEntity.restore({
				id: stored.id,
				quizSetId: stored.quizSetId,
				terms: options.term ?? stored.terms,
				translations: options.translation ?? stored.translations,
				transcription: options.transcription ?? stored.transcription,
				example: options.example ?? stored.example,
				topic: stored.topic,
				createdAt: stored.createdAt,
				updatedAt: at,
			});

			const owned = quizSet.questions.filter(
				(question) => question.vocabularyItemId === String(stored.id),
			);
			const { replacements, removedIds } = planRebuild(
				owned,
				stored,
				updated,
				() => this.ids.generate(),
			);

			await this.termPairs.save(updated);
			await this.quizzes.save(
				QuizSetEntity.replaceQuestions(quizSet, replacements, removedIds, at),
			);

			return {
				itemId: updated.id,
				rebuiltQuestionCount: replacements.length,
				removedQuestionCount: removedIds.length,
			};
		});
	}
}
