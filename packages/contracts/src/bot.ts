import { z } from "zod";
import { questionSchema } from "./questions";

export const QuizAttemptStatus = {
	Active: "active",
	Paused: "paused",
	Completed: "completed",
} as const;
export type QuizAttemptStatus =
	(typeof QuizAttemptStatus)[keyof typeof QuizAttemptStatus];

export const QuizAttemptMode = {
	Full: "full",
	Mistakes: "mistakes",
	WeakTopics: "weak_topics",
} as const;
export type QuizAttemptMode =
	(typeof QuizAttemptMode)[keyof typeof QuizAttemptMode];

export const QuizSetStatus = {
	Draft: "draft",
	Published: "published",
	Archived: "archived",
} as const;
export type QuizSetStatus = (typeof QuizSetStatus)[keyof typeof QuizSetStatus];

export const QuizSettingsSource = {
	Set: "set",
	Global: "global",
	Default: "default",
} as const;
export type QuizSettingsSource =
	(typeof QuizSettingsSource)[keyof typeof QuizSettingsSource];

export type QuizSetId = string;
export type QuizAttemptId = string;
export type QuestionId = string;
export type QuestionOptionId = string;
export type FolderId = string;

const id = z.string().min(1);
const optionalId = id.optional();
const count = z.number().int().nonnegative();

export const scoreSchema = z.object({
	correct: z.number(),
	total: z.number(),
	percentage: z.number(),
});

export const repetitionSettingsSchema = z.object({
	intervalsDays: z.array(z.number().int()).readonly(),
	maxIntervalDays: z.number().int(),
	maxRepetitions: z.number().int(),
});

export const quizSettingsSchema = z.object({
	repetition: repetitionSettingsSchema,
	shuffleOptions: z.boolean(),
	shuffleQuestions: z.boolean(),
	examMode: z.boolean(),
});

export const quizSummarySchema = z.object({
	id,
	title: z.string(),
	status: z.enum(QuizSetStatus),
	questionCount: count,
	updatedAt: z.string(),
});

export const browseCrumbSchema = z.object({ id, name: z.string() });

export const browseViewSchema = z.object({
	folderId: optionalId,
	name: z.string().optional(),
	parentId: optionalId,
	breadcrumb: z.array(browseCrumbSchema).readonly(),
	children: z.array(browseCrumbSchema.extend({ itemCount: count })).readonly(),
	sets: z.array(quizSummarySchema).readonly(),
});

export const currentQuestionSchema = z.object({
	attemptId: id,
	quizSetId: id,
	quizSetTitle: z.string(),
	status: z.enum(QuizAttemptStatus),
	question: questionSchema.optional(),
	index: z.number().int(),
	total: z.number().int(),
	awaitingFinish: z.boolean(),
	shuffleOptions: z.boolean(),
	examMode: z.boolean(),
});

export const startAttemptResultSchema = z.object({
	attemptId: id,
	resumed: z.boolean(),
	currentQuestionId: optionalId,
});

export const practiceResultSchema = z.object({
	attemptId: id,
	currentQuestionId: optionalId,
	questionCount: count,
	topics: z.array(z.string()).readonly(),
});

export const answerResultSchema = z.object({
	isCorrect: z.boolean(),
	alreadyAnswered: z.boolean(),
	explanation: z.string().optional(),
	correctOptionIds: z.array(id).readonly(),
	nextQuestionId: optionalId,
	score: scoreSchema,
	question: questionSchema,
	acceptedAnswers: z.array(z.string()).readonly(),
	typedAnswer: z.string().optional(),
	nearMiss: z.string().optional(),
	credit: z.object({ earned: z.number(), possible: z.number() }),
});

export const finishResultSchema = z.object({
	attemptId: id,
	quizSetId: id,
	score: scoreSchema,
	unansweredCount: count,
});

export const attemptSummarySchema = z.object({
	attemptId: id,
	score: scoreSchema,
	completedAt: z.string().optional(),
});

export const quizStatisticsSchema = z.object({
	quizSetId: id,
	title: z.string(),
	folderId: optionalId,
	attempts: z.array(attemptSummarySchema).readonly(),
	setAccuracy: scoreSchema,
	topics: z
		.array(
			z.object({
				topic: z.string().optional(),
				answered: count,
				correct: count,
			}),
		)
		.readonly(),
	incorrectQuestionIds: z.array(id).readonly(),
	improvement: z
		.object({
			firstPercentage: z.number(),
			lastPercentage: z.number(),
			deltaPercentage: z.number(),
		})
		.optional(),
});

export const attemptDetailSchema = z.object({
	attemptId: id,
	quizSetId: id,
	quizSetTitle: z.string(),
	score: scoreSchema,
	completedAt: z.string().optional(),
	answers: z
		.array(
			z.object({
				question: questionSchema,
				answered: z.boolean(),
				isCorrect: z.boolean(),
				skipped: z.boolean(),
				typedAnswer: z.string().optional(),
				selectedOptionIds: z.array(id).readonly(),
				creditEarned: z.number(),
				creditPossible: z.number(),
			}),
		)
		.readonly(),
});

export const dueSetSchema = z.object({
	quizSetId: id,
	title: z.string(),
	dueCount: count,
	overdueDays: z.number().int(),
	dueQuestionIds: z.array(id).readonly(),
});

export const leechSchema = z.object({
	questionId: id,
	quizSetId: id,
	quizSetTitle: z.string(),
	prompt: z.string(),
	lapses: count,
});

export const resolvedSettingsSchema = z.object({
	settings: quizSettingsSchema,
	source: z.enum(QuizSettingsSource),
	quizSetId: optionalId,
	title: z.string().optional(),
	folderId: optionalId,
});

export const loginLinkCommandSchema = z.object({
	telegramUserId: z.number().int(),
	displayName: z.string().trim().min(1).optional(),
});

export const loginLinkSchema = z.object({
	url: z.string(),
	expiresAt: z.string(),
});

export const issueApiTokenCommandSchema = z.object({
	telegramUserId: z.number().int(),
	name: z.string().trim().min(1).max(80),
	expiresInDays: z.number().int().positive().max(3650).optional(),
});

export const issuedApiTokenSchema = z.object({
	id,
	name: z.string(),
	token: z.string(),
	expiresAt: z.string().optional(),
});

export const listApiTokensCommandSchema = z.object({
	telegramUserId: z.number().int(),
});

export const apiTokenSchema = z.object({
	id,
	name: z.string(),
	scopes: z.array(z.string()).readonly(),
	lastUsedAt: z.string().optional(),
	expiresAt: z.string().optional(),
	createdAt: z.string(),
});

export const revokeApiTokenCommandSchema = z.object({
	telegramUserId: z.number().int(),
	tokenId: id,
});

export const revokedApiTokenSchema = z.object({ revoked: z.boolean() });

export const browseCommandSchema = z.object({ folderId: optionalId });

export const startAttemptCommandSchema = z.object({
	quizSetId: id,
	telegramUserId: z.number().int(),
	onlyDue: z.boolean().optional(),
});

export const PracticeMode = {
	Mistakes: QuizAttemptMode.Mistakes,
	WeakTopics: QuizAttemptMode.WeakTopics,
} as const;
export type PracticeMode = (typeof PracticeMode)[keyof typeof PracticeMode];

export const practiceCommandSchema = z.object({
	quizSetId: id,
	telegramUserId: z.number().int(),
	mode: z.enum(PracticeMode),
});

export const currentQuestionCommandSchema = z.object({
	telegramUserId: z.number().int(),
});

export const answerCommandSchema = z.object({
	telegramUserId: z.number().int(),
	questionId: id,
	selectedOptionPositions: z.array(z.number().int()).readonly().optional(),
	typedAnswer: z.string().optional(),
	revealed: z.boolean().optional(),
});

export const finishCommandSchema = z.object({
	telegramUserId: z.number().int(),
});

export const statisticsCommandSchema = z.object({
	telegramUserId: z.number().int(),
	quizSetId: id,
});

export const attemptDetailCommandSchema = z.object({
	telegramUserId: z.number().int(),
	attemptId: id,
});

export const dueRepetitionsCommandSchema = z.object({
	telegramUserId: z.number().int(),
});

export const leechesCommandSchema = z.object({
	telegramUserId: z.number().int(),
	threshold: z.number().int().optional(),
});

export const resolveSettingsCommandSchema = z.object({
	quizSetId: optionalId,
});

export const updateSettingsCommandSchema = z.object({
	quizSetId: optionalId,
	repetition: repetitionSettingsSchema.optional(),
	shuffleOptions: z.boolean().optional(),
	shuffleQuestions: z.boolean().optional(),
	examMode: z.boolean().optional(),
	inheritGlobal: z.boolean().optional(),
});

export type Score = z.infer<typeof scoreSchema>;
export type RepetitionSettings = z.infer<typeof repetitionSettingsSchema>;
export type QuizSettings = z.infer<typeof quizSettingsSchema>;
export type QuizSummary = z.infer<typeof quizSummarySchema>;
export type BrowseCrumb = z.infer<typeof browseCrumbSchema>;
export type BrowseView = z.infer<typeof browseViewSchema>;
export type CurrentQuestionView = z.infer<typeof currentQuestionSchema>;
export type StartQuizAttemptResult = z.infer<typeof startAttemptResultSchema>;
export type StartPracticeSessionResult = z.infer<typeof practiceResultSchema>;
export type AnswerQuestionResult = z.infer<typeof answerResultSchema>;
export type FinishQuizAttemptResult = z.infer<typeof finishResultSchema>;
export type AttemptSummary = z.infer<typeof attemptSummarySchema>;
export type QuizStatistics = z.infer<typeof quizStatisticsSchema>;
export type AttemptDetail = z.infer<typeof attemptDetailSchema>;
export type AnsweredQuestion = AttemptDetail["answers"][number];
export type DueSet = z.infer<typeof dueSetSchema>;
export type LeechView = z.infer<typeof leechSchema>;
export type ResolvedQuizSettings = z.infer<typeof resolvedSettingsSchema>;

export type LoginLink = z.infer<typeof loginLinkSchema>;
export type IssueLoginLinkCommand = z.infer<typeof loginLinkCommandSchema>;
export type IssuedApiToken = z.infer<typeof issuedApiTokenSchema>;
export type ApiToken = z.infer<typeof apiTokenSchema>;
export type IssueApiTokenCommand = z.infer<typeof issueApiTokenCommandSchema>;
export type ListApiTokensCommand = z.infer<typeof listApiTokensCommandSchema>;
export type RevokeApiTokenCommand = z.infer<typeof revokeApiTokenCommandSchema>;
export type RevokedApiToken = z.infer<typeof revokedApiTokenSchema>;
export type BrowseFolderCommand = z.infer<typeof browseCommandSchema>;
export type StartQuizAttemptCommand = z.infer<typeof startAttemptCommandSchema>;
export type StartPracticeSessionCommand = z.infer<typeof practiceCommandSchema>;
export type GetCurrentQuestionCommand = z.infer<
	typeof currentQuestionCommandSchema
>;
export type AnswerQuestionCommand = z.infer<typeof answerCommandSchema>;
export type FinishQuizAttemptCommand = z.infer<typeof finishCommandSchema>;
export type GetQuizStatisticsCommand = z.infer<typeof statisticsCommandSchema>;
export type GetAttemptDetailCommand = z.infer<
	typeof attemptDetailCommandSchema
>;
export type ListDueRepetitionsCommand = z.infer<
	typeof dueRepetitionsCommandSchema
>;
export type ListLeechesCommand = z.infer<typeof leechesCommandSchema>;
export type ResolveQuizSettingsCommand = z.infer<
	typeof resolveSettingsCommandSchema
>;
export type UpdateQuizSettingsCommand = z.infer<
	typeof updateSettingsCommandSchema
>;
