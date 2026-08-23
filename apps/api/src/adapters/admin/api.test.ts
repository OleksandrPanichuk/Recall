import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createMutableClock,
	createSequentialIdGenerator,
} from "@tests/fixtures/application.fixture";
import { createRecordingLogger } from "@tests/fixtures/logger.fixture";
import {
	type Application,
	createApplication,
} from "@/composition/create-application";
import { createAdminApi } from "./api";

const PASSPHRASE = "correct horse battery staple";
const TELEGRAM_USER_ID = 4242;

let application: Application;
let server: ReturnType<typeof Bun.serve>;
let origin: string;
let cookie: string;

const call = (
	path: string,
	init: RequestInit & { signedIn?: boolean } = {},
): Promise<Response> => {
	const { signedIn = true, ...rest } = init;

	return fetch(`${origin}${path}`, {
		...rest,
		headers: {
			"content-type": "application/json",
			...(signedIn ? { cookie } : {}),
			...(rest.headers ?? {}),
		},
	});
};

const send = <TBody>(
	method: string,
	path: string,
	body?: unknown,
): Promise<Response> =>
	call(path, {
		method,
		body: body === undefined ? undefined : JSON.stringify(body as TBody),
	});

const read = async <TBody>(response: Response): Promise<TBody> =>
	(await response.json()) as TBody;

interface SetRow {
	id: string;
	title: string;
	status: string;
	folderId: string | null;
	questionCount: number;
	description: string;
	tags: readonly string[];
}

interface QuestionRow {
	id: string;
	quizSetId: string;
	setTitle: string;
	prompt: string;
	topic: string;
	hint: string;
	difficulty: string;
	position: number;
	answerCount: number;
	editable: boolean;
	options: readonly { text: string; isCorrect: boolean }[];
}

interface FolderRow {
	id: string;
	name: string;
	parentId: string | null;
	setCount: number;
	unpublishedCount: number;
}

const createSet = async (title: string, language = "en"): Promise<string> => {
	const created = await read<SetRow>(
		await send("POST", "/api/sets", { title, language }),
	);

	return created.id;
};

const addQuestion = (
	quizSetId: string,
	prompt: string,
	extra: Record<string, unknown> = {},
) =>
	send("POST", "/api/questions", {
		quizSetId,
		type: "single_choice",
		prompt,
		difficulty: "medium",
		options: [
			{ text: "have done", isCorrect: true },
			{ text: "did", isCorrect: false },
		],
		...extra,
	});

const publishedSet = async (title = "Present Perfect"): Promise<string> => {
	const quizSetId = await createSet(title);

	await addQuestion(quizSetId, `${title}: I ___ it already.`);
	await send("PUT", `/api/sets/${quizSetId}`, { status: "published" });

	return quizSetId;
};

beforeEach(async () => {
	application = createApplication({
		databasePath: ":memory:",
		clock: createMutableClock(),
		idGenerator: createSequentialIdGenerator("a"),
	});
	server = Bun.serve({
		port: 0,
		routes: createAdminApi({
			application,
			logger: createRecordingLogger(),
			passphrase: PASSPHRASE,
			telegramUserId: TELEGRAM_USER_ID,
			now: () => new Date(),
		}),
	});
	origin = `http://127.0.0.1:${server.port}`;

	const signIn = await call("/api/session", {
		method: "POST",
		signedIn: false,
		body: JSON.stringify({ passphrase: PASSPHRASE }),
	});

	cookie = (signIn.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
});

afterEach(async () => {
	await server.stop(true);
	application.close();
});

describe("the session", () => {
	test("hands back a cookie for the right passphrase", () => {
		expect(cookie).toStartWith("admin=");
	});

	test("refuses a wrong passphrase without a cookie", async () => {
		const response = await call("/api/session", {
			method: "POST",
			signedIn: false,
			body: JSON.stringify({ passphrase: "not it" }),
		});

		expect(response.status).toBe(401);
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	test("locks every resource behind the cookie", async () => {
		for (const path of [
			"/api/sets",
			"/api/questions",
			"/api/folders",
			"/api/vocabulary",
			"/api/settings/global",
		]) {
			expect((await call(path, { signedIn: false })).status).toBe(401);
		}
	});

	test("answers a signed-in check, which is how the admin knows to show the app", async () => {
		expect((await call("/api/session")).status).toBe(200);
	});

	test("clears the cookie on sign-out", async () => {
		const response = await call("/api/session", { method: "DELETE" });

		expect(response.status).toBe(204);
		expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
	});
});

describe("listing, the way react-admin asks for it", () => {
	test("reports the total in x-total-count so the pager works", async () => {
		await createSet("First");
		await createSet("Second");
		await createSet("Third");

		const response = await call("/api/sets?_start=0&_end=2");
		const rows = await read<readonly SetRow[]>(response);

		expect(response.headers.get("x-total-count")).toBe("3");
		expect(rows).toHaveLength(2);
	});

	test("sorts by the column the grid was clicked on", async () => {
		await createSet("Banana");
		await createSet("Apple");

		const rows = await read<readonly SetRow[]>(
			await call("/api/sets?_sort=title&_order=ASC"),
		);

		expect(rows.map((row) => row.title)).toEqual(["Apple", "Banana"]);
	});

	test("searches sets by text", async () => {
		await createSet("A1 Food Vocabulary");
		await createSet("DDIA chapter 2");

		const rows = await read<readonly SetRow[]>(await call("/api/sets?q=food"));

		expect(rows.map((row) => row.title)).toEqual(["A1 Food Vocabulary"]);
	});

	test("filters sets by status", async () => {
		await publishedSet("Published one");
		await createSet("Still a draft");

		const rows = await read<readonly SetRow[]>(
			await call("/api/sets?status=draft"),
		);

		expect(rows.map((row) => row.title)).toEqual(["Still a draft"]);
	});

	test("returns the exact records getMany asks for", async () => {
		const first = await createSet("First");

		await createSet("Second");

		const rows = await read<readonly SetRow[]>(
			await call(`/api/sets?id=${first}`),
		);

		expect(rows.map((row) => row.id)).toEqual([first]);
	});
});

describe("questions across every set", () => {
	test("lists them all with the set they belong to", async () => {
		const first = await createSet("First");
		const second = await createSet("Second");

		await addQuestion(first, "Question in the first set");
		await addQuestion(second, "Question in the second set");

		const rows = await read<readonly QuestionRow[]>(
			await call("/api/questions?_sort=setTitle&_order=ASC"),
		);

		expect(rows.map((row) => row.setTitle)).toEqual(["First", "Second"]);
	});

	test("searches the prompt, the topic and the options at once", async () => {
		const quizSetId = await createSet("First");

		await addQuestion(quizSetId, "Which keyword declares a constant?", {
			topic: "syntax",
		});
		await addQuestion(quizSetId, "What does PRAGMA do?", { topic: "sqlite" });

		const byPrompt = await read<readonly QuestionRow[]>(
			await call("/api/questions?q=constant"),
		);
		const byTopic = await read<readonly QuestionRow[]>(
			await call("/api/questions?q=sqlite"),
		);
		const byOption = await read<readonly QuestionRow[]>(
			await call("/api/questions?q=have%20done"),
		);

		expect(byPrompt).toHaveLength(1);
		expect(byTopic).toHaveLength(1);
		expect(byOption).toHaveLength(2);
	});

	test("narrows to one set", async () => {
		const first = await createSet("First");
		const second = await createSet("Second");

		await addQuestion(first, "In the first");
		await addQuestion(second, "In the second");

		const rows = await read<readonly QuestionRow[]>(
			await call(`/api/questions?quizSetId=${second}`),
		);

		expect(rows.map((row) => row.prompt)).toEqual(["In the second"]);
	});

	test("filters by difficulty and by topic", async () => {
		const quizSetId = await createSet("First");

		await addQuestion(quizSetId, "Easy one", {
			difficulty: "easy",
			topic: "syntax",
		});
		await addQuestion(quizSetId, "Hard one", {
			difficulty: "hard",
			topic: "internals",
		});

		expect(
			await read<readonly QuestionRow[]>(
				await call("/api/questions?difficulty=hard"),
			),
		).toHaveLength(1);
		expect(
			await read<readonly QuestionRow[]>(
				await call("/api/questions?topic=syntax"),
			),
		).toHaveLength(1);
	});

	test("creates one and answers with the created record", async () => {
		const quizSetId = await createSet("First");
		const response = await addQuestion(quizSetId, "Freshly added");
		const created = await read<QuestionRow>(response);

		expect(response.status).toBe(201);
		expect(created.prompt).toBe("Freshly added");
		expect(created.quizSetId).toBe(quizSetId);
		expect(created.answerCount).toBe(0);
	});

	test("edits one in place, keeping its id", async () => {
		const quizSetId = await createSet("First");
		const created = await read<QuestionRow>(
			await addQuestion(quizSetId, "Before"),
		);
		const updated = await read<QuestionRow>(
			await send("PUT", `/api/questions/${created.id}`, {
				prompt: "After",
				hint: "a hint",
			}),
		);

		expect(updated.id).toBe(created.id);
		expect(updated.prompt).toBe("After");
		expect(updated.hint).toBe("a hint");
	});

	test("deletes one and answers with the record that went", async () => {
		const quizSetId = await createSet("First");
		const created = await read<QuestionRow>(
			await addQuestion(quizSetId, "Doomed"),
		);

		await addQuestion(quizSetId, "The survivor");

		const response = await send("DELETE", `/api/questions/${created.id}`);
		const deleted = await read<QuestionRow>(response);

		expect(response.status).toBe(200);
		expect(deleted.id).toBe(created.id);
		expect(
			(await read<readonly QuestionRow[]>(await call("/api/questions"))).map(
				(row) => row.prompt,
			),
		).toEqual(["The survivor"]);
	});

	test("refuses to delete the only question a set has", async () => {
		const quizSetId = await createSet("First");
		const created = await read<QuestionRow>(
			await addQuestion(quizSetId, "The only one"),
		);
		const response = await send("DELETE", `/api/questions/${created.id}`);
		const body = await read<{ message: string }>(response);

		expect(response.status).toBe(400);
		expect(body.message).toBe("A quiz set needs at least one question");
	});

	test("reports a missing question as a client error", async () => {
		expect((await call("/api/questions/missing")).status).toBe(400);
	});
});

describe("the set lifecycle", () => {
	test("publishes through the status field of the edit form", async () => {
		const quizSetId = await createSet("Ready");

		await addQuestion(quizSetId, "One question");

		const updated = await read<SetRow>(
			await send("PUT", `/api/sets/${quizSetId}`, { status: "published" }),
		);

		expect(updated.status).toBe("published");
	});

	test("refuses to publish a set with no questions", async () => {
		const quizSetId = await createSet("Empty");
		const response = await send("PUT", `/api/sets/${quizSetId}`, {
			status: "published",
		});
		const body = await read<{ message: string }>(response);

		expect(response.status).toBe(400);
		expect(body.message).toContain("question");
	});

	test("refuses to send a published set back to draft", async () => {
		const quizSetId = await publishedSet();
		const response = await send("PUT", `/api/sets/${quizSetId}`, {
			status: "draft",
		});

		expect(response.status).toBe(400);
	});

	test("archives, and then refuses every further edit", async () => {
		const quizSetId = await publishedSet();

		expect(
			(await send("PUT", `/api/sets/${quizSetId}`, { status: "archived" }))
				.status,
		).toBe(200);
		expect(
			(await send("PUT", `/api/sets/${quizSetId}`, { title: "Renamed" }))
				.status,
		).toBe(400);
		expect((await addQuestion(quizSetId, "Too late")).status).toBe(400);
	});

	test("edits the metadata of a published set", async () => {
		const quizSetId = await publishedSet();
		const updated = await read<SetRow>(
			await send("PUT", `/api/sets/${quizSetId}`, {
				title: "Renamed",
				description: "Now with a description",
			}),
		);

		expect(updated.title).toBe("Renamed");
		expect(updated.description).toBe("Now with a description");
	});

	test("adds a question to a published set", async () => {
		const quizSetId = await publishedSet();
		const response = await addQuestion(quizSetId, "Added after publishing");

		expect(response.status).toBe(201);
		expect(
			(await read<SetRow>(await call(`/api/sets/${quizSetId}`))).questionCount,
		).toBe(2);
	});

	test("moves a set into a folder and out again", async () => {
		const quizSetId = await createSet("Movable");
		const folder = await read<FolderRow>(
			await send("POST", "/api/folders", { name: "Grammar" }),
		);

		expect(
			(
				await read<SetRow>(
					await send("PUT", `/api/sets/${quizSetId}`, {
						folderId: folder.id,
					}),
				)
			).folderId,
		).toBe(folder.id);
		expect(
			(
				await read<SetRow>(
					await send("PUT", `/api/sets/${quizSetId}`, { folderId: null }),
				)
			).folderId,
		).toBeNull();
	});
});

describe("folders", () => {
	test("creates, renames and re-parents", async () => {
		const parent = await read<FolderRow>(
			await send("POST", "/api/folders", { name: "Books" }),
		);
		const child = await read<FolderRow>(
			await send("POST", "/api/folders", { name: "DDIA" }),
		);

		expect(child.parentId).toBeNull();

		const renamed = await read<FolderRow>(
			await send("PUT", `/api/folders/${child.id}`, { name: "DDIA 2017" }),
		);

		expect(renamed.name).toBe("DDIA 2017");

		const moved = await read<FolderRow>(
			await send("PUT", `/api/folders/${child.id}`, {
				name: "DDIA 2017",
				parentId: parent.id,
			}),
		);

		expect(moved.parentId).toBe(parent.id);
	});

	test("refuses to delete a folder that still holds a set", async () => {
		const folder = await read<FolderRow>(
			await send("POST", "/api/folders", { name: "Grammar" }),
		);
		const quizSetId = await createSet("Inside");

		await send("PUT", `/api/sets/${quizSetId}`, { folderId: folder.id });

		expect((await send("DELETE", `/api/folders/${folder.id}`)).status).toBe(
			400,
		);
	});

	test("deletes an empty folder", async () => {
		const folder = await read<FolderRow>(
			await send("POST", "/api/folders", { name: "Temporary" }),
		);

		expect((await send("DELETE", `/api/folders/${folder.id}`)).status).toBe(
			200,
		);
		expect(
			await read<readonly FolderRow[]>(await call("/api/folders")),
		).toEqual([]);
	});

	test("reports a missing folder as not found", async () => {
		expect((await call("/api/folders/missing")).status).toBe(404);
	});
});

describe("vocabulary", () => {
	test("adds a pair, then edits its terms", async () => {
		const quizSetId = await createSet("Food", "de");
		const created = await read<{ id: string; terms: readonly string[] }>(
			await send("POST", "/api/vocabulary", {
				quizSetId,
				terms: ["das Brot"],
				translations: ["хліб"],
				directions: ["term_to_translation"],
			}),
		);

		expect(created.terms).toEqual(["das Brot"]);

		const updated = await read<{
			terms: readonly string[];
			questionCount: number;
		}>(
			await send("PUT", `/api/vocabulary/${created.id}`, {
				terms: "das Brötchen",
			}),
		);

		expect(updated.terms).toEqual(["das Brötchen"]);
		expect(updated.questionCount).toBe(1);
	});

	test("accepts several terms as a comma separated field", async () => {
		const quizSetId = await createSet("Food", "de");
		const created = await read<{
			terms: readonly string[];
			translations: readonly string[];
		}>(
			await send("POST", "/api/vocabulary", {
				quizSetId,
				terms: "der Zug, die Bahn",
				translations: "поїзд",
				directions: ["term_to_translation"],
			}),
		);

		expect(created.terms).toEqual(["der Zug", "die Bahn"]);
		expect(created.translations).toEqual(["поїзд"]);
	});

	test("lists only the pairs of one set when asked", async () => {
		const first = await createSet("First", "de");
		const second = await createSet("Second", "de");

		for (const [quizSetId, term] of [
			[first, "das Brot"],
			[second, "der Zug"],
		] as const) {
			await send("POST", "/api/vocabulary", {
				quizSetId,
				terms: [term],
				translations: ["x"],
				directions: ["term_to_translation"],
			});
		}

		const rows = await read<readonly { terms: readonly string[] }[]>(
			await call(`/api/vocabulary?quizSetId=${second}`),
		);

		expect(rows.map((row) => row.terms)).toEqual([["der Zug"]]);
	});
});

describe("settings", () => {
	test("reads and writes the global record", async () => {
		const saved = await read<{
			shuffleQuestions: boolean;
			source: string;
			intervalsDays: readonly number[];
		}>(
			await send("PUT", "/api/settings/global", {
				shuffleQuestions: true,
				examMode: true,
				intervalsDays: "1, 5, 20",
				maxIntervalDays: 90,
				maxRepetitions: 6,
			}),
		);

		expect(saved.shuffleQuestions).toBe(true);
		expect(saved.source).toBe("global");
		expect(saved.intervalsDays).toEqual([1, 5, 20]);

		const reread = await read<{ examMode: boolean }>(
			await call("/api/settings/global"),
		);

		expect(reread.examMode).toBe(true);
	});

	test("overrides one set without touching the global record", async () => {
		const quizSetId = await createSet("Special");

		const forSet = await read<{ shuffleQuestions: boolean; source: string }>(
			await send("PUT", `/api/settings/${quizSetId}`, {
				shuffleQuestions: true,
			}),
		);

		expect(forSet.shuffleQuestions).toBe(true);
		expect(forSet.source).toBe("set");
		expect(
			(
				await read<{ shuffleQuestions: boolean }>(
					await call("/api/settings/global"),
				)
			).shuffleQuestions,
		).toBe(false);
	});

	test("gives an override back to the global record", async () => {
		const quizSetId = await createSet("Special");

		await send("PUT", "/api/settings/global", { shuffleOptions: true });
		await send("PUT", `/api/settings/${quizSetId}`, { examMode: true });

		const back = await read<{
			source: string;
			examMode: boolean;
			shuffleOptions: boolean;
		}>(
			await send("PUT", `/api/settings/${quizSetId}`, { inheritGlobal: true }),
		);

		expect(back.source).toBe("global");
		expect(back.examMode).toBe(false);
		expect(back.shuffleOptions).toBe(true);
	});
});

describe("statistics", () => {
	test("reports the statistics of one set", async () => {
		const quizSetId = await publishedSet();
		const statistics = await read<{
			setAccuracy: { correct: number; total: number; percentage: number };
			topics: readonly unknown[];
		}>(await call(`/api/statistics/${quizSetId}`));

		expect(statistics.setAccuracy).toEqual({
			correct: 0,
			total: 0,
			percentage: 0,
		});
		expect(statistics.topics).toEqual([]);
	});

	test("reports due repetitions and leeches", async () => {
		const body = await read<Record<string, unknown>>(
			await call("/api/repetitions"),
		);

		expect(body).toHaveProperty("due");
		expect(body).toHaveProperty("leeches");
	});
});

describe("clearing a field, which the form does by sending it empty", () => {
	test("clears the description of a set", async () => {
		const quizSetId = await createSet("With a description");

		await send("PUT", `/api/sets/${quizSetId}`, {
			description: "something to remove",
		});

		expect(
			(await read<SetRow>(await call(`/api/sets/${quizSetId}`))).description,
		).toBe("something to remove");

		const cleared = await read<SetRow>(
			await send("PUT", `/api/sets/${quizSetId}`, { description: "" }),
		);

		expect(cleared.description).toBe("");
	});

	test("clears the hint of a question", async () => {
		const quizSetId = await createSet("With a hint");
		const created = await read<QuestionRow>(
			await addQuestion(quizSetId, "Has a hint", { hint: "a hint" }),
		);

		expect(created.hint).toBe("a hint");

		const cleared = await read<QuestionRow>(
			await send("PUT", `/api/questions/${created.id}`, { hint: "" }),
		);

		expect(cleared.hint).toBe("");
	});

	test("leaves a field alone when the form does not send it at all", async () => {
		const quizSetId = await createSet("Untouched");

		await send("PUT", `/api/sets/${quizSetId}`, { description: "kept" });
		await send("PUT", `/api/sets/${quizSetId}`, { title: "Renamed" });

		const stored = await read<SetRow>(await call(`/api/sets/${quizSetId}`));

		expect(stored.title).toBe("Renamed");
		expect(stored.description).toBe("kept");
	});

	test("keeps the tags of a set that were never sent", async () => {
		const quizSetId = await createSet("Tagged");

		await send("PUT", `/api/sets/${quizSetId}`, { tags: "ddia, data-models" });

		const tagged = await read<SetRow>(await call(`/api/sets/${quizSetId}`));

		expect(tagged.tags).toEqual(["ddia", "data-models"]);

		const renamed = await read<SetRow>(
			await send("PUT", `/api/sets/${quizSetId}`, { title: "Still tagged" }),
		);

		expect(renamed.tags).toEqual(["ddia", "data-models"]);

		const cleared = await read<SetRow>(
			await send("PUT", `/api/sets/${quizSetId}`, { tags: "" }),
		);

		expect(cleared.tags).toEqual([]);
	});

	test("refuses to clear a required field instead of ignoring it", async () => {
		const quizSetId = await createSet("Needs a title");
		const response = await send("PUT", `/api/sets/${quizSetId}`, { title: "" });
		const body = await read<{ message: string }>(response);

		expect(response.status).toBe(400);
		expect(body.message).toContain("title");
	});
});
