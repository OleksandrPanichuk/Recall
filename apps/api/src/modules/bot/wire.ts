import type {
	AnswerQuestionResult as WireAnswerResult,
	AttemptDetail as WireAttemptDetail,
	BrowseView as WireBrowseView,
	CurrentQuestionView as WireCurrentQuestion,
	DueSet as WireDueSet,
	FinishQuizAttemptResult as WireFinishResult,
	LeechView as WireLeech,
	StartPracticeSessionResult as WirePracticeResult,
	Question as WireQuestion,
	QuizSettings as WireQuizSettings,
	QuizSummary as WireQuizSummary,
	ResolvedQuizSettings as WireResolvedSettings,
	StartQuizAttemptResult as WireStartResult,
	QuizStatistics as WireStatistics,
} from "@recall/contracts";
import type { QuizSummary } from "@/application/ports/repositories/quiz.repository";
import type { AnswerQuestionResult } from "@/application/use-cases/attempts/answer-question";
import type { FinishQuizAttemptResult } from "@/application/use-cases/attempts/finish-quiz-attempt";
import type { CurrentQuestionView } from "@/application/use-cases/attempts/get-current-question";
import type { StartQuizAttemptResult } from "@/application/use-cases/attempts/start-quiz-attempt";
import type { BrowseView } from "@/application/use-cases/folders/browse-folder";
import type { StartPracticeSessionResult } from "@/application/use-cases/practice/start-practice-session";
import type { LeechView } from "@/application/use-cases/repetition/list-leeches";
import type { ResolvedQuizSettings } from "@/application/use-cases/settings/resolve-quiz-settings";
import type { AttemptDetail } from "@/application/use-cases/statistics/get-attempt-detail";
import type { QuizStatistics } from "@/application/use-cases/statistics/get-quiz-statistics";
import type { Question } from "@/domain/quiz-set/question";
import type { DueSet } from "@/domain/repetition/repetition.types";
import type { QuizSettings } from "@/domain/settings/quiz-settings";

const text = (value: string | undefined): string | undefined =>
	value === undefined ? undefined : value;

export const questionToWire = (question: Question): WireQuestion => ({
	id: String(question.id),
	type: question.type,
	prompt: question.prompt,
	options: question.options.map((option) => ({
		id: String(option.id),
		text: option.text,
		isCorrect: option.isCorrect,
		position: option.position,
		matchKey: text(option.matchKey),
	})),
	difficulty: question.difficulty,
	position: question.position,
	explanation: text(question.explanation),
	sourceReference: text(question.sourceReference),
	topic: text(question.topic),
	hint: text(question.hint),
	vocabularyItemId: text(question.vocabularyItemId),
});

export const quizSummaryToWire = (summary: QuizSummary): WireQuizSummary => ({
	id: String(summary.id),
	title: summary.title,
	status: summary.status,
	questionCount: summary.questionCount,
	updatedAt: summary.updatedAt.toISOString(),
});

export const browseViewToWire = (view: BrowseView): WireBrowseView => ({
	folderId: view.folderId === undefined ? undefined : String(view.folderId),
	name: text(view.name),
	summary: text(view.summary),
	icon: text(view.icon),
	parentId: view.parentId === undefined ? undefined : String(view.parentId),
	breadcrumb: view.breadcrumb.map((crumb) => ({
		id: String(crumb.id),
		name: crumb.name,
	})),
	children: view.children.map((child) => ({
		id: String(child.id),
		name: child.name,
		itemCount: child.itemCount,
	})),
	sets: view.sets.map(quizSummaryToWire),
	attached: view.attached.map(quizSummaryToWire),
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

export const practiceResultToWire = (
	result: StartPracticeSessionResult,
): WirePracticeResult => ({
	attemptId: String(result.attemptId),
	currentQuestionId:
		result.currentQuestionId === undefined
			? undefined
			: String(result.currentQuestionId),
	questionCount: result.questionCount,
	topics: [...result.topics],
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
});

export const finishResultToWire = (
	result: FinishQuizAttemptResult,
): WireFinishResult => ({
	attemptId: String(result.attemptId),
	quizSetId: String(result.quizSetId),
	score: { ...result.score },
	unansweredCount: result.unansweredCount,
});

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

export const dueSetToWire = (due: DueSet): WireDueSet => ({
	quizSetId: String(due.quizSetId),
	title: due.title,
	dueCount: due.dueCount,
	overdueDays: due.overdueDays,
	dueQuestionIds: due.dueQuestionIds.map(String),
});

export const leechToWire = (leech: LeechView): WireLeech => ({
	questionId: String(leech.questionId),
	quizSetId: String(leech.quizSetId),
	quizSetTitle: leech.quizSetTitle,
	prompt: leech.prompt,
	lapses: leech.lapses,
});

export const settingsToWire = (settings: QuizSettings): WireQuizSettings => ({
	repetition: {
		intervalsDays: [...settings.repetition.intervalsDays],
		maxIntervalDays: settings.repetition.maxIntervalDays,
		maxRepetitions: settings.repetition.maxRepetitions,
	},
	shuffleOptions: settings.shuffleOptions,
	shuffleQuestions: settings.shuffleQuestions,
	examMode: settings.examMode,
});

export const resolvedSettingsToWire = (
	resolved: ResolvedQuizSettings,
): WireResolvedSettings => ({
	settings: settingsToWire(resolved.settings),
	source: resolved.source,
	quizSetId:
		resolved.quizSetId === undefined ? undefined : String(resolved.quizSetId),
	title: text(resolved.title),
	folderId:
		resolved.folderId === undefined ? undefined : String(resolved.folderId),
});
