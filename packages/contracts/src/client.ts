import type { z } from "zod";
import {
	type AnswerQuestionCommand,
	type AnswerQuestionResult,
	type ApiToken,
	type AttemptDetail,
	answerCommandSchema,
	answerResultSchema,
	apiTokenSchema,
	attemptDetailCommandSchema,
	attemptDetailSchema,
	type BrowseFolderCommand,
	type BrowseView,
	browseCommandSchema,
	browseViewSchema,
	type CurrentQuestionView,
	currentQuestionCommandSchema,
	currentQuestionSchema,
	type DueSet,
	dueRepetitionsCommandSchema,
	dueSetSchema,
	type FinishQuizAttemptCommand,
	type FinishQuizAttemptResult,
	finishCommandSchema,
	finishResultSchema,
	type GetAttemptDetailCommand,
	type GetCurrentQuestionCommand,
	type GetQuizStatisticsCommand,
	type IssueApiTokenCommand,
	type IssuedApiToken,
	type IssueLoginLinkCommand,
	issueApiTokenCommandSchema,
	issuedApiTokenSchema,
	type LeechView,
	type ListApiTokensCommand,
	type ListDueRepetitionsCommand,
	type ListLeechesCommand,
	type LoginLink,
	leechesCommandSchema,
	leechSchema,
	listApiTokensCommandSchema,
	loginLinkCommandSchema,
	loginLinkSchema,
	practiceCommandSchema,
	practiceResultSchema,
	type QuizSettings,
	type QuizStatistics,
	quizSettingsSchema,
	quizStatisticsSchema,
	type ResolvedQuizSettings,
	type ResolveQuizSettingsCommand,
	type RevokeApiTokenCommand,
	type RevokedApiToken,
	resolvedSettingsSchema,
	resolveSettingsCommandSchema,
	revokeApiTokenCommandSchema,
	revokedApiTokenSchema,
	type StartPracticeSessionCommand,
	type StartPracticeSessionResult,
	type StartQuizAttemptCommand,
	type StartQuizAttemptResult,
	type SummaryWritten,
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
	AttemptNotActive: "AttemptNotActiveError",
	QuestionNotInAttempt: "QuestionNotInAttemptError",
	QuizSetNotPublished: "QuizSetNotPublishedError",
	QuizSetNotFound: "QuizSetNotFoundError",
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

export interface PracticeUseCases {
	readonly browseFolder: UseCaseLike<BrowseFolderCommand, BrowseView>;
	readonly writeSummary: UseCaseLike<WriteSummaryCommand, SummaryWritten>;
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
	browse: "browse",
	writeSummary: "pages/summary",
	startAttempt: "attempts/start",
	practice: "attempts/practice",
	currentQuestion: "attempts/current",
	answer: "attempts/answer",
	finish: "attempts/finish",
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

export function createAppClient(options: AppApiOptions): PracticeUseCases {
	return createClient({
		...options,
		baseUrl: new URL(`${APP_ROUTE_PREFIX}/`, `${String(options.baseUrl)}/`),
		headers: options.cookie === undefined ? {} : { cookie: options.cookie },
	}).practice;
}
