import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { IdGenerator } from "@/core/ports/id-generator";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import {
	AddQuestionsUseCase,
	Difficulty,
	type QuestionInput,
	QuestionType,
	type QuizSetId,
} from "@/modules/quizzes";
import {
	TermPairEntity,
	toVocabularyItemId,
	VocabularyDirection,
	type VocabularyItemId,
} from "..";
import { TermPairsRepository } from "../vocabulary.repository";

export interface VocabularyPairInput {
	readonly term: readonly string[];
	readonly translation: readonly string[];
	readonly transcription?: string;
	readonly example?: string;
}

export interface AddVocabularyUseCaseOptions {
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

type Options = AddVocabularyUseCaseOptions;
type Result = AddVocabularyResult;

@Injectable()
export class AddVocabularyUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly addQuestions: AddQuestionsUseCase,
		private readonly termPairs: TermPairsRepository,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
		private readonly ids: IdGenerator,
	) {
		super();
	}

	async execute(
		options: AddVocabularyUseCaseOptions,
	): Promise<AddVocabularyResult> {
		const at = this.clock.now();
		const items = options.pairs.map((pair) =>
			TermPairEntity.create({
				id: toVocabularyItemId(this.ids.generate()),
				quizSetId: options.quizSetId,
				terms: pair.term,
				translations: pair.translation,
				transcription: pair.transcription,
				example: pair.example,
				topic: options.topic,
				createdAt: at,
			}),
		);

		const questions: QuestionInput[] = items.flatMap((item) =>
			TermPairEntity.cards(item, options.directions).map(
				(card): QuestionInput => ({
					type: QuestionType.TypedAnswer,
					prompt: card.prompt,
					difficulty: options.difficulty ?? Difficulty.Medium,
					options: card.acceptedAnswers.map((text) => ({
						text,
						isCorrect: true,
					})),
					hint: card.hint,
					topic: options.topic,
					explanation: item.example,
					vocabularyItemId: item.id,
				}),
			),
		);

		const added = await this.addQuestions.execute({
			quizSetId: options.quizSetId,
			questions,
		});

		if (!added.alreadyPresent) {
			await this.transaction.run(async () => {
				for (const item of items) {
					await this.termPairs.save(item);
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
