import type { Logger } from "@recall/kit";
import type { UseCases } from "@/composition/create-application";
import { toFolderId } from "@/domain/folder/folder";
import type { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import { toQuestionId } from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { matchesToken } from "../mcp/http/bearer";
import { listPage, listQueryOf } from "./query";
import {
	FOLDER_SHAPE,
	folderRecordOf,
	QUESTION_SHAPE,
	questionRecordOf,
	SET_SHAPE,
	type SettingsRecord,
	setRecordOf,
	VOCABULARY_SHAPE,
	vocabularyRecordOf,
} from "./records";
import { clearSession, issueSession, readSession } from "./session";

export interface AdminApiDependencies {
	readonly application: UseCases;
	readonly logger: Logger;
	readonly passphrase: string;
	now(): Date;
}

type Handler = (request: Request) => Promise<Response> | Response;

const json = (body: unknown, status = 200): Response =>
	Response.json(body as never, { status });

const page = (rows: readonly unknown[], total: number): Response =>
	Response.json(rows as never, {
		headers: { "x-total-count": String(total) },
	});

const failed = (error: unknown): Response => {
	const message =
		error instanceof Error ? error.message : "Something went wrong";

	return json({ message, error: message }, 400);
};

const paramOf = (request: Request, name: string): string =>
	String(
		(request as Request & { params?: Record<string, string> }).params?.[name] ??
			"",
	);

const bodyOf = async <TBody>(request: Request): Promise<TBody> =>
	(await request.json()) as TBody;

const given = (
	body: Record<string, unknown>,
	key: string,
): string | undefined =>
	Object.hasOwn(body, key) ? String(body[key] ?? "") : undefined;

const trimmed = (value: unknown): string | undefined => {
	const text = typeof value === "string" ? value.trim() : "";

	return text.length === 0 ? undefined : text;
};

const words = (value: unknown): readonly string[] | undefined => {
	if (Array.isArray(value)) {
		const parts = value
			.map((entry) => String(entry).trim())
			.filter((entry) => entry.length > 0);

		return parts.length === 0 ? undefined : parts;
	}

	const single = trimmed(value);

	return single === undefined
		? undefined
		: single
				.split(",")
				.map((part) => part.trim())
				.filter((part) => part.length > 0);
};

const numbers = (value: unknown): readonly number[] | undefined => {
	if (Array.isArray(value)) {
		return value.map(Number).filter((entry) => Number.isFinite(entry));
	}

	const single = trimmed(value);

	return single === undefined
		? undefined
		: single
				.split(",")
				.map((part) => Number(part.trim()))
				.filter((entry) => Number.isFinite(entry));
};

const optionsOf = (value: unknown) =>
	(Array.isArray(value) ? value : []).map((entry) => {
		const option = entry as Record<string, unknown>;
		const matchKey = trimmed(option.matchKey);

		return {
			text: String(option.text ?? ""),
			isCorrect: option.isCorrect === true,
			...(matchKey === undefined ? {} : { matchKey }),
		};
	});

export function createAdminApi(dependencies: AdminApiDependencies) {
	const { application, logger, passphrase, now } = dependencies;

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
				return json({ message: "Not signed in" }, 401);
			}

			try {
				return await handler(request);
			} catch (error) {
				return failed(error);
			}
		};

	const setRecords = async () => {
		const summaries = await application.listQuizSets.execute({
			includeUnpublished: true,
		});
		const records = [];

		for (const summary of summaries) {
			records.push(
				setRecordOf(
					await application.getQuizSet.execute({ quizSetId: summary.id }),
				),
			);
		}

		return records;
	};

	const setRecord = async (quizSetId: string) =>
		setRecordOf(
			await application.getQuizSet.execute({
				quizSetId: toQuizSetId(quizSetId),
			}),
		);

	const questionRecords = async (quizSetId?: string) =>
		(
			await application.listQuestions.execute(
				quizSetId === undefined ? {} : { quizSetId: toQuizSetId(quizSetId) },
			)
		).map(questionRecordOf);

	const folderRecords = async () =>
		(await application.listFolderTree.execute({})).map(folderRecordOf);

	const vocabularyRecords = async (quizSetId?: string) => {
		const ids =
			quizSetId === undefined
				? (
						await application.listQuizSets.execute({ includeUnpublished: true })
					).map((summary) => String(summary.id))
				: [quizSetId];
		const records = [];

		for (const id of ids) {
			const items = await application.listVocabulary.execute({
				quizSetId: toQuizSetId(id),
			});

			for (const item of items) {
				records.push(vocabularyRecordOf(item, id));
			}
		}

		return records;
	};

	const settingsRecord = async (id: string): Promise<SettingsRecord> => {
		const quizSetId = id === "global" ? undefined : toQuizSetId(id);
		const resolved = await application.resolveQuizSettings.execute(
			quizSetId === undefined ? {} : { quizSetId },
		);

		return {
			id,
			quizSetId: id === "global" ? null : id,
			source: resolved.source,
			shuffleOptions: resolved.settings.shuffleOptions,
			shuffleQuestions: resolved.settings.shuffleQuestions,
			examMode: resolved.settings.examMode,
			intervalsDays: [...resolved.settings.repetition.intervalsDays],
			maxIntervalDays: resolved.settings.repetition.maxIntervalDays,
			maxRepetitions: resolved.settings.repetition.maxRepetitions,
		};
	};

	const questionOf = async (questionId: string) => {
		const rows = await application.listQuestions.execute({});
		const found = rows.find((row) => String(row.question.id) === questionId);

		if (found === undefined) {
			throw new Error(`Question ${questionId} does not exist`);
		}

		return found;
	};

	const folderIdOf = (value: unknown) =>
		trimmed(value) === undefined ? undefined : toFolderId(String(value));

	return {
		"/api/session": {
			POST: async (request: Request) => {
				const body = await bodyOf<{ passphrase?: string }>(request).catch(
					() => ({}) as { passphrase?: string },
				);

				if (!matchesToken(String(body.passphrase ?? ""), passphrase)) {
					logger.warn("refused an admin sign-in");

					return json({ message: "Wrong passphrase" }, 401);
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
			GET: guarded(() => json({ signedIn: true })),
		},

		"/api/sets": {
			GET: guarded(async (request) => {
				const query = listQueryOf(new URL(request.url));
				const found = listPage(await setRecords(), query, SET_SHAPE);

				return page(found.rows, found.total);
			}),
			POST: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);
				const created = await application.createQuizSet.execute({
					title: String(body.title ?? ""),
					language: String(body.language ?? "uk"),
					description: trimmed(body.description),
					source: trimmed(body.source),
					sourceChapters: trimmed(body.sourceChapters),
					folderId: folderIdOf(body.folderId),
				});

				return json(await setRecord(String(created.quizSetId)), 201);
			}),
		},

		"/api/sets/:id": {
			GET: guarded(async (request) =>
				json(await setRecord(paramOf(request, "id"))),
			),
			PUT: guarded(async (request) => {
				const id = paramOf(request, "id");
				const quizSetId = toQuizSetId(id);
				const body = await bodyOf<Record<string, unknown>>(request);
				const current = await setRecord(id);

				const metadataKeys = [
					"title",
					"language",
					"description",
					"source",
					"sourceChapters",
					"tags",
				];

				if (metadataKeys.some((key) => Object.hasOwn(body, key))) {
					await application.updateQuizSet.execute({
						quizSetId,
						title: given(body, "title"),
						language: given(body, "language"),
						description: given(body, "description"),
						source: given(body, "source"),
						sourceChapters: given(body, "sourceChapters"),
						tags: Object.hasOwn(body, "tags")
							? (words(body.tags) ?? [])
							: undefined,
					});
				}

				const folderId = folderIdOf(body.folderId);

				if (
					Object.hasOwn(body, "folderId") &&
					(folderId === undefined ? null : String(folderId)) !==
						current.folderId
				) {
					await application.moveQuizSet.execute({ quizSetId, folderId });
				}

				const status = trimmed(body.status);

				if (status !== undefined && status !== current.status) {
					if (status === "published") {
						await application.publishQuizSet.execute({ quizSetId });
					} else if (status === "archived") {
						await application.archiveQuizSet.execute({ quizSetId });
					} else {
						throw new Error(
							`A ${current.status} quiz set cannot go back to ${status}`,
						);
					}
				}

				return json(await setRecord(id));
			}),
		},

		"/api/questions": {
			GET: guarded(async (request) => {
				const url = new URL(request.url);
				const query = listQueryOf(url);
				const scope = url.searchParams.get("quizSetId") ?? undefined;
				const found = listPage(
					await questionRecords(scope),
					query,
					QUESTION_SHAPE,
				);

				return page(found.rows, found.total);
			}),
			POST: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);
				const quizSetId = String(body.quizSetId ?? "");

				await application.addQuestions.execute({
					quizSetId: toQuizSetId(quizSetId),
					questions: [
						{
							type: body.type as QuestionType,
							prompt: String(body.prompt ?? ""),
							difficulty: (body.difficulty ?? "medium") as Difficulty,
							topic: trimmed(body.topic),
							hint: trimmed(body.hint),
							explanation: trimmed(body.explanation),
							options: optionsOf(body.options) as never,
						},
					],
				});

				const records = await questionRecords(quizSetId);

				return json(records[records.length - 1], 201);
			}),
		},

		"/api/questions/:id": {
			GET: guarded(async (request) =>
				json(questionRecordOf(await questionOf(paramOf(request, "id")))),
			),
			PUT: guarded(async (request) => {
				const questionId = paramOf(request, "id");
				const found = await questionOf(questionId);
				const body = await bodyOf<Record<string, unknown>>(request);

				await application.updateQuestion.execute({
					quizSetId: found.quizSetId,
					questionId: toQuestionId(questionId),
					prompt: given(body, "prompt"),
					difficulty: body.difficulty as Difficulty | undefined,
					topic: given(body, "topic"),
					hint: given(body, "hint"),
					explanation: given(body, "explanation"),
					options: Object.hasOwn(body, "options")
						? (optionsOf(body.options) as never)
						: undefined,
				});

				return json(questionRecordOf(await questionOf(questionId)));
			}),
			DELETE: guarded(async (request) => {
				const questionId = paramOf(request, "id");
				const found = await questionOf(questionId);
				const record = questionRecordOf(found);

				await application.deleteQuestion.execute({
					quizSetId: found.quizSetId,
					questionId: toQuestionId(questionId),
				});

				return json(record);
			}),
		},

		"/api/folders": {
			GET: guarded(async (request) => {
				const query = listQueryOf(new URL(request.url));
				const found = listPage(await folderRecords(), query, FOLDER_SHAPE);

				return page(found.rows, found.total);
			}),
			POST: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);
				const created = await application.createFolder.execute({
					name: String(body.name ?? ""),
					parentId: folderIdOf(body.parentId),
				});
				const records = await folderRecords();

				return json(
					records.find((entry) => entry.id === String(created.folderId)),
					201,
				);
			}),
		},

		"/api/folders/:id": {
			GET: guarded(async (request) => {
				const id = paramOf(request, "id");
				const record = (await folderRecords()).find((entry) => entry.id === id);

				return record === undefined
					? json({ message: `Folder ${id} does not exist` }, 404)
					: json(record);
			}),
			PUT: guarded(async (request) => {
				const id = paramOf(request, "id");
				const folderId = toFolderId(id);
				const body = await bodyOf<Record<string, unknown>>(request);
				const current = (await folderRecords()).find(
					(entry) => entry.id === id,
				);
				const name = trimmed(body.name);

				if (name !== undefined && name !== current?.name) {
					await application.renameFolder.execute({ folderId, name });
				}

				const parentId = folderIdOf(body.parentId);

				if (
					Object.hasOwn(body, "parentId") &&
					(parentId === undefined ? null : String(parentId)) !==
						(current?.parentId ?? null)
				) {
					await application.moveFolder.execute({ folderId, parentId });
				}

				return json((await folderRecords()).find((entry) => entry.id === id));
			}),
			DELETE: guarded(async (request) => {
				const id = paramOf(request, "id");
				const record = (await folderRecords()).find((entry) => entry.id === id);

				await application.deleteFolder.execute({ folderId: toFolderId(id) });

				return json(record ?? { id });
			}),
		},

		"/api/vocabulary": {
			GET: guarded(async (request) => {
				const url = new URL(request.url);
				const query = listQueryOf(url);
				const scope = url.searchParams.get("quizSetId") ?? undefined;
				const found = listPage(
					await vocabularyRecords(scope),
					query,
					VOCABULARY_SHAPE,
				);

				return page(found.rows, found.total);
			}),
			POST: guarded(async (request) => {
				const body = await bodyOf<Record<string, unknown>>(request);
				const quizSetId = String(body.quizSetId ?? "");
				const created = await application.addVocabulary.execute({
					quizSetId: toQuizSetId(quizSetId),
					pairs: [
						{
							term: words(body.terms) ?? [],
							translation: words(body.translations) ?? [],
							transcription: trimmed(body.transcription),
							example: trimmed(body.example),
						},
					],
					directions: (words(body.directions) ?? [
						"term_to_translation",
					]) as never,
					topic: trimmed(body.topic),
					difficulty: body.difficulty as Difficulty | undefined,
				});
				const records = await vocabularyRecords(quizSetId);

				return json(
					records.find((entry) => entry.id === String(created.itemIds[0])),
					201,
				);
			}),
		},

		"/api/vocabulary/:id": {
			GET: guarded(async (request) => {
				const id = paramOf(request, "id");
				const record = (await vocabularyRecords()).find(
					(entry) => entry.id === id,
				);

				return record === undefined
					? json({ message: `Vocabulary item ${id} does not exist` }, 404)
					: json(record);
			}),
			PUT: guarded(async (request) => {
				const id = paramOf(request, "id");
				const body = await bodyOf<Record<string, unknown>>(request);

				await application.updateVocabulary.execute({
					itemId: id as never,
					term: words(body.terms) as never,
					translation: words(body.translations) as never,
					transcription: given(body, "transcription"),
					example: given(body, "example"),
				});

				return json(
					(await vocabularyRecords()).find((entry) => entry.id === id),
				);
			}),
		},

		"/api/settings/:id": {
			GET: guarded(async (request) =>
				json(await settingsRecord(paramOf(request, "id"))),
			),
			PUT: guarded(async (request) => {
				const id = paramOf(request, "id");
				const body = await bodyOf<Record<string, unknown>>(request);
				const quizSetId = id === "global" ? undefined : toQuizSetId(id);
				const intervals = numbers(body.intervalsDays);
				const repetition =
					intervals === undefined || intervals.length === 0
						? undefined
						: {
								intervalsDays: intervals,
								maxIntervalDays: Number(body.maxIntervalDays),
								maxRepetitions: Number(body.maxRepetitions),
							};

				await application.updateQuizSettings.execute({
					quizSetId,
					repetition: repetition as never,
					shuffleOptions: body.shuffleOptions as boolean | undefined,
					shuffleQuestions: body.shuffleQuestions as boolean | undefined,
					examMode: body.examMode as boolean | undefined,
					inheritGlobal: body.inheritGlobal as boolean | undefined,
				});

				return json(await settingsRecord(id));
			}),
		},

		"/api/statistics/:id": {
			GET: guarded(async (request) =>
				json(
					await application.getQuizStatistics.execute({
						quizSetId: toQuizSetId(paramOf(request, "id")),
					}),
				),
			),
		},

		"/api/repetitions": {
			GET: guarded(async () => {
				const [due, leeches] = await Promise.all([
					application.listDueRepetitions.execute({}),
					application.listLeeches.execute({}),
				]);

				return json({ due, leeches });
			}),
		},
	};
}
