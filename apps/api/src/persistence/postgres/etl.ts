import { Database } from "bun:sqlite";
import type postgres from "postgres";
import type { OwnerId } from "@/application/ports/owner";

export interface EtlReport {
	readonly inserted: Readonly<Record<string, number>>;
	readonly notes: readonly string[];
}

const NAMESPACE = "recall-v2";

export function uuidFor(kind: string, legacyId: string): string {
	const digest = new Bun.CryptoHasher("sha256")
		.update(`${NAMESPACE}:${kind}:${legacyId}`)
		.digest();
	const bytes = new Uint8Array(digest).slice(0, 16);

	bytes[6] = ((bytes[6] as number) & 0x0f) | 0x80;
	bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;

	const hex = Array.from(bytes, (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");

	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20, 32),
	].join("-");
}

const slugify = (value: string): string => {
	const base = value
		.normalize("NFKD")
		.toLocaleLowerCase()
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "");

	return base.length === 0 ? "page" : base;
};

const jsonArray = (raw: string | null): readonly unknown[] => {
	if (raw === null) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);

		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

const strings = (raw: string | null): readonly string[] =>
	jsonArray(raw).map((entry) => String(entry));

const numbers = (raw: string | null): readonly number[] =>
	jsonArray(raw)
		.map((entry) => Number(entry))
		.filter((entry) => Number.isSafeInteger(entry));

// Timestamps travel as ISO strings, never Date objects: postgres.js picks an
// encoder from the first execution of a query string, and a Date arriving where
// a nullable column was null on the first row hits the text encoder and throws.
const date = (raw: string | null): string | null => {
	if (raw === null) {
		return null;
	}

	const parsed = new Date(raw);

	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const normalise = (value: string): string =>
	value.trim().toLocaleLowerCase().replace(/\s+/gu, " ");

interface FolderRow {
	id: string;
	name: string;
	parent_id: string | null;
	created_at: string;
	updated_at: string;
}

interface QuizRow {
	id: string;
	folder_id: string | null;
	title: string;
	description: string | null;
	language: string;
	source: string | null;
	source_chapters: string | null;
	tags: string;
	status: string;
	created_at: string;
	updated_at: string;
	published_at: string | null;
	archived_at: string | null;
}

interface PairRow {
	id: string;
	quiz_set_id: string;
	terms: string;
	translations: string;
	transcription: string | null;
	example: string | null;
	topic: string | null;
	created_at: string;
	updated_at: string;
}

interface QuestionRow {
	id: string;
	quiz_set_id: string;
	type: string;
	prompt: string;
	explanation: string | null;
	source_reference: string | null;
	topic: string | null;
	difficulty: string;
	hint: string | null;
	position: number;
	fingerprint: string;
	vocabulary_item_id: string | null;
}

interface OptionRow {
	id: string;
	question_id: string;
	text: string;
	is_correct: number;
	match_key: string | null;
	position: number;
}

interface AttemptRow {
	id: string;
	quiz_set_id: string;
	telegram_user_id: number;
	mode: string;
	status: string;
	question_ids: string;
	started_at: string;
	updated_at: string;
	completed_at: string | null;
}

interface ResponseRow {
	attempt_id: string;
	question_id: string;
	selected_option_ids: string;
	is_correct: number;
	typed_answer: string | null;
	skipped: number | null;
	credit_earned: number | null;
	credit_possible: number | null;
	answered_at: string;
}

interface ScheduleRow {
	question_id: string;
	telegram_user_id: number;
	repetition_count: number;
	lapses: number;
	last_completed_at: string;
	due_at: string | null;
	created_at: string;
	updated_at: string;
}

interface SettingsRow {
	quiz_set_id: string;
	intervals_days: string;
	max_interval_days: number;
	max_repetitions: number;
	shuffle_options: number;
	shuffle_questions: number;
	exam_mode: number;
	updated_at: string;
}

interface DefaultsRow {
	intervals_days: string;
	max_interval_days: number;
	max_repetitions: number;
	shuffle_options: number;
	shuffle_questions: number;
	exam_mode: number;
	updated_at: string;
}

export async function migrateSqliteToPostgres(options: {
	readonly sqlitePath: string;
	readonly client: postgres.Sql;
	readonly owner: OwnerId;
}): Promise<EtlReport> {
	const { client, owner } = options;
	const source = new Database(options.sqlitePath, { readonly: true });
	const inserted: Record<string, number> = {};
	const notes: string[] = [];
	const count = (table: string, rows: number): void => {
		inserted[table] = (inserted[table] ?? 0) + rows;
	};

	try {
		const allFolders = source
			.query<FolderRow, []>("select * from folders order by name")
			.all();

		// A folder can only be written after its parent, and parent_id order does
		// not guarantee that beyond the first level.
		const folders: FolderRow[] = [];
		const placed = new Set<string>();
		let remaining = [...allFolders];

		while (remaining.length > 0) {
			const ready = remaining.filter(
				(folder) => folder.parent_id === null || placed.has(folder.parent_id),
			);

			if (ready.length === 0) {
				notes.push(
					`${remaining.length} folder(s) have an unreachable parent and were skipped`,
				);
				break;
			}

			for (const folder of ready) {
				folders.push(folder);
				placed.add(folder.id);
			}

			remaining = remaining.filter((folder) => !placed.has(folder.id));
		}

		const slugTaken = new Set<string>();
		const slugOf = (folder: FolderRow): string => {
			const base = slugify(folder.name);
			let candidate = base;
			let suffix = 1;

			while (slugTaken.has(`${folder.parent_id ?? "root"}/${candidate}`)) {
				suffix += 1;
				candidate = `${base}-${suffix}`;
			}

			slugTaken.add(`${folder.parent_id ?? "root"}/${candidate}`);

			return candidate;
		};

		for (const folder of folders) {
			await client`
				insert into pages (id, owner_id, legacy_id, parent_id, title, slug, created_at, updated_at)
				values (
					${uuidFor("page", folder.id)}::uuid,
					${owner}::text,
					${folder.id}::text,
					${folder.parent_id === null ? null : uuidFor("page", folder.parent_id)}::uuid,
					${folder.name}::text,
					${slugOf(folder)}::text,
					${date(folder.created_at)}::timestamptz,
					${date(folder.updated_at)}::timestamptz
				)
				on conflict (owner_id, legacy_id) do nothing
			`;
			count("pages", 1);
		}

		const quizzes = source.query<QuizRow, []>("select * from quiz_sets").all();

		for (const quiz of quizzes) {
			const id = quiz.id;

			await client`
				insert into quizzes (
					id, owner_id, legacy_id, page_id, title, description, language, source,
					source_chapters, tags, status, created_at, updated_at,
					published_at, archived_at
				) values (
					${uuidFor("quiz", id)}::uuid, ${owner}::text, ${id}::text,
					${quiz.folder_id === null ? null : uuidFor("page", quiz.folder_id)}::uuid,
					${quiz.title}::text, ${quiz.description}::text, ${quiz.language}::text, ${quiz.source}::text,
					${quiz.source_chapters}::text, ${strings(quiz.tags)}::text[], ${quiz.status}::text,
					${date(quiz.created_at)}::timestamptz, ${date(quiz.updated_at)}::timestamptz,
					${date(quiz.published_at)}::timestamptz, ${date(quiz.archived_at)}::timestamptz
				)
				on conflict (owner_id, legacy_id) do nothing
			`;
			count("quizzes", 1);
		}

		const pairs = source
			.query<PairRow, []>("select * from vocabulary_items")
			.all();
		const termsByPair = new Map<string, readonly string[]>();

		for (const pair of pairs) {
			const id = pair.id;
			const terms = strings(pair.terms);

			termsByPair.set(id, terms);

			await client`
				insert into term_pairs (
					id, owner_id, legacy_id, quiz_id, terms, translations, transcription,
					example, topic, created_at, updated_at
				) values (
					${uuidFor("term_pair", id)}::uuid, ${owner}::text, ${id}::text,
					${uuidFor("quiz", pair.quiz_set_id)}::uuid,
					${terms}::text[], ${strings(pair.translations)}::text[], ${pair.transcription}::text,
					${pair.example}::text, ${pair.topic}::text,
					${date(pair.created_at)}::timestamptz, ${date(pair.updated_at)}::timestamptz
				)
				on conflict (owner_id, legacy_id) do nothing
			`;
			count("term_pairs", 1);
		}

		const questions = source
			.query<QuestionRow, []>(
				"select * from questions order by quiz_set_id, position",
			)
			.all();

		for (const question of questions) {
			const id = question.id;

			await client`
				insert into questions (
					id, owner_id, legacy_id, quiz_id, type, prompt, explanation,
					source_reference, topic, difficulty, hint, position, fingerprint
				) values (
					${uuidFor("question", id)}::uuid, ${owner}::text, ${id}::text,
					${uuidFor("quiz", question.quiz_set_id)}::uuid,
					${question.type}::text, ${question.prompt}::text, ${question.explanation}::text,
					${question.source_reference}::text, ${question.topic}::text, ${question.difficulty}::text,
					${question.hint}::text, ${question.position}::int, ${question.fingerprint}::text
				)
				on conflict (owner_id, legacy_id) do nothing
			`;
			count("questions", 1);

			const pairId = question.vocabulary_item_id;

			if (pairId !== null && termsByPair.has(pairId)) {
				const terms = termsByPair.get(pairId) ?? [];
				const asksTerm = terms.some(
					(term) => normalise(term) === normalise(question.prompt),
				);

				await client`
					insert into question_sources (question_id, term_pair_id, direction)
					values (
						${uuidFor("question", id)}::uuid,
						${uuidFor("term_pair", pairId)}::uuid,
						${asksTerm ? "term_to_translation" : "translation_to_term"}::text
					)
					on conflict (question_id) do nothing
				`;
				count("question_sources", 1);
			} else if (pairId !== null) {
				notes.push(
					`question ${id} points at missing vocabulary item ${pairId}`,
				);
			}
		}

		const optionRows = source
			.query<OptionRow, []>(
				"select * from question_options order by question_id, position",
			)
			.all();

		for (const option of optionRows) {
			const id = option.id;

			await client`
				insert into question_options (
					id, legacy_id, question_id, text, is_correct, match_key, position
				) values (
					${uuidFor("option", id)}::uuid, ${id}::text,
					${uuidFor("question", option.question_id)}::uuid,
					${option.text}::text, ${option.is_correct === 1}::boolean,
					${option.match_key}::text, ${option.position}::int
				)
				on conflict (legacy_id) do nothing
			`;
			count("question_options", 1);
		}

		const knownQuestions = new Set(questions.map((row) => row.id as string));

		const attempts = source
			.query<AttemptRow, []>("select * from quiz_attempts")
			.all();

		for (const attempt of attempts) {
			const id = attempt.id;

			await client`
				insert into attempts (
					id, owner_id, legacy_id, quiz_id, telegram_user_id, mode, status,
					started_at, updated_at, completed_at
				) values (
					${uuidFor("attempt", id)}::uuid, ${owner}::text, ${id}::text,
					${uuidFor("quiz", attempt.quiz_set_id)}::uuid,
					${attempt.telegram_user_id}::int,
					${attempt.mode}::text, ${attempt.status}::text,
					${date(attempt.started_at)}::timestamptz,
					${date(attempt.updated_at)}::timestamptz,
					${date(attempt.completed_at)}::timestamptz
				)
				on conflict (owner_id, legacy_id) do nothing
			`;
			count("attempts", 1);

			let position = 0;

			for (const questionId of strings(attempt.question_ids)) {
				if (!knownQuestions.has(questionId)) {
					notes.push(
						`attempt ${id} presented question ${questionId}, which no longer exists`,
					);
					continue;
				}

				await client`
					insert into attempt_questions (attempt_id, position, question_id)
					values (
						${uuidFor("attempt", id)}::uuid, ${position}::int,
						${uuidFor("question", questionId)}::uuid
					)
					on conflict (attempt_id, position) do nothing
				`;
				position += 1;
				count("attempt_questions", 1);
			}
		}

		const responses = source
			.query<ResponseRow, []>("select * from question_responses")
			.all();

		for (const response of responses) {
			const questionId = response.question_id;

			if (!knownQuestions.has(questionId)) {
				notes.push(`response for missing question ${questionId} skipped`);
				continue;
			}

			const selected = strings(response.selected_option_ids).map((legacy) =>
				uuidFor("option", legacy),
			);

			await client`
				insert into responses (
					attempt_id, question_id, selected_option_ids, is_correct,
					typed_answer, skipped, credit_earned, credit_possible, answered_at
				) values (
					${uuidFor("attempt", response.attempt_id)}::uuid,
					${uuidFor("question", questionId)}::uuid,
					${selected}::uuid[]::uuid[], ${response.is_correct === 1}::boolean,
					${response.typed_answer}::text, ${response.skipped === 1}::boolean,
					${response.credit_earned}::int, ${response.credit_possible}::int,
					${date(response.answered_at)}::timestamptz
				)
				on conflict (attempt_id, question_id) do nothing
			`;
			count("responses", 1);
		}

		const schedules = source
			.query<ScheduleRow, []>("select * from question_repetition_schedules")
			.all();

		for (const schedule of schedules) {
			const questionId = schedule.question_id;

			if (!knownQuestions.has(questionId)) {
				notes.push(`schedule for missing question ${questionId} skipped`);
				continue;
			}

			await client`
				insert into review_states (
					question_id, owner_id, telegram_user_id, repetition_count, lapses,
					last_reviewed_at, due_at, created_at, updated_at
				) values (
					${uuidFor("question", questionId)}::uuid,
					${owner}::text,
					${schedule.telegram_user_id}::int,
					${schedule.repetition_count}::int, ${schedule.lapses}::int,
					${date(schedule.last_completed_at)}::timestamptz,
					${date(schedule.due_at)}::timestamptz,
					${date(schedule.created_at)}::timestamptz,
					${date(schedule.updated_at)}::timestamptz
				)
				on conflict (question_id) do nothing
			`;
			count("review_states", 1);
		}

		const defaults = source
			.query<DefaultsRow, []>("select * from repetition_defaults where id = 1")
			.get();

		if (defaults !== null) {
			await client`
				insert into study_settings (
					id, owner_id, scope_type, scope_id, intervals_days, max_interval_days,
					max_repetitions, shuffle_options, shuffle_questions, exam_mode, updated_at
				) values (
					${uuidFor("settings", "owner")}::uuid,
					${owner}::text,
					'owner'::text,
					null::uuid,
					${numbers(defaults.intervals_days)}::integer[],
					${defaults.max_interval_days}::int,
					${defaults.max_repetitions}::int,
					${defaults.shuffle_options === 1}::boolean,
					${defaults.shuffle_questions === 1}::boolean,
					${defaults.exam_mode === 1}::boolean,
					${date(defaults.updated_at)}::timestamptz
				)
				on conflict (owner_id, scope_type, scope_id) do nothing
			`;
			count("study_settings", 1);
		}

		const perQuiz = source
			.query<SettingsRow, []>("select * from repetition_settings")
			.all();

		for (const settings of perQuiz) {
			const quizId = settings.quiz_set_id;

			await client`
				insert into study_settings (
					id, owner_id, scope_type, scope_id, intervals_days, max_interval_days,
					max_repetitions, shuffle_options, shuffle_questions, exam_mode, updated_at
				) values (
					${uuidFor("settings", quizId)}::uuid,
					${owner}::text,
					'quiz'::text,
					${uuidFor("quiz", quizId)}::uuid,
					${numbers(settings.intervals_days)}::integer[],
					${settings.max_interval_days}::int,
					${settings.max_repetitions}::int,
					${settings.shuffle_options === 1}::boolean,
					${settings.shuffle_questions === 1}::boolean,
					${settings.exam_mode === 1}::boolean,
					${date(settings.updated_at)}::timestamptz
				)
				on conflict (owner_id, scope_type, scope_id) do nothing
			`;
			count("study_settings", 1);
		}

		notes.push(
			"oauth tables are not migrated: phase 7 replaces them with Better Auth",
		);
		notes.push(
			"telegram_user_id is carried as a legacy identifier; phase 7 turns it into owner_id",
		);
	} finally {
		source.close();
	}

	return { inserted, notes };
}

export interface VerificationIssue {
	readonly check: string;
	readonly expected: number | string;
	readonly actual: number | string;
}

const single = async (client: postgres.Sql, query: string): Promise<number> => {
	const rows = await client.unsafe<{ n: number | string }[]>(query);

	return Number(rows[0]?.n ?? -1);
};

export async function verifyMigration(options: {
	readonly sqlitePath: string;
	readonly client: postgres.Sql;
}): Promise<readonly VerificationIssue[]> {
	const source = new Database(options.sqlitePath, { readonly: true });
	const issues: VerificationIssue[] = [];

	const sqliteCount = (table: string): number =>
		source
			.query<{ n: number }, []>(`select count(*) as n from "${table}"`)
			.get()?.n ?? -1;

	try {
		const pairs: readonly [string, string][] = [
			["folders", "pages"],
			["quiz_sets", "quizzes"],
			["vocabulary_items", "term_pairs"],
			["questions", "questions"],
			["question_options", "question_options"],
			["quiz_attempts", "attempts"],
			["question_responses", "responses"],
			["question_repetition_schedules", "review_states"],
		];

		for (const [from, to] of pairs) {
			const expected = sqliteCount(from);
			const actual = await single(
				options.client,
				`select count(*) as n from "${to}"`,
			);

			if (expected !== actual) {
				issues.push({ check: `${from} -> ${to}`, expected, actual });
			}
		}

		const expectedSettings =
			sqliteCount("repetition_settings") + sqliteCount("repetition_defaults");
		const actualSettings = await single(
			options.client,
			"select count(*) as n from study_settings",
		);

		if (expectedSettings !== actualSettings) {
			issues.push({
				check: "repetition settings -> study_settings",
				expected: expectedSettings,
				actual: actualSettings,
			});
		}

		const expectedCorrect =
			source
				.query<{ n: number }, []>(
					"select coalesce(sum(is_correct), 0) as n from question_responses",
				)
				.get()?.n ?? 0;
		const actualCorrect = await single(
			options.client,
			"select count(*) as n from responses where is_correct",
		);

		if (expectedCorrect !== actualCorrect) {
			issues.push({
				check: "correct answers preserved",
				expected: expectedCorrect,
				actual: actualCorrect,
			});
		}

		const attemptsWithoutUser = await single(
			options.client,
			"select count(*) as n from attempts where telegram_user_id is null",
		);

		if (attemptsWithoutUser !== 0) {
			issues.push({
				check: "attempt owner identifier survived",
				expected: 0,
				actual: attemptsWithoutUser,
			});
		}

		const orphanOptions = await single(
			options.client,
			`select count(*) as n from question_options o
			 left join questions q on q.id = o.question_id where q.id is null`,
		);

		if (orphanOptions !== 0) {
			issues.push({
				check: "no orphan options",
				expected: 0,
				actual: orphanOptions,
			});
		}

		const nullTimestamps = await single(
			options.client,
			`select count(*) as n from attempts where started_at is null`,
		);

		if (nullTimestamps !== 0) {
			issues.push({
				check: "attempt timestamps survived",
				expected: 0,
				actual: nullTimestamps,
			});
		}

		const rootPages = await single(
			options.client,
			"select count(*) as n from pages where parent_id is null",
		);
		const expectedRoots =
			source
				.query<{ n: number }, []>(
					"select count(*) as n from folders where parent_id is null",
				)
				.get()?.n ?? -1;

		if (rootPages !== expectedRoots) {
			issues.push({
				check: "root pages",
				expected: expectedRoots,
				actual: rootPages,
			});
		}
	} finally {
		source.close();
	}

	return issues;
}
