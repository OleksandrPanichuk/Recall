import { shuffled } from "@recall/kit";
import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { AttemptRepository } from "@/application/ports/repositories/attempt.repository";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import type { FolderId } from "@/domain/folder/folder";
import { weakTopicsOf } from "@/domain/practice/weak-topics";
import {
	currentQuestionId,
	type QuizAttemptId,
	QuizAttemptMode,
	startQuizAttempt,
	toQuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { Question, QuestionId } from "@/domain/quiz-set/question";
import {
	type QuizSet,
	type QuizSetId,
	QuizSetStatus,
} from "@/domain/quiz-set/quiz-set";
import {
	AttemptAlreadyInProgressError,
	QuizSetNotPublishedError,
} from "../attempts/start-quiz-attempt";
import { QuizSetNotFoundError } from "../quiz-sets/update-quiz-set";
import { resolveWithSource } from "../settings/resolve-quiz-settings";

export type PracticeMode =
	| typeof QuizAttemptMode.Mistakes
	| typeof QuizAttemptMode.WeakTopics;

export class NothingToPracticeError extends Error {
	readonly quizSetId: QuizSetId;
	readonly mode: PracticeMode;
	readonly folderId?: FolderId;

	constructor(quizSetId: QuizSetId, mode: PracticeMode, folderId?: FolderId) {
		super(`Quiz set ${quizSetId} has nothing to practise in ${mode} mode`);
		this.name = "NothingToPracticeError";
		this.quizSetId = quizSetId;
		this.mode = mode;
		this.folderId = folderId;
	}
}

export interface StartPracticeSessionCommand {
	readonly quizSetId: QuizSetId;
	// Kept as provenance on the row, not as an identity the api trusts.
	readonly telegramUserId?: number;
	readonly mode: PracticeMode;
}

export interface StartPracticeSessionResult {
	readonly attemptId: QuizAttemptId;
	readonly currentQuestionId?: QuestionId;
	readonly questionCount: number;
	readonly topics: readonly string[];
}

export type StartPracticeSessionDependencies = ApplicationDependencies;

export class StartPracticeSessionUseCase
	implements
		UseCase<Command<StartPracticeSessionCommand>, StartPracticeSessionResult>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;

	constructor(dependencies: StartPracticeSessionDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
	}

	async execute(
		request: Command<StartPracticeSessionCommand>,
	): Promise<StartPracticeSessionResult> {
		return this.unitOfWork.run(async ({ quizzes, attempts, reviews }) => {
			const quizSet = await quizzes.findById(request.quizSetId);

			if (quizSet === undefined) {
				throw new QuizSetNotFoundError(request.quizSetId);
			}

			if (quizSet.status !== QuizSetStatus.Published) {
				throw new QuizSetNotPublishedError(request.quizSetId);
			}

			const unfinished = await attempts.findActive();

			if (unfinished !== undefined) {
				throw new AttemptAlreadyInProgressError(
					unfinished.id,
					unfinished.quizSetId,
				);
			}

			const topics =
				request.mode === QuizAttemptMode.WeakTopics
					? await this.weakTopics(request, attempts)
					: [];
			const selected =
				request.mode === QuizAttemptMode.WeakTopics
					? questionsOfTopics(quizSet, topics)
					: await this.outstandingMistakes(request, quizSet, attempts);

			if (selected.length === 0) {
				throw new NothingToPracticeError(
					request.quizSetId,
					request.mode,
					quizSet.folderId,
				);
			}

			const id = toQuizAttemptId(this.idGenerator.generate());
			const { shuffleQuestions } = (
				await resolveWithSource(reviews, quizSet.id)
			).settings;

			const attempt = startQuizAttempt({
				id,
				quizSetId: quizSet.id,
				telegramUserId: request.telegramUserId,
				mode: request.mode,
				questionIds: shuffleQuestions ? shuffled(selected, id) : selected,
				startedAt: this.clock.now(),
			});

			await attempts.save(attempt);

			return {
				attemptId: attempt.id,
				currentQuestionId: currentQuestionId(attempt),
				questionCount: attempt.questionIds.length,
				topics,
			};
		});
	}

	private async weakTopics(
		request: Command<StartPracticeSessionCommand>,
		attempts: AttemptRepository,
	): Promise<readonly string[]> {
		return weakTopicsOf(await attempts.topicAccuracy(request.quizSetId)).map(
			(weak) => weak.topic,
		);
	}

	private async outstandingMistakes(
		request: Command<StartPracticeSessionCommand>,
		quizSet: QuizSet,
		attempts: AttemptRepository,
	): Promise<readonly QuestionId[]> {
		const present = new Set<string>(
			quizSet.questions.map((question) => String(question.id)),
		);

		return (await attempts.incorrectQuestionIds(request.quizSetId)).filter(
			(questionId) => present.has(String(questionId)),
		);
	}
}

function questionsOfTopics(
	quizSet: QuizSet,
	topics: readonly string[],
): readonly QuestionId[] {
	const weak = new Set(topics);

	return quizSet.questions
		.filter((question: Question) => hasWeakTopic(question, weak))
		.map((question) => question.id);
}

const hasWeakTopic = (question: Question, weak: ReadonlySet<string>): boolean =>
	question.topic !== undefined && weak.has(question.topic);
