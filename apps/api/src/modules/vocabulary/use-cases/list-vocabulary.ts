import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import {
	type QuizSetId,
	QuizSetNotFoundError,
	QuizzesRepository,
} from "@/modules/quizzes";
import { type VocabularyItemId } from "..";
import { TermPairsRepository } from "../vocabulary.repository";

export interface VocabularyItemView {
	readonly itemId: VocabularyItemId;
	readonly terms: readonly string[];
	readonly translations: readonly string[];
	readonly transcription?: string;
	readonly example?: string;
	readonly topic?: string;
	readonly questionIds: readonly string[];
}

export interface ListVocabularyUseCaseOptions {
	readonly quizSetId: QuizSetId;
}

type Options = ListVocabularyUseCaseOptions;
type Result = readonly VocabularyItemView[];

@Injectable()
export class ListVocabularyUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly termPairs: TermPairsRepository,
		private readonly quizzes: QuizzesRepository,
	) {
		super();
	}

	async execute(
		options: ListVocabularyUseCaseOptions,
	): Promise<readonly VocabularyItemView[]> {
		const quizSet = await this.quizzes.findById(options.quizSetId);

		if (quizSet === undefined) {
			throw new QuizSetNotFoundError(options.quizSetId);
		}

		return (await this.termPairs.listForQuiz(options.quizSetId)).map(
			(item) => ({
				itemId: item.id,
				terms: item.terms,
				translations: item.translations,
				transcription: item.transcription,
				example: item.example,
				topic: item.topic,
				questionIds: quizSet.questions
					.filter((question) => question.vocabularyItemId === String(item.id))
					.map((question) => question.id),
			}),
		);
	}
}
