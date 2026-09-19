import { Injectable } from "@nestjs/common";
import { shuffled } from "@recall/kit";
import { Clock } from "@/core/ports/clock";
import { IdGenerator } from "@/core/ports/id-generator";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import {
	AttemptAlreadyInProgressError,
	AttemptEntity,
	AttemptsRepository,
	type QuizAttemptId,
	QuizAttemptMode,
	QuizSetNotPublishedError,
	toQuizAttemptId,
} from "@/modules/attempts";
import { type PageId } from "@/modules/pages";
import {
	QuestionEntity,
	type QuestionId,
	QuizSetEntity,
	type QuizSetId,
	QuizSetNotFoundError,
	QuizSetStatus,
	QuizzesRepository,
} from "@/modules/quizzes";
import { StudySettingsService } from "@/modules/study-settings";
import { WeakTopicEntity } from "../weak-topic.entity";

export type PracticeMode =
	| typeof QuizAttemptMode.Mistakes
	| typeof QuizAttemptMode.WeakTopics
	| typeof QuizAttemptMode.Selected;

export class NothingToPracticeError extends Error {
	readonly quizSetId: QuizSetId;
	readonly mode: PracticeMode;
	readonly folderId?: PageId;

	constructor(quizSetId: QuizSetId, mode: PracticeMode, folderId?: PageId) {
		super(`Quiz set ${quizSetId} has nothing to practise in ${mode} mode`);
		this.name = "NothingToPracticeError";
		this.quizSetId = quizSetId;
		this.mode = mode;
		this.folderId = folderId;
	}
}

export interface StartPracticeSessionUseCaseOptions {
	readonly quizSetId: QuizSetId;
	readonly telegramUserId?: number;
	readonly mode: PracticeMode;
	readonly questionIds?: readonly QuestionId[];
}

export interface StartPracticeSessionResult {
	readonly attemptId: QuizAttemptId;
	readonly currentQuestionId?: QuestionId;
	readonly questionCount: number;
	readonly topics: readonly string[];
}

type Options = StartPracticeSessionUseCaseOptions;
type Result = StartPracticeSessionResult;

@Injectable()
export class StartPracticeSessionUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly attempts: AttemptsRepository,
		private readonly quizzes: QuizzesRepository,
		private readonly settings: StudySettingsService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
		private readonly ids: IdGenerator,
	) {
		super();
	}

	async execute(options: Options): Promise<Result> {
		return this.transaction.run(async () => {
			const quizSet = await this.quizzes.findById(options.quizSetId);

			if (quizSet === undefined) {
				throw new QuizSetNotFoundError(options.quizSetId);
			}

			if (quizSet.status !== QuizSetStatus.Published) {
				throw new QuizSetNotPublishedError(options.quizSetId);
			}

			const unfinished = await this.attempts.findActive();

			if (unfinished !== undefined) {
				throw new AttemptAlreadyInProgressError(
					unfinished.id,
					unfinished.quizSetId,
				);
			}

			const topics =
				options.mode === QuizAttemptMode.WeakTopics
					? await this.weakTopics(options.quizSetId)
					: [];
			const selected = await this.questionsFor(options, quizSet, topics);

			if (selected.length === 0) {
				throw new NothingToPracticeError(
					options.quizSetId,
					options.mode,
					quizSet.folderId,
				);
			}

			const id = toQuizAttemptId(this.ids.generate());
			const { shuffleQuestions } = (await this.settings.resolve(quizSet.id))
				.settings;
			const shuffle =
				shuffleQuestions && options.mode !== QuizAttemptMode.Selected;

			const attempt = AttemptEntity.start({
				id,
				quizSetId: quizSet.id,
				telegramUserId: options.telegramUserId,
				mode: options.mode,
				questionIds: shuffle ? shuffled(selected, id) : selected,
				startedAt: this.clock.now(),
			});

			await this.attempts.save(attempt);

			return {
				attemptId: attempt.id,
				currentQuestionId: AttemptEntity.currentQuestionId(attempt),
				questionCount: attempt.questionIds.length,
				topics,
			};
		});
	}

	private async questionsFor(
		options: Options,
		quizSet: QuizSetEntity,
		topics: readonly string[],
	): Promise<readonly QuestionId[]> {
		switch (options.mode) {
			case QuizAttemptMode.WeakTopics:
				return this.questionsOfTopics(quizSet, topics);
			case QuizAttemptMode.Selected:
				return this.chosenQuestions(quizSet, options.questionIds ?? []);
			default:
				return this.outstandingMistakes(options.quizSetId, quizSet);
		}
	}

	private chosenQuestions(
		quizSet: QuizSetEntity,
		questionIds: readonly QuestionId[],
	): readonly QuestionId[] {
		const present = new Set<string>(
			quizSet.questions.map((question) => String(question.id)),
		);
		const chosen: QuestionId[] = [];

		for (const questionId of questionIds) {
			if (
				present.has(String(questionId)) &&
				!chosen.some((taken) => String(taken) === String(questionId))
			) {
				chosen.push(questionId);
			}
		}

		return chosen;
	}

	private async weakTopics(quizSetId: QuizSetId): Promise<readonly string[]> {
		return WeakTopicEntity.from(
			await this.attempts.topicAccuracy(quizSetId),
		).map((weak) => weak.topic);
	}

	private async outstandingMistakes(
		quizSetId: QuizSetId,
		quizSet: QuizSetEntity,
	): Promise<readonly QuestionId[]> {
		const present = new Set<string>(
			quizSet.questions.map((question) => String(question.id)),
		);

		return (await this.attempts.incorrectQuestionIds(quizSetId)).filter(
			(questionId) => present.has(String(questionId)),
		);
	}

	private questionsOfTopics(
		quizSet: QuizSetEntity,
		topics: readonly string[],
	): readonly QuestionId[] {
		const weak = new Set(topics);

		return quizSet.questions
			.filter(
				(question: QuestionEntity) =>
					question.topic !== undefined && weak.has(question.topic),
			)
			.map((question) => question.id);
	}
}
