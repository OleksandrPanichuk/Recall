import type {
	AnswerQuestionResult as WireAnswerResult,
	CurrentQuestionView as WireCurrentQuestion,
	FinishQuizAttemptResult as WireFinishResult,
	ResumedAttempt as WireResumedAttempt,
	StartQuizAttemptResult as WireStartResult,
} from "@recall/contracts";
import { questionToWire } from "@/modules/quizzes";
import type {
	AnswerQuestionResult,
	CurrentQuestionView,
	FinishQuizAttemptResult,
	ResumeQuizAttemptResult,
	StartQuizAttemptResult,
} from "./use-cases";

const text = (value: string | undefined): string | undefined => value;

export const resumedAttemptToWire = (
	resumed: ResumeQuizAttemptResult,
): WireResumedAttempt => ({
	attemptId: String(resumed.attemptId),
	currentQuestionId:
		resumed.currentQuestionId === undefined
			? undefined
			: String(resumed.currentQuestionId),
});

export const currentQuestionToWire = (
	view: CurrentQuestionView,
): WireCurrentQuestion => ({
	attemptId: String(view.attemptId),
	quizSetId: String(view.quizSetId),
	quizSetTitle: view.quizSetTitle,
	status: view.status,
	question:
		view.question === undefined ? undefined : questionToWire(view.question),
	index: view.index,
	total: view.total,
	awaitingFinish: view.awaitingFinish,
	shuffleOptions: view.shuffleOptions,
	examMode: view.examMode,
});

export const startResultToWire = (
	result: StartQuizAttemptResult,
): WireStartResult => ({
	attemptId: String(result.attemptId),
	resumed: result.resumed,
	currentQuestionId:
		result.currentQuestionId === undefined
			? undefined
			: String(result.currentQuestionId),
});

export const answerResultToWire = (
	result: AnswerQuestionResult,
): WireAnswerResult => ({
	isCorrect: result.isCorrect,
	alreadyAnswered: result.alreadyAnswered,
	explanation: text(result.explanation),
	correctOptionIds: result.correctOptionIds.map(String),
	nextQuestionId:
		result.nextQuestionId === undefined
			? undefined
			: String(result.nextQuestionId),
	score: { ...result.score },
	question: questionToWire(result.question),
	acceptedAnswers: [...result.acceptedAnswers],
	typedAnswer: text(result.typedAnswer),
	nearMiss: text(result.nearMiss),
	credit: { earned: result.credit.earned, possible: result.credit.possible },
	gradable: result.gradable,
});

export const finishResultToWire = (
	result: FinishQuizAttemptResult,
): WireFinishResult => ({
	attemptId: String(result.attemptId),
	quizSetId: String(result.quizSetId),
	score: { ...result.score },
	unansweredCount: result.unansweredCount,
});
