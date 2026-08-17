import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
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
import { shuffled } from "@/shared/utils/shuffle";
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

	constructor(quizSetId: QuizSetId, mode: PracticeMode) {
		super(`Quiz set ${quizSetId} has nothing to practise in ${mode} mode`);
		this.name = "NothingToPracticeError";
		this.quizSetId = quizSetId;
		this.mode = mode;
	}
}

export interface StartPracticeSessionCommand {
	readonly quizSetId: QuizSetId;
	readonly telegramUserId: number;
	readonly mode: PracticeMode;
}

export interface StartPracticeSessionResult {
	readonly attemptId: QuizAttemptId;
	readonly currentQuestionId?: QuestionId;
	readonly questionCount: number;
	readonly topics: readonly string[];
}

export interface StartPracticeSessionDependencies {
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
	readonly repetition: RepetitionRepository;
	readonly clock: Clock;
	readonly idGenerator: IdGenerator;
}

export class StartPracticeSession
	implements
		UseCase<Command<StartPracticeSessionCommand>, StartPracticeSessionResult>
{
	private readonly quizSets: QuizSetRepository;
	private readonly attempts: QuizAttemptRepository;
	private readonly repetition: RepetitionRepository;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;

	constructor(dependencies: StartPracticeSessionDependencies) {
		this.quizSets = dependencies.quizSets;
		this.attempts = dependencies.attempts;
		this.repetition = dependencies.repetition;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
	}

	async execute(
		request: Command<StartPracticeSessionCommand>,
	): Promise<StartPracticeSessionResult> {
		const quizSet = this.quizSets.findById(request.quizSetId);

		if (quizSet === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		if (quizSet.status !== QuizSetStatus.Published) {
			throw new QuizSetNotPublishedError(request.quizSetId);
		}

		const unfinished = this.attempts.findActiveByUser(request.telegramUserId);

		if (unfinished !== undefined) {
			throw new AttemptAlreadyInProgressError(
				unfinished.id,
				unfinished.quizSetId,
			);
		}

		const topics =
			request.mode === QuizAttemptMode.WeakTopics
				? this.weakTopics(request)
				: [];
		const selected =
			request.mode === QuizAttemptMode.WeakTopics
				? questionsOfTopics(quizSet, topics)
				: this.outstandingMistakes(request, quizSet);

		if (selected.length === 0) {
			throw new NothingToPracticeError(request.quizSetId, request.mode);
		}

		const id = toQuizAttemptId(this.idGenerator.generate());
		const { shuffleQuestions } = resolveWithSource(
			this.repetition,
			quizSet.id,
		).settings;

		const attempt = startQuizAttempt({
			id,
			quizSetId: quizSet.id,
			telegramUserId: request.telegramUserId,
			mode: request.mode,
			questionIds: shuffleQuestions ? shuffled(selected, id) : selected,
			startedAt: this.clock.now(),
		});

		this.attempts.save(attempt);

		return {
			attemptId: attempt.id,
			currentQuestionId: currentQuestionId(attempt),
			questionCount: attempt.questionIds.length,
			topics,
		};
	}

	private weakTopics(
		request: Command<StartPracticeSessionCommand>,
	): readonly string[] {
		return weakTopicsOf(
			this.attempts.topicAccuracy(request.telegramUserId, request.quizSetId),
		).map((weak) => weak.topic);
	}

	private outstandingMistakes(
		request: Command<StartPracticeSessionCommand>,
		quizSet: QuizSet,
	): readonly QuestionId[] {
		const present = new Set<string>(
			quizSet.questions.map((question) => String(question.id)),
		);

		return this.attempts
			.incorrectQuestionIds(request.telegramUserId, request.quizSetId)
			.filter((questionId) => present.has(String(questionId)));
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
