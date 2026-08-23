import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { VocabularyRepository } from "@/application/ports/repositories/vocabulary.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { Command, UseCase } from "@/application/use-case";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	cardsOf,
	createVocabularyItem,
	toVocabularyItemId,
	type VocabularyDirection,
	type VocabularyItemId,
} from "@/domain/vocabulary/vocabulary-item";
import type { AddQuestions, QuestionInput } from "./add-questions";

export interface VocabularyPairInput {
	readonly term: readonly string[];
	readonly translation: readonly string[];
	readonly transcription?: string;
	readonly example?: string;
}

export interface AddVocabularyCommand {
	readonly quizSetId: QuizSetId;
	readonly pairs: readonly VocabularyPairInput[];
	readonly directions: readonly VocabularyDirection[];
	readonly topic?: string;
	readonly difficulty?: Difficulty;
}

export interface AddVocabularyResult {
	readonly itemIds: readonly VocabularyItemId[];
	readonly addedQuestionCount: number;
	readonly alreadyPresent: boolean;
}

export interface AddVocabularyDependencies {
	readonly vocabulary: VocabularyRepository;
	readonly clock: Clock;
	readonly idGenerator: IdGenerator;
	readonly transaction: Transaction;
	readonly addQuestions: AddQuestions;
}

export class AddVocabulary
	implements UseCase<Command<AddVocabularyCommand>, AddVocabularyResult>
{
	private readonly vocabulary: VocabularyRepository;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;
	private readonly transaction: Transaction;
	private readonly addQuestions: AddQuestions;

	constructor(dependencies: AddVocabularyDependencies) {
		this.vocabulary = dependencies.vocabulary;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
		this.transaction = dependencies.transaction;
		this.addQuestions = dependencies.addQuestions;
	}

	async execute(
		request: Command<AddVocabularyCommand>,
	): Promise<AddVocabularyResult> {
		const at = this.clock.now();
		const items = request.pairs.map((pair) =>
			createVocabularyItem({
				id: toVocabularyItemId(this.idGenerator.generate()),
				quizSetId: request.quizSetId,
				terms: pair.term,
				translations: pair.translation,
				transcription: pair.transcription,
				example: pair.example,
				topic: request.topic,
				createdAt: at,
			}),
		);

		const questions: QuestionInput[] = items.flatMap((item) =>
			cardsOf(item, request.directions).map(
				(card): QuestionInput => ({
					type: QuestionType.TypedAnswer,
					prompt: card.prompt,
					difficulty: request.difficulty ?? Difficulty.Medium,
					options: card.acceptedAnswers.map((text) => ({
						text,
						isCorrect: true,
					})),
					hint: card.hint,
					topic: request.topic,
					explanation: item.example,
					vocabularyItemId: item.id,
				}),
			),
		);

		const added = await this.addQuestions.execute({
			quizSetId: request.quizSetId,
			questions,
		});

		if (!added.alreadyPresent) {
			this.transaction.run(() => {
				for (const item of items) {
					this.vocabulary.save(item);
				}
			});
		}

		return {
			itemIds: items.map((item) => item.id),
			addedQuestionCount: added.addedQuestionIds.length,
			alreadyPresent: added.alreadyPresent,
		};
	}
}
