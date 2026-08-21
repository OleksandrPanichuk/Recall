export interface FolderView {
	readonly id: string;
	readonly name: string;
	readonly parentId: string | null;
	readonly depth: number;
	readonly setCount: number;
	readonly unpublishedCount: number;
}

export interface SetSummary {
	readonly id: string;
	readonly title: string;
	readonly status: string;
	readonly questionCount: number;
}

export interface RepetitionSettings {
	readonly intervalsDays: readonly number[];
	readonly maxIntervalDays: number;
	readonly maxRepetitions: number;
}

export interface QuizSettings {
	readonly repetition: RepetitionSettings;
	readonly shuffleOptions: boolean;
	readonly shuffleQuestions: boolean;
	readonly examMode: boolean;
}

export interface SettingsView {
	readonly settings: QuizSettings;
	readonly source: string;
}

export interface Overview {
	readonly sets: readonly SetSummary[];
	readonly folders: readonly FolderView[];
	readonly settings: QuizSettings;
	readonly settingsSource: string;
}

export interface OptionView {
	readonly text: string;
	readonly isCorrect: boolean;
	readonly matchKey?: string;
}

export interface QuestionView {
	readonly id: string;
	readonly type: string;
	readonly prompt: string;
	readonly difficulty: string;
	readonly topic?: string;
	readonly hint?: string;
	readonly explanation?: string;
	readonly vocabularyItemId?: string;
	readonly options: readonly OptionView[];
}

export interface SetView {
	readonly id: string;
	readonly title: string;
	readonly language: string;
	readonly description?: string;
	readonly source?: string;
	readonly sourceChapters?: string;
	readonly tags: readonly string[];
	readonly status: string;
	readonly folderId: string | null;
	readonly questions: readonly QuestionView[];
}

export interface VocabularyView {
	readonly itemId: string;
	readonly terms: readonly string[];
	readonly translations: readonly string[];
	readonly transcription?: string;
	readonly example?: string;
	readonly topic?: string;
	readonly questionIds: readonly string[];
}

export interface Score {
	readonly correct: number;
	readonly total: number;
	readonly percentage: number;
}

export interface AttemptSummary {
	readonly attemptId: string;
	readonly completedAt: string;
	readonly score: Score;
}

export interface TopicAccuracy {
	readonly topic: string;
	readonly answered: number;
	readonly correct: number;
}

export interface StatisticsView {
	readonly title: string;
	readonly attempts: readonly AttemptSummary[];
	readonly setAccuracy: Score;
	readonly topics: readonly TopicAccuracy[];
	readonly incorrectQuestionIds: readonly string[];
}

export interface RepetitionsView {
	readonly due: unknown;
	readonly leeches: unknown;
}

export class ApiError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

async function request<TResult>(
	path: string,
	init: RequestInit = {},
): Promise<TResult> {
	const response = await fetch(path, {
		...init,
		headers: {
			"content-type": "application/json",
			...(init.headers ?? {}),
		},
	});

	if (response.status === 204) {
		return undefined as TResult;
	}

	const body = (await response.json().catch(() => ({}))) as {
		error?: string;
	};

	if (!response.ok) {
		throw new ApiError(
			response.status,
			body.error ?? `Request failed with ${response.status}`,
		);
	}

	return body as TResult;
}

const send = <TResult>(
	method: string,
	path: string,
	body?: unknown,
): Promise<TResult> =>
	request<TResult>(path, {
		method,
		body: body === undefined ? undefined : JSON.stringify(body),
	});

export const api = {
	signIn: (passphrase: string) =>
		send<{ signedIn: boolean }>("POST", "/api/session", { passphrase }),
	signOut: () => send<void>("DELETE", "/api/session"),

	overview: () => request<Overview>("/api/overview"),

	createSet: (body: {
		title: string;
		language: string;
		description?: string;
		source?: string;
		sourceChapters?: string;
		folderId?: string;
	}) => send<{ quizSetId: string }>("POST", "/api/sets", body),
	set: (id: string) => request<SetView>(`/api/sets/${id}`),
	updateSet: (id: string, body: Record<string, unknown>) =>
		send<SetView>("PATCH", `/api/sets/${id}`, body),
	publishSet: (id: string) => send<SetView>("POST", `/api/sets/${id}/publish`),
	archiveSet: (id: string) => send<SetView>("POST", `/api/sets/${id}/archive`),
	moveSet: (id: string, folderId: string | undefined) =>
		send<SetView>("POST", `/api/sets/${id}/move`, { folderId }),

	addQuestions: (id: string, questions: readonly unknown[]) =>
		send<SetView>("POST", `/api/sets/${id}/questions`, { questions }),
	updateQuestion: (
		id: string,
		questionId: string,
		body: Record<string, unknown>,
	) => send<SetView>("PATCH", `/api/sets/${id}/questions/${questionId}`, body),
	deleteQuestion: (id: string, questionId: string) =>
		send<SetView>("DELETE", `/api/sets/${id}/questions/${questionId}`),

	vocabulary: (id: string) =>
		request<readonly VocabularyView[]>(`/api/sets/${id}/vocabulary`),
	addVocabulary: (id: string, body: Record<string, unknown>) =>
		send<SetView>("POST", `/api/sets/${id}/vocabulary`, body),
	updateVocabulary: (itemId: string, body: Record<string, unknown>) =>
		send<{ rebuiltQuestionCount: number }>(
			"PATCH",
			`/api/vocabulary/${itemId}`,
			body,
		),

	createFolder: (body: { name: string; parentId?: string }) =>
		send<{ folderId: string }>("POST", "/api/folders", body),
	updateFolder: (folderId: string, body: Record<string, unknown>) =>
		send<readonly FolderView[]>("PATCH", `/api/folders/${folderId}`, body),
	deleteFolder: (folderId: string) =>
		send<readonly FolderView[]>("DELETE", `/api/folders/${folderId}`),

	settings: (setId?: string) =>
		request<SettingsView>(
			setId === undefined ? "/api/settings" : `/api/settings?setId=${setId}`,
		),
	saveSettings: (body: Record<string, unknown>) =>
		send<SettingsView>("PUT", "/api/settings", body),

	statistics: (id: string) =>
		request<StatisticsView>(`/api/sets/${id}/statistics`),
	repetitions: () => request<RepetitionsView>("/api/repetitions"),
};
