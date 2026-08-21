import type { Application } from "@/composition/create-application";
import { toFolderId } from "@/domain/folder/folder";
import { toQuizAttemptId } from "@/domain/quiz-attempt/quiz-attempt";
import type { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import { toQuestionId } from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import type { Logger } from "@/infrastructure/logging/logger.types";
import { matchesToken } from "../mcp/http/bearer";
import { clearSession, issueSession, readSession } from "./session";

export interface AdminApiDependencies {
	readonly application: Application;
	readonly logger: Logger;
	readonly passphrase: string;
	readonly telegramUserId: number;
	now(): Date;
}

type Handler = (request: Request) => Promise<Response> | Response;

const json = (body: unknown, status = 200): Response =>
	Response.json(body as never, { status });

const failed = (error: unknown): Response =>
	json(
		{ error: error instanceof Error ? error.message : "Something went wrong" },
		400,
	);

const paramOf = (request: Request, name: string): string =>
	String(
		(request as Request & { params?: Record<string, string> }).params?.[name] ??
			"",
	);

const bodyOf = async <TBody>(request: Request): Promise<TBody> =>
	(await request.json()) as TBody;

const trimmed = (value: unknown): string | undefined => {
	const text = typeof value === "string" ? value.trim() : "";

	return text.length === 0 ? undefined : text;
};

export function createAdminApi(dependencies: AdminApiDependencies) {
	const { application, logger, passphrase, telegramUserId, now } = dependencies;

	const guarded =
		(handler: Handler): Handler =>
		async (request) => {
			if (
				!readSession(
					request.headers.get("cookie") ?? undefined,
					passphrase,
					now(),
				)
			) {
				return json({ error: "Not signed in" }, 401);
			}

			try {
				return await handler(request);
			} catch (error) {
				return failed(error);
			}
		};

	const setOf = async (quizSetId: string) => {
		const quizSet = await application.getQuizSet.execute({
			quizSetId: toQuizSetId(quizSetId),
		});

		return {
			id: String(quizSet.id),
			title: quizSet.title,
			language: quizSet.language,
			description: quizSet.description,
			source: quizSet.source,
			sourceChapters: quizSet.sourceChapters,
			tags: [...quizSet.tags],
			status: quizSet.status,
			folderId:
				quizSet.folderId === undefined ? null : String(quizSet.folderId),
			questions: quizSet.questions.map((question) => ({
				id: String(question.id),
				type: question.type,
				prompt: question.prompt,
				difficulty: question.difficulty,
				topic: question.topic,
				hint: question.hint,
				explanation: question.explanation,
				vocabularyItemId: question.vocabularyItemId,
				options: question.options.map((option) => ({
					text: option.text,
					isCorrect: option.isCorrect,
					matchKey: option.matchKey,
				})),
			})),
		};
	};

	const foldersOf = async () =>
		(await application.listFolderTree.execute({})).map((folder) => ({
			id: String(folder.id),
			name: folder.name,
			parentId: folder.parentId === undefined ? null : String(folder.parentId),
			depth: folder.depth,
			setCount: folder.setCount,
			unpublishedCount: folder.unpublishedCount,
		}));

	const folderId = (value: unknown) =>
		trimmed(value) === undefined ? undefined : toFolderId(String(value));

	return {
		"/api/session": {
			POST: async (request: Request) => {
				const body = await bodyOf<{ passphrase?: string }>(request).catch(
					() => ({}) as { passphrase?: string },
				);

				if (!matchesToken(String(body.passphrase ?? ""), passphrase)) {
					logger.warn("refused an admin sign-in");

					return json({ error: "Wrong passphrase" }, 401);
				}

				return new Response(JSON.stringify({ signedIn: true }), {
					status: 200,
					headers: {
						"content-type": "application/json",
						"set-cookie": issueSession(passphrase, now()),
					},
				});
			},
			DELETE: () =>
				new Response(null, {
					status: 204,
					headers: { "set-cookie": clearSession() },
				}),
		},

		"/api/overview": {
			GET: guarded(async () => {
				const [sets, folders, settings] = await Promise.all([
					application.listQuizSets.execute({ includeUnpublished: true }),
					foldersOf(),
					application.resolveQuizSettings.execute({}),
				]);

				return json({
					sets: sets.map((set) => ({
						id: String(set.id),
						title: set.title,
						status: set.status,
						questionCount: set.questionCount,
					})),
					folders,
					settings: settings.settings,
					settingsSource: settings.source,
				});
			}),
		},

		"/api/sets": {
			POST: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);
				const created = await application.createQuizSet.execute({
					title: String(body.title ?? ""),
					language: String(body.language ?? "uk"),
					description: trimmed(body.description),
					source: trimmed(body.source),
					sourceChapters: trimmed(body.sourceChapters),
					folderId: folderId(body.folderId),
				});

				return json({ quizSetId: String(created.quizSetId) }, 201);
			}),
		},

		"/api/sets/:id": {
			GET: guarded(async (request) =>
				json(await setOf(paramOf(request, "id"))),
			),
			PATCH: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);

				await application.updateQuizSet.execute({
					quizSetId: toQuizSetId(paramOf(request, "id")),
					title: trimmed(body.title),
					language: trimmed(body.language),
					description: trimmed(body.description),
					source: trimmed(body.source),
					sourceChapters: trimmed(body.sourceChapters),
				});

				return json(await setOf(paramOf(request, "id")));
			}),
		},

		"/api/sets/:id/publish": {
			POST: guarded(async (request) => {
				await application.publishQuizSet.execute({
					quizSetId: toQuizSetId(paramOf(request, "id")),
				});

				return json(await setOf(paramOf(request, "id")));
			}),
		},

		"/api/sets/:id/archive": {
			POST: guarded(async (request) => {
				await application.archiveQuizSet.execute({
					quizSetId: toQuizSetId(paramOf(request, "id")),
				});

				return json(await setOf(paramOf(request, "id")));
			}),
		},

		"/api/sets/:id/move": {
			POST: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);

				await application.moveQuizSet.execute({
					quizSetId: toQuizSetId(paramOf(request, "id")),
					folderId: folderId(body.folderId),
				});

				return json(await setOf(paramOf(request, "id")));
			}),
		},

		"/api/sets/:id/questions": {
			POST: guarded(async (request) => {
				const body = await bodyOf<{
					questions?: readonly Record<string, unknown>[];
				}>(request);

				await application.addQuestions.execute({
					quizSetId: toQuizSetId(paramOf(request, "id")),
					questions: (body.questions ?? []).map((question) => ({
						type: question.type as QuestionType,
						prompt: String(question.prompt ?? ""),
						difficulty: question.difficulty as Difficulty,
						topic: trimmed(question.topic),
						hint: trimmed(question.hint),
						explanation: trimmed(question.explanation),
						options: (question.options ?? []) as never,
					})),
				});

				return json(await setOf(paramOf(request, "id")));
			}),
		},

		"/api/sets/:id/questions/:questionId": {
			PATCH: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);

				await application.updateQuestion.execute({
					quizSetId: toQuizSetId(paramOf(request, "id")),
					questionId: toQuestionId(paramOf(request, "questionId")),
					prompt: trimmed(body.prompt),
					difficulty: body.difficulty as Difficulty | undefined,
					topic: trimmed(body.topic),
					hint: trimmed(body.hint),
					explanation: trimmed(body.explanation),
					options: body.options as never,
				});

				return json(await setOf(paramOf(request, "id")));
			}),
			DELETE: guarded(async (request) => {
				await application.deleteQuestion.execute({
					quizSetId: toQuizSetId(paramOf(request, "id")),
					questionId: toQuestionId(paramOf(request, "questionId")),
				});

				return json(await setOf(paramOf(request, "id")));
			}),
		},

		"/api/sets/:id/vocabulary": {
			GET: guarded(async (request) =>
				json(
					await application.listVocabulary.execute({
						quizSetId: toQuizSetId(paramOf(request, "id")),
					}),
				),
			),
			POST: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);

				await application.addVocabulary.execute({
					quizSetId: toQuizSetId(paramOf(request, "id")),
					pairs: body.pairs as never,
					directions: body.directions as never,
					topic: trimmed(body.topic),
					difficulty: body.difficulty as Difficulty | undefined,
				});

				return json(await setOf(paramOf(request, "id")));
			}),
		},

		"/api/vocabulary/:itemId": {
			PATCH: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);

				return json(
					await application.updateVocabulary.execute({
						itemId: paramOf(request, "itemId") as never,
						term: body.term as never,
						translation: body.translation as never,
						transcription: trimmed(body.transcription),
						example: trimmed(body.example),
					}),
				);
			}),
		},

		"/api/folders": {
			POST: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);
				const created = await application.createFolder.execute({
					name: String(body.name ?? ""),
					parentId: folderId(body.parentId),
				});

				return json({ folderId: String(created.folderId) }, 201);
			}),
		},

		"/api/folders/:folderId": {
			PATCH: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);
				const id = toFolderId(paramOf(request, "folderId"));

				if (trimmed(body.name) !== undefined) {
					await application.renameFolder.execute({
						folderId: id,
						name: String(body.name),
					});
				}

				if (Object.hasOwn(body, "parentId")) {
					await application.moveFolder.execute({
						folderId: id,
						parentId: folderId(body.parentId),
					});
				}

				return json(await foldersOf());
			}),
			DELETE: guarded(async (request) => {
				await application.deleteFolder.execute({
					folderId: toFolderId(paramOf(request, "folderId")),
				});

				return json(await foldersOf());
			}),
		},

		"/api/settings": {
			GET: guarded(async (request) => {
				const setId = new URL(request.url).searchParams.get("setId");

				return json(
					await application.resolveQuizSettings.execute({
						quizSetId: setId === null ? undefined : toQuizSetId(setId),
					}),
				);
			}),
			PUT: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);
				const setId = trimmed(body.quizSetId);
				const quizSetId = setId === undefined ? undefined : toQuizSetId(setId);

				await application.updateQuizSettings.execute({
					quizSetId,
					repetition: body.repetition as never,
					shuffleOptions: body.shuffleOptions as boolean | undefined,
					shuffleQuestions: body.shuffleQuestions as boolean | undefined,
					examMode: body.examMode as boolean | undefined,
					inheritGlobal: body.inheritGlobal as boolean | undefined,
				});

				return json(
					await application.resolveQuizSettings.execute({ quizSetId }),
				);
			}),
		},

		"/api/sets/:id/statistics": {
			GET: guarded(async (request) =>
				json(
					await application.getQuizStatistics.execute({
						telegramUserId,
						quizSetId: toQuizSetId(paramOf(request, "id")),
					}),
				),
			),
		},

		"/api/attempts/:attemptId": {
			GET: guarded(async (request) =>
				json(
					await application.getAttemptDetail.execute({
						telegramUserId,
						attemptId: toQuizAttemptId(paramOf(request, "attemptId")),
					}),
				),
			),
		},

		"/api/repetitions": {
			GET: guarded(async () => {
				const [due, leeches] = await Promise.all([
					application.listDueRepetitions.execute({ telegramUserId }),
					application.listLeeches.execute({ telegramUserId }),
				]);

				return json({ due, leeches });
			}),
		},
	};
}
