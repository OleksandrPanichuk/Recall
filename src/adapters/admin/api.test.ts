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

const post = (path: string, body?: unknown, signedIn = true) =>
	call(path, {
		method: "POST",
		signedIn,
		body: body === undefined ? undefined : JSON.stringify(body),
	});

const createSet = async (title = "Present Perfect"): Promise<string> => {
	const response = await post("/api/sets", { title, language: "en" });
	const body = (await response.json()) as { quizSetId: string };

	return body.quizSetId;
};

const addQuestion = (quizSetId: string, prompt = "I ___ it already.") =>
	post(`/api/sets/${quizSetId}/questions`, {
		questions: [
			{
				type: "single_choice",
				prompt,
				difficulty: "medium",
				options: [
					{ text: "have done", isCorrect: true },
					{ text: "did", isCorrect: false },
				],
			},
		],
	});

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

	const signIn = await post("/api/session", { passphrase: PASSPHRASE }, false);

	cookie = (signIn.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
});

afterEach(async () => {
	await server.stop(true);
	application.close();
});

describe("the admin sign-in", () => {
	test("hands back a session cookie for the right passphrase", () => {
		expect(cookie).toStartWith("admin=");
	});

	test("refuses a wrong passphrase without a cookie", async () => {
		const response = await post(
			"/api/session",
			{ passphrase: "not it" },
			false,
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	test("locks every management route behind the session", async () => {
		const response = await call("/api/overview", { signedIn: false });

		expect(response.status).toBe(401);
	});

	test("clears the cookie on sign-out", async () => {
		const response = await call("/api/session", { method: "DELETE" });

		expect(response.status).toBe(204);
		expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
	});
});

describe("managing quiz sets", () => {
	test("creates a set, adds a question and publishes it", async () => {
		const quizSetId = await createSet();

		await addQuestion(quizSetId);

		const response = await post(`/api/sets/${quizSetId}/publish`);
		const set = (await response.json()) as {
			status: string;
			questions: readonly { prompt: string }[];
		};

		expect(set.status).toBe("published");
		expect(set.questions.map((question) => question.prompt)).toEqual([
			"I ___ it already.",
		]);
	});

	test("refuses to publish a set with no questions", async () => {
		const quizSetId = await createSet();
		const response = await post(`/api/sets/${quizSetId}/publish`);

		expect(response.status).toBe(400);
		expect((await response.json()) as { error: string }).toHaveProperty(
			"error",
		);
	});

	test("edits a question in place, keeping its id", async () => {
		const quizSetId = await createSet();

		await addQuestion(quizSetId);

		const before = (await (await call(`/api/sets/${quizSetId}`)).json()) as {
			questions: readonly { id: string }[];
		};
		const questionId = before.questions[0]?.id ?? "";
		const response = await call(
			`/api/sets/${quizSetId}/questions/${questionId}`,
			{
				method: "PATCH",
				body: JSON.stringify({ prompt: "I ___ it twice.", hint: "perfect" }),
			},
		);
		const after = (await response.json()) as {
			questions: readonly { id: string; prompt: string; hint?: string }[];
		};

		expect(after.questions).toHaveLength(1);
		expect(after.questions[0]?.id).toBe(questionId);
		expect(after.questions[0]?.prompt).toBe("I ___ it twice.");
		expect(after.questions[0]?.hint).toBe("perfect");
	});

	test("deletes a question", async () => {
		const quizSetId = await createSet();

		await addQuestion(quizSetId);
		await addQuestion(quizSetId, "She ___ already left.");

		const before = (await (await call(`/api/sets/${quizSetId}`)).json()) as {
			questions: readonly { id: string }[];
		};
		const response = await call(
			`/api/sets/${quizSetId}/questions/${before.questions[0]?.id}`,
			{ method: "DELETE" },
		);
		const after = (await response.json()) as {
			questions: readonly { prompt: string }[];
		};

		expect(after.questions.map((question) => question.prompt)).toEqual([
			"She ___ already left.",
		]);
	});

	test("reports a bad set id as a client error, not a crash", async () => {
		const response = await call("/api/sets/nope");

		expect(response.status).toBe(400);
	});
});

describe("managing folders", () => {
	test("creates a folder, moves a set into it and renames it", async () => {
		const created = (await (
			await post("/api/folders", { name: "Grammar" })
		).json()) as { folderId: string };
		const quizSetId = await createSet();

		await post(`/api/sets/${quizSetId}/move`, { folderId: created.folderId });

		const moved = (await (await call(`/api/sets/${quizSetId}`)).json()) as {
			folderId: string | null;
		};

		expect(moved.folderId).toBe(created.folderId);

		const renamed = (await (
			await call(`/api/folders/${created.folderId}`, {
				method: "PATCH",
				body: JSON.stringify({ name: "English grammar" }),
			})
		).json()) as readonly {
			id: string;
			name: string;
			parentId: string | null;
			depth: number;
			setCount: number;
			unpublishedCount: number;
		}[];

		expect(renamed).toEqual([
			{
				id: created.folderId,
				name: "English grammar",
				parentId: null,
				depth: 0,
				setCount: 0,
				unpublishedCount: 1,
			},
		]);
	});

	test("refuses to delete a folder that still holds a set", async () => {
		const created = (await (
			await post("/api/folders", { name: "Grammar" })
		).json()) as { folderId: string };
		const quizSetId = await createSet();

		await post(`/api/sets/${quizSetId}/move`, { folderId: created.folderId });

		const response = await call(`/api/folders/${created.folderId}`, {
			method: "DELETE",
		});

		expect(response.status).toBe(400);
	});
});

describe("managing settings", () => {
	test("saves the global settings and reads them back", async () => {
		await call("/api/settings", {
			method: "PUT",
			body: JSON.stringify({ shuffleQuestions: true, examMode: true }),
		});

		const response = (await (await call("/api/settings")).json()) as {
			settings: { shuffleQuestions: boolean; examMode: boolean };
			source: string;
		};

		expect(response.settings.shuffleQuestions).toBe(true);
		expect(response.settings.examMode).toBe(true);
		expect(response.source).toBe("global");
	});

	test("answers a save with the same shape a read does", async () => {
		const saved = (await (
			await call("/api/settings", {
				method: "PUT",
				body: JSON.stringify({ examMode: true }),
			})
		).json()) as { settings: { examMode: boolean }; source: string };

		expect(saved.settings.examMode).toBe(true);
		expect(saved.source).toBe("global");
	});

	test("overrides one set without touching the global settings", async () => {
		const quizSetId = await createSet();

		const saved = (await (
			await call("/api/settings", {
				method: "PUT",
				body: JSON.stringify({ quizSetId, shuffleQuestions: true }),
			})
		).json()) as { settings: { shuffleQuestions: boolean }; source: string };

		expect(saved.settings.shuffleQuestions).toBe(true);
		expect(saved.source).toBe("set");

		const forSet = (await (
			await call(`/api/settings?setId=${quizSetId}`)
		).json()) as { settings: { shuffleQuestions: boolean }; source: string };
		const global = (await (await call("/api/settings")).json()) as {
			settings: { shuffleQuestions: boolean };
			source: string;
		};

		expect(forSet.settings.shuffleQuestions).toBe(true);
		expect(forSet.source).toBe("set");
		expect(global.settings.shuffleQuestions).toBe(false);
	});
});

describe("the overview", () => {
	test("lists unpublished sets, folders and the settings source", async () => {
		await post("/api/folders", { name: "Grammar" });
		await createSet("Draft set");

		const response = (await (await call("/api/overview")).json()) as {
			sets: readonly { title: string; status: string }[];
			folders: readonly { name: string }[];
			settingsSource: string;
		};

		expect(response.sets).toEqual([
			expect.objectContaining({ title: "Draft set", status: "draft" }),
		]);
		expect(response.folders).toEqual([
			expect.objectContaining({ name: "Grammar", parentId: null }),
		]);
		expect(response.settingsSource).toBe("default");
	});
});

describe("vocabulary", () => {
	test("adds a pair and edits the term", async () => {
		const quizSetId = await createSet("Food");

		const added = await post(`/api/sets/${quizSetId}/vocabulary`, {
			pairs: [{ term: ["das Brot"], translation: ["хліб"] }],
			directions: ["term_to_translation"],
		});

		expect(added.status).toBe(200);

		const listed = (await (
			await call(`/api/sets/${quizSetId}/vocabulary`)
		).json()) as readonly {
			itemId: string;
			terms: readonly string[];
			questionIds: readonly string[];
		}[];

		expect(listed).toHaveLength(1);
		expect(listed[0]?.terms).toEqual(["das Brot"]);
		expect(listed[0]?.questionIds).toHaveLength(1);

		const edited = (await (
			await call(`/api/vocabulary/${listed[0]?.itemId}`, {
				method: "PATCH",
				body: JSON.stringify({ term: ["das Brötchen"] }),
			})
		).json()) as { rebuiltQuestionCount: number };

		expect(edited.rebuiltQuestionCount).toBe(1);

		const again = (await (
			await call(`/api/sets/${quizSetId}/vocabulary`)
		).json()) as readonly { terms: readonly string[] }[];

		expect(again[0]?.terms).toEqual(["das Brötchen"]);
	});
});

describe("insights", () => {
	test("reports the statistics shape the admin renders", async () => {
		const quizSetId = await createSet();

		await addQuestion(quizSetId);

		const statistics = (await (
			await call(`/api/sets/${quizSetId}/statistics`)
		).json()) as {
			setAccuracy: { correct: number; total: number; percentage: number };
			topics: readonly { topic: string; answered: number; correct: number }[];
			attempts: readonly { attemptId: string; completedAt: string }[];
		};

		expect(statistics.setAccuracy).toEqual({
			correct: 0,
			total: 0,
			percentage: 0,
		});
		expect(statistics.topics).toEqual([]);
		expect(statistics.attempts).toEqual([]);
	});

	test("reports due repetitions and leeches", async () => {
		const response = (await (await call("/api/repetitions")).json()) as {
			due: unknown;
			leeches: unknown;
		};

		expect(response).toHaveProperty("due");
		expect(response).toHaveProperty("leeches");
	});
});
