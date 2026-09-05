import { z } from "zod";
import {
	type AddedQuestions,
	type AddQuestionsCommand,
	addedQuestionsSchema,
	addQuestionsCommandSchema,
	type CreatedSet,
	type CreateSetCommand,
	createdSetSchema,
	createSetCommandSchema,
	type DeletedQuestion,
	type DeleteQuestionCommand,
	deletedQuestionSchema,
	deleteQuestionCommandSchema,
	type ListSetsCommand,
	listSetsCommandSchema,
	type MoveSetCommand,
	moveSetCommandSchema,
	type QuizDetail,
	type QuizSetIdCommand,
	quizDetailSchema,
	quizSetIdCommandSchema,
	type UpdateQuestionCommand,
	type UpdateSetCommand,
	updateQuestionCommandSchema,
	updateSetCommandSchema,
} from "./authoring";
import {
	type AbandonAttemptCommand,
	type AbandonedAttempt,
	type AnswerQuestionCommand,
	type AnswerQuestionResult,
	type ApiToken,
	type AttemptDetail,
	abandonAttemptCommandSchema,
	abandonedAttemptSchema,
	answerCommandSchema,
	answerResultSchema,
	apiTokenSchema,
	attemptDetailCommandSchema,
	attemptDetailSchema,
	type BrowseFolderCommand,
	type BrowseView,
	browseCommandSchema,
	browseViewSchema,
	type CreatedPage,
	type CreatePageCommand,
	type CurrentQuestionView,
	createdPageSchema,
	createPageCommandSchema,
	currentQuestionCommandSchema,
	currentQuestionSchema,
	type DeletePageCommand,
	type DueSet,
	deletePageCommandSchema,
	dueRepetitionsCommandSchema,
	dueSetSchema,
	type FinishQuizAttemptCommand,
	type FinishQuizAttemptResult,
	finishCommandSchema,
	finishResultSchema,
	type GetAttemptDetailCommand,
	type GetCurrentQuestionCommand,
	type GetInsightsCommand,
	type GetQuizStatisticsCommand,
	type Insights,
	type IssueApiTokenCommand,
	type IssuedApiToken,
	type IssueLoginLinkCommand,
	type IssueOwnApiTokenCommand,
	insightsCommandSchema,
	insightsSchema,
	issueApiTokenCommandSchema,
	issuedApiTokenSchema,
	issueOwnApiTokenCommandSchema,
	type LeechView,
	type ListApiTokensCommand,
	type ListDueRepetitionsCommand,
	type ListLeechesCommand,
	type ListOwnApiTokensCommand,
	type ListRevisionsCommand,
	type LoginLink,
	leechesCommandSchema,
	leechSchema,
	listApiTokensCommandSchema,
	listOwnApiTokensCommandSchema,
	listRevisionsCommandSchema,
	loginLinkCommandSchema,
	loginLinkSchema,
	type MovePageCommand,
	movePageCommandSchema,
	type PageMatch,
	type PageRevision,
	type PageTreeNode,
	pageMatchSchema,
	pageRevisionSchema,
	pageTreeNodeSchema,
	practiceCommandSchema,
	practiceResultSchema,
	type QuizSettings,
	type QuizStatistics,
	type QuizSummary,
	quizSettingsSchema,
	quizStatisticsSchema,
	quizSummarySchema,
	type RenamePageCommand,
	type ReorderPageCommand,
	type ResolvedQuizSettings,
	type ResolveQuizSettingsCommand,
	type RevokeApiTokenCommand,
	type RevokedApiToken,
	type RevokeOwnApiTokenCommand,
	renamePageCommandSchema,
	reorderPageCommandSchema,
	resolvedSettingsSchema,
	resolveSettingsCommandSchema,
	revokeApiTokenCommandSchema,
	revokedApiTokenSchema,
	revokeOwnApiTokenCommandSchema,
	type SearchPagesCommand,
	type SetPageIconCommand,
	type StartPracticeSessionCommand,
	type StartPracticeSessionResult,
	type StartQuizAttemptCommand,
	type StartQuizAttemptResult,
	type SummaryWritten,
	searchPagesCommandSchema,
	setPageIconCommandSchema,
	startAttemptCommandSchema,
	startAttemptResultSchema,
	statisticsCommandSchema,
	summaryWrittenSchema,
	type UpdateQuizSettingsCommand,
	updateSettingsCommandSchema,
	type WriteSummaryCommand,
	writeSummaryCommandSchema,
} from "./bot";

export type Fetch = (
	input: string | URL,
	init?: RequestInit,
) => Promise<Response>;

export interface RecallClientOptions {
	readonly baseUrl: string | URL;
	readonly headers?: Readonly<Record<string, string>>;
	readonly fetch?: Fetch;
	readonly timeoutMs?: number;
}

export interface BotApiOptions extends Omit<RecallClientOptions, "headers"> {
	readonly token: string;
}

export interface AppApiOptions extends Omit<RecallClientOptions, "headers"> {
	readonly cookie?: string;
}

export class BotApiError extends Error {
	constructor(
		readonly errorName: string,
		message: string,
		readonly status: number,
		readonly details: Readonly<Record<string, string>> = {},
	) {
		super(message);
		this.name = "BotApiError";
	}
}

export class BotApiUnreachableError extends Error {
	constructor(
		readonly endpoint: string,
		cause: unknown,
	) {
		super(`the recall api at ${endpoint} could not be reached`, { cause });
		this.name = "BotApiUnreachableError";
	}
}

export class BotApiContractError extends Error {
	constructor(
		readonly endpoint: string,
		readonly problems: string,
	) {
		super(
			`the recall api answered ${endpoint} with a body this bot cannot read`,
		);
		this.name = "BotApiContractError";
	}
}

const DEFAULT_TIMEOUT_MS = 30_000;

export const ApiErrorName = {
	NoActiveAttempt: "NoActiveAttemptError",
	AttemptAlreadyInProgress: "AttemptAlreadyInProgressError",
	AttemptAlreadyFinished: "AttemptAlreadyFinishedError",
	AttemptNotActive: "AttemptNotActiveError",
	QuestionNotInAttempt: "QuestionNotInAttemptError",
	QuizSetNotPublished: "QuizSetNotPublishedError",
	QuizSetNotFound: "QuizSetNotFoundError",
	FolderNotFound: "FolderNotFoundError",
	FolderCycle: "FolderCycleError",
	FolderDepth: "FolderDepthError",
	DuplicateFolderName: "DuplicateFolderNameError",
	FolderNotEmpty: "FolderNotEmptyError",
	NothingToPractice: "NothingToPracticeError",
	NothingDue: "NothingDueError",
} as const;
export type ApiErrorName = (typeof ApiErrorName)[keyof typeof ApiErrorName];

export const isApiError = (
	error: unknown,
	name?: ApiErrorName,
): error is BotApiError =>
	error instanceof BotApiError &&
	(name === undefined || error.errorName === name);

interface Failure {
	readonly error?: unknown;
	readonly message?: unknown;
	readonly details?: unknown;
}

const detailsOf = (value: unknown): Readonly<Record<string, string>> => {
	if (typeof value !== "object" || value === null) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(value).flatMap(([key, entry]) =>
			typeof entry === "string" ? [[key, entry] as const] : [],
		),
	);
};

export interface UseCaseLike<Command, Result> {
	execute(command: Command): Promise<Result>;
}

export interface AuthoringUseCases {
	readonly createQuizSet: UseCaseLike<CreateSetCommand, CreatedSet>;
	readonly updateQuizSet: UseCaseLike<UpdateSetCommand, void>;
	readonly moveQuizSet: UseCaseLike<MoveSetCommand, void>;
	readonly publishQuizSet: UseCaseLike<QuizSetIdCommand, void>;
	readonly archiveQuizSet: UseCaseLike<QuizSetIdCommand, void>;
	readonly getQuizSet: UseCaseLike<QuizSetIdCommand, QuizDetail>;
	readonly listQuizSets: UseCaseLike<ListSetsCommand, readonly QuizSummary[]>;
	readonly addQuestions: UseCaseLike<AddQuestionsCommand, AddedQuestions>;
	readonly updateQuestion: UseCaseLike<UpdateQuestionCommand, void>;
	readonly deleteQuestion: UseCaseLike<DeleteQuestionCommand, DeletedQuestion>;
}

export interface PracticeUseCases extends AuthoringUseCases {
	readonly browseFolder: UseCaseLike<BrowseFolderCommand, BrowseView>;
	readonly writeSummary: UseCaseLike<WriteSummaryCommand, SummaryWritten>;
	readonly searchPages: UseCaseLike<SearchPagesCommand, readonly PageMatch[]>;
	readonly getInsights: UseCaseLike<GetInsightsCommand, Insights>;
	readonly abandonQuizAttempt: UseCaseLike<
		AbandonAttemptCommand,
		AbandonedAttempt
	>;
	readonly createPage: UseCaseLike<CreatePageCommand, CreatedPage>;
	readonly renamePage: UseCaseLike<RenamePageCommand, void>;
	readonly setPageIcon: UseCaseLike<SetPageIconCommand, void>;
	readonly deletePage: UseCaseLike<DeletePageCommand, void>;
	readonly movePage: UseCaseLike<MovePageCommand, void>;
	readonly reorderPage: UseCaseLike<ReorderPageCommand, void>;
	readonly listRevisions: UseCaseLike<
		ListRevisionsCommand,
		readonly PageRevision[]
	>;
	readonly listPageTree: UseCaseLike<
		Record<string, never>,
		readonly PageTreeNode[]
	>;
	readonly listDueRepetitions: UseCaseLike<
		ListDueRepetitionsCommand,
		readonly DueSet[]
	>;
	readonly listLeeches: UseCaseLike<ListLeechesCommand, readonly LeechView[]>;
	readonly getAttemptDetail: UseCaseLike<
		GetAttemptDetailCommand,
		AttemptDetail
	>;
	readonly startQuizAttempt: UseCaseLike<
		StartQuizAttemptCommand,
		StartQuizAttemptResult
	>;
	readonly startPracticeSession: UseCaseLike<
		StartPracticeSessionCommand,
		StartPracticeSessionResult
	>;
	readonly getCurrentQuestion: UseCaseLike<
		GetCurrentQuestionCommand,
		CurrentQuestionView | undefined
	>;
	readonly answerQuestion: UseCaseLike<
		AnswerQuestionCommand,
		AnswerQuestionResult
	>;
	readonly finishQuizAttempt: UseCaseLike<
		FinishQuizAttemptCommand,
		FinishQuizAttemptResult
	>;
	readonly getQuizStatistics: UseCaseLike<
		GetQuizStatisticsCommand,
		QuizStatistics
	>;
	readonly resolveQuizSettings: UseCaseLike<
		ResolveQuizSettingsCommand,
		ResolvedQuizSettings
	>;
	readonly updateQuizSettings: UseCaseLike<
		UpdateQuizSettingsCommand,
		QuizSettings
	>;
}

export const APP_ROUTE_PREFIX = "app";

export interface AppUseCases extends PracticeUseCases {
	readonly issueApiToken: UseCaseLike<IssueOwnApiTokenCommand, IssuedApiToken>;
	readonly listApiTokens: UseCaseLike<
		ListOwnApiTokensCommand,
		readonly ApiToken[]
	>;
	readonly revokeApiToken: UseCaseLike<
		RevokeOwnApiTokenCommand,
		RevokedApiToken
	>;
}

export interface BotUseCases extends PracticeUseCases {
	readonly issueLoginLink: UseCaseLike<IssueLoginLinkCommand, LoginLink>;
	readonly issueApiToken: UseCaseLike<IssueApiTokenCommand, IssuedApiToken>;
	readonly listApiTokens: UseCaseLike<
		ListApiTokensCommand,
		readonly ApiToken[]
	>;
	readonly revokeApiToken: UseCaseLike<RevokeApiTokenCommand, RevokedApiToken>;
}

export const BOT_ROUTES = {
	loginLink: "auth/login-link",
	issueApiToken: "auth/tokens/issue",
	listApiTokens: "auth/tokens/list",
	revokeApiToken: "auth/tokens/revoke",
	createQuizSet: "sets/create",
	updateQuizSet: "sets/update",
	moveQuizSet: "sets/move",
	publishQuizSet: "sets/publish",
	archiveQuizSet: "sets/archive",
	getQuizSet: "sets/get",
	listQuizSets: "sets/list",
	addQuestions: "sets/questions/add",
	updateQuestion: "sets/questions/update",
	deleteQuestion: "sets/questions/delete",
	browse: "browse",
	writeSummary: "pages/summary",
	searchPages: "pages/search",
	insights: "insights",
	createPage: "pages/create",
	renamePage: "pages/rename",
	setPageIcon: "pages/icon",
	deletePage: "pages/delete",
	movePage: "pages/move",
	reorderPage: "pages/reorder",
	listRevisions: "pages/revisions",
	pageTree: "pages/tree",
	startAttempt: "attempts/start",
	practice: "attempts/practice",
	currentQuestion: "attempts/current",
	answer: "attempts/answer",
	finish: "attempts/finish",
	abandon: "attempts/abandon",
	statistics: "statistics",
	attemptDetail: "attempts/detail",
	dueRepetitions: "repetitions/due",
	leeches: "repetitions/leeches",
	resolveSettings: "settings/resolve",
	updateSettings: "settings/update",
} as const;

function createClient(options: RecallClientOptions) {
	const send = options.fetch ?? fetch;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const base = new URL(
		String(options.baseUrl).endsWith("/")
			? String(options.baseUrl)
			: `${String(options.baseUrl)}/`,
	);

	const post = async (route: string, command: unknown): Promise<unknown> => {
		const endpoint = new URL(route, base);

		let response: Response;

		try {
			response = await send(endpoint, {
				method: "POST",
				headers: { ...options.headers, "content-type": "application/json" },
				body: JSON.stringify(command ?? {}),
				signal: AbortSignal.timeout(timeoutMs),
			});
		} catch (error) {
			throw new BotApiUnreachableError(endpoint.href, error);
		}

		if (response.status === 204) {
			return undefined;
		}

		const body: unknown = await response.json().catch(() => undefined);

		if (!response.ok) {
			const failure = (body ?? {}) as Failure;

			throw new BotApiError(
				typeof failure.error === "string" ? failure.error : "UnknownError",
				typeof failure.message === "string"
					? failure.message
					: `the recall api answered ${response.status}`,
				response.status,
				detailsOf(failure.details),
			);
		}

		return body;
	};

	const operation = <
		CommandSchema extends z.ZodType,
		ResultSchema extends z.ZodType,
	>(
		route: string,
		commandSchema: CommandSchema,
		resultSchema: ResultSchema,
	) => ({
		async execute(
			command: z.input<CommandSchema>,
		): Promise<z.output<ResultSchema>> {
			const body = await post(route, commandSchema.parse(command));
			const parsed = resultSchema.safeParse(body);

			if (!parsed.success) {
				throw new BotApiContractError(route, parsed.error.message);
			}

			return parsed.data;
		},
	});

	const optionalOperation = <
		CommandSchema extends z.ZodType,
		ResultSchema extends z.ZodType,
	>(
		route: string,
		commandSchema: CommandSchema,
		resultSchema: ResultSchema,
	) => ({
		async execute(
			command: z.input<CommandSchema>,
		): Promise<z.output<ResultSchema> | undefined> {
			const body = await post(route, commandSchema.parse(command));

			if (body === undefined || body === null) {
				return undefined;
			}

			const parsed = resultSchema.safeParse(body);

			if (!parsed.success) {
				throw new BotApiContractError(route, parsed.error.message);
			}

			return parsed.data;
		},
	});

	const practice: PracticeUseCases = {
		createQuizSet: operation(
			BOT_ROUTES.createQuizSet,
			createSetCommandSchema,
			createdSetSchema,
		),
		updateQuizSet: operation(
			BOT_ROUTES.updateQuizSet,
			updateSetCommandSchema,
			z.void(),
		),
		moveQuizSet: operation(
			BOT_ROUTES.moveQuizSet,
			moveSetCommandSchema,
			z.void(),
		),
		publishQuizSet: operation(
			BOT_ROUTES.publishQuizSet,
			quizSetIdCommandSchema,
			z.void(),
		),
		archiveQuizSet: operation(
			BOT_ROUTES.archiveQuizSet,
			quizSetIdCommandSchema,
			z.void(),
		),
		getQuizSet: operation(
			BOT_ROUTES.getQuizSet,
			quizSetIdCommandSchema,
			quizDetailSchema,
		),
		listQuizSets: operation(
			BOT_ROUTES.listQuizSets,
			listSetsCommandSchema,
			quizSummarySchema.array().readonly(),
		),
		addQuestions: operation(
			BOT_ROUTES.addQuestions,
			addQuestionsCommandSchema,
			addedQuestionsSchema,
		),
		updateQuestion: operation(
			BOT_ROUTES.updateQuestion,
			updateQuestionCommandSchema,
			z.void(),
		),
		deleteQuestion: operation(
			BOT_ROUTES.deleteQuestion,
			deleteQuestionCommandSchema,
			deletedQuestionSchema,
		),
		browseFolder: operation(
			BOT_ROUTES.browse,
			browseCommandSchema,
			browseViewSchema,
		),
		writeSummary: operation(
			BOT_ROUTES.writeSummary,
			writeSummaryCommandSchema,
			summaryWrittenSchema,
		),
		searchPages: operation(
			BOT_ROUTES.searchPages,
			searchPagesCommandSchema,
			pageMatchSchema.array().readonly(),
		),
		abandonQuizAttempt: operation(
			BOT_ROUTES.abandon,
			abandonAttemptCommandSchema,
			abandonedAttemptSchema,
		),
		getInsights: operation(
			BOT_ROUTES.insights,
			insightsCommandSchema,
			insightsSchema,
		),
		createPage: operation(
			BOT_ROUTES.createPage,
			createPageCommandSchema,
			createdPageSchema,
		),
		renamePage: operation(
			BOT_ROUTES.renamePage,
			renamePageCommandSchema,
			z.void(),
		),
		setPageIcon: operation(
			BOT_ROUTES.setPageIcon,
			setPageIconCommandSchema,
			z.void(),
		),
		deletePage: operation(
			BOT_ROUTES.deletePage,
			deletePageCommandSchema,
			z.void(),
		),
		movePage: operation(BOT_ROUTES.movePage, movePageCommandSchema, z.void()),
		reorderPage: operation(
			BOT_ROUTES.reorderPage,
			reorderPageCommandSchema,
			z.void(),
		),
		listRevisions: operation(
			BOT_ROUTES.listRevisions,
			listRevisionsCommandSchema,
			pageRevisionSchema.array().readonly(),
		),
		listPageTree: operation(
			BOT_ROUTES.pageTree,
			z.object({}),
			pageTreeNodeSchema.array().readonly(),
		),
		listDueRepetitions: operation(
			BOT_ROUTES.dueRepetitions,
			dueRepetitionsCommandSchema,
			dueSetSchema.array().readonly(),
		),
		listLeeches: operation(
			BOT_ROUTES.leeches,
			leechesCommandSchema,
			leechSchema.array().readonly(),
		),
		getAttemptDetail: operation(
			BOT_ROUTES.attemptDetail,
			attemptDetailCommandSchema,
			attemptDetailSchema,
		),
		startQuizAttempt: operation(
			BOT_ROUTES.startAttempt,
			startAttemptCommandSchema,
			startAttemptResultSchema,
		),
		startPracticeSession: operation(
			BOT_ROUTES.practice,
			practiceCommandSchema,
			practiceResultSchema,
		),
		getCurrentQuestion: optionalOperation(
			BOT_ROUTES.currentQuestion,
			currentQuestionCommandSchema,
			currentQuestionSchema,
		),
		answerQuestion: operation(
			BOT_ROUTES.answer,
			answerCommandSchema,
			answerResultSchema,
		),
		finishQuizAttempt: operation(
			BOT_ROUTES.finish,
			finishCommandSchema,
			finishResultSchema,
		),
		getQuizStatistics: operation(
			BOT_ROUTES.statistics,
			statisticsCommandSchema,
			quizStatisticsSchema,
		),
		resolveQuizSettings: operation(
			BOT_ROUTES.resolveSettings,
			resolveSettingsCommandSchema,
			resolvedSettingsSchema,
		),
		updateQuizSettings: operation(
			BOT_ROUTES.updateSettings,
			updateSettingsCommandSchema,
			quizSettingsSchema,
		),
	};

	return {
		practice,
		ownCredentials: {
			issueApiToken: operation(
				BOT_ROUTES.issueApiToken,
				issueOwnApiTokenCommandSchema,
				issuedApiTokenSchema,
			),
			listApiTokens: operation(
				BOT_ROUTES.listApiTokens,
				listOwnApiTokensCommandSchema,
				apiTokenSchema.array().readonly(),
			),
			revokeApiToken: operation(
				BOT_ROUTES.revokeApiToken,
				revokeOwnApiTokenCommandSchema,
				revokedApiTokenSchema,
			),
		},
		credentials: {
			issueLoginLink: operation(
				BOT_ROUTES.loginLink,
				loginLinkCommandSchema,
				loginLinkSchema,
			),
			issueApiToken: operation(
				BOT_ROUTES.issueApiToken,
				issueApiTokenCommandSchema,
				issuedApiTokenSchema,
			),
			listApiTokens: operation(
				BOT_ROUTES.listApiTokens,
				listApiTokensCommandSchema,
				apiTokenSchema.array().readonly(),
			),
			revokeApiToken: operation(
				BOT_ROUTES.revokeApiToken,
				revokeApiTokenCommandSchema,
				revokedApiTokenSchema,
			),
		},
	};
}

export function createBotClient(options: BotApiOptions): BotUseCases {
	const client = createClient({
		...options,
		headers: { authorization: `Bearer ${options.token}` },
	});

	return { ...client.practice, ...client.credentials };
}

export function createAppClient(options: AppApiOptions): AppUseCases {
	const client = createClient({
		...options,
		baseUrl: new URL(`${APP_ROUTE_PREFIX}/`, `${String(options.baseUrl)}/`),
		headers: options.cookie === undefined ? {} : { cookie: options.cookie },
	});

	return { ...client.practice, ...client.ownCredentials };
}
