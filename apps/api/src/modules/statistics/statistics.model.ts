import type {
	AttemptDetail as WireAttemptDetail,
	QuizStatistics as WireStatistics,
} from "@recall/contracts";
import { questionToWire } from "@/modules/quizzes";
import type { AttemptDetail, QuizStatistics } from "./use-cases";

const text = (value: string | undefined): string | undefined => value;

export const statisticsToWire = (
	statistics: QuizStatistics,
): WireStatistics => ({
	quizSetId: String(statistics.quizSetId),
	title: statistics.title,
	folderId:
		statistics.folderId === undefined ? undefined : String(statistics.folderId),
	attempts: statistics.attempts.map((attempt) => ({
		attemptId: String(attempt.attemptId),
		score: { ...attempt.score },
		completedAt: attempt.completedAt?.toISOString(),
	})),
	setAccuracy: { ...statistics.setAccuracy },
	topics: statistics.topics.map((topic) => ({
		topic: text(topic.topic),
		answered: topic.answered,
		correct: topic.correct,
	})),
	incorrectQuestionIds: statistics.incorrectQuestionIds.map(String),
	improvement:
		statistics.improvement === undefined
			? undefined
			: { ...statistics.improvement },
});

export const attemptDetailToWire = (
	detail: AttemptDetail,
): WireAttemptDetail => ({
	attemptId: String(detail.attemptId),
	quizSetId: String(detail.quizSetId),
	quizSetTitle: detail.quizSetTitle,
	score: { ...detail.score },
	completedAt: detail.completedAt?.toISOString(),
	answers: detail.answers.map((answer) => ({
		question: questionToWire(answer.question),
		answered: answer.answered,
		isCorrect: answer.isCorrect,
		skipped: answer.skipped,
		typedAnswer: text(answer.typedAnswer),
		selectedOptionIds: answer.selectedOptionIds.map(String),
		creditEarned: answer.creditEarned,
		creditPossible: answer.creditPossible,
	})),
});
