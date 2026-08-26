import { afterAll, afterEach, describe, expect, test } from "bun:test";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedTelegramOwner,
} from "@api-tests/fixtures/postgres";
import {
	makeTempDirectory,
	removeTempDirectory,
} from "@api-tests/fixtures/temp-dir";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const PASSPHRASE = "correct horse battery staple";
const nativeFetch = globalThis.fetch;

const available = await postgresAvailable();

const directory = makeTempDirectory("recall-admin-ui-");
const port = 8100 + (process.pid % 500);
const origin = `http://127.0.0.1:${port}`;

let harness: PostgresHarness | undefined;

if (available) {
	harness = await openPostgres("admin_ui");
	await applyMigration(harness);
	await seedTelegramOwner(harness, 42);
}

const child = available
	? Bun.spawn(
			[
				process.execPath,
				Bun.fileURLToPath(
					new URL("../../api/src/entrypoints/serve.ts", import.meta.url),
				),
			],
			{
				env: {
					...process.env,
					TELEGRAM_BOT_KEY: "123456789:token-the-admin-never-uses",
					ALLOWED_TELEGRAM_USER_ID: "42",
					APP_TIMEZONE: "Europe/Kyiv",
					DATABASE_URL: harness?.url ?? "",
					ADMIN_PASSPHRASE: PASSPHRASE,
					API_HOST: "127.0.0.1",
					API_PORT: String(port),
				},
				stdout: "ignore",
				stderr: "pipe",
			},
		)
	: undefined;

let cookie = "";

const plainHeaders = (source: HeadersInit | undefined) => {
	const headers: Record<string, string> = {};

	if (source === undefined) {
		return headers;
	}

	if (Array.isArray(source)) {
		for (const [key, value] of source) {
			headers[String(key)] = String(value);
		}

		return headers;
	}

	if (typeof (source as Headers).forEach === "function") {
		(source as Headers).forEach((value, key) => {
			headers[key] = value;
		});

		return headers;
	}

	for (const [key, value] of Object.entries(source)) {
		headers[key] = String(value);
	}

	return headers;
};

const api = (path: string, init: RequestInit = {}): Promise<Response> => {
	const { headers, ...rest } = init;

	return nativeFetch(`${origin}${path}`, {
		...rest,
		headers: {
			"content-type": "application/json",
			...(cookie.length > 0 ? { cookie } : {}),
			...plainHeaders(headers),
		},
	});
};

const post = (path: string, body: unknown) =>
	api(path, { method: "POST", body: JSON.stringify(body) });

const put = (path: string, body: unknown) =>
	api(path, { method: "PUT", body: JSON.stringify(body) });

const complaint = async (): Promise<string> => {
	if (
		child === undefined ||
		child.stderr === null ||
		typeof child.stderr === "number"
	) {
		return "no output";
	}

	const said = await Promise.race([
		new Response(child.stderr as ReadableStream<Uint8Array>).text(),
		Bun.sleep(500).then(() => ""),
	]);

	return said.trim().length === 0 ? "no output" : said.trim();
};

const waitForServer = async (): Promise<void> => {
	const deadline = Date.now() + 20_000;

	while (Date.now() < deadline) {
		if (child === undefined || child.killed || child.exitCode !== null) {
			throw new Error(
				`the admin exited with ${child?.exitCode}: ${await complaint()}`,
			);
		}

		try {
			await nativeFetch(`${origin}/api/session`, {
				signal: AbortSignal.timeout(500),
			});

			return;
		} catch {
			await Bun.sleep(100);
		}
	}

	throw new Error(
		`the admin never answered on ${origin}: ${await complaint()}`,
	);
};

const signIn = async (): Promise<void> => {
	const response = await nativeFetch(`${origin}/api/session`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ passphrase: PASSPHRASE }),
	});

	cookie = (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
};

if (available) {
	await waitForServer();
	await signIn();
}

GlobalRegistrator.register({
	url: "http://127.0.0.1/",
	settings: { fetch: { disableSameOriginPolicy: true } },
});

const _happyFetch = globalThis.fetch;

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
	const url =
		typeof input === "string"
			? input
			: input instanceof URL
				? input.href
				: (input as Request).url;

	return url.startsWith("/") ? api(url, init ?? {}) : nativeFetch(input, init);
}) as typeof fetch;

const { render, screen, waitFor, cleanup } = await import(
	"@testing-library/react"
);
const { AdminApp } = await import("./app");

const seedSet = async (title: string): Promise<string> => {
	const created = (await (
		await post("/api/sets", { title, language: "en" })
	).json()) as { id: string };

	await post("/api/questions", {
		quizSetId: created.id,
		type: "single_choice",
		prompt: `${title}: which keyword declares a constant?`,
		difficulty: "medium",
		topic: "syntax",
		options: [
			{ text: "const", isCorrect: true },
			{ text: "let", isCorrect: false },
		],
	});

	return created.id;
};

const show = (hash = ""): void => {
	window.location.hash = hash;
	render(<AdminApp />);
};

const TIMEOUT = 30_000;

const eventually = (assert: () => void) => waitFor(assert, { timeout: 10_000 });

afterEach(() => {
	cleanup();
});

afterAll(async () => {
	child?.kill("SIGTERM");
	await child?.exited;
	await harness?.close();
	removeTempDirectory(directory);

	// happy-dom replaces globalThis wholesale, fetch included. Leaving it
	// registered pollutes every test file that runs after this one, and which
	// files those are depends only on filename order.
	globalThis.fetch = nativeFetch;
	await GlobalRegistrator.unregister();
});

describe.skipIf(!available)("the admin", () => {
	test(
		"lists the sets it finds",
		async () => {
			await seedSet("Listed set");

			show();

			await eventually(() => {
				expect(screen.getByText("Listed set")).toBeDefined();
			});

			expect(screen.getAllByText("draft").length).toBeGreaterThan(0);
		},
		TIMEOUT,
	);

	test(
		"shows a search box over the list",
		async () => {
			await seedSet("Set with a search box");

			show();

			await eventually(() => {
				expect(screen.getByText("Set with a search box")).toBeDefined();
			});

			expect(screen.getByPlaceholderText("пошук")).toBeDefined();
		},
		TIMEOUT,
	);

	test(
		"narrows the list to the search it was given",
		async () => {
			await seedSet("Searchable pancakes");
			await seedSet("Unrelated topic");

			show(`#/sets?filter=${encodeURIComponent('{"q":"pancakes"}')}`);

			await eventually(() => {
				expect(screen.getByText("Searchable pancakes")).toBeDefined();
			});

			expect(screen.queryByText("Unrelated topic")).toBeNull();
		},
		TIMEOUT,
	);

	test(
		"lists questions from every set on one page",
		async () => {
			await seedSet("Alpha set");
			await seedSet("Beta set");

			show("#/questions");

			await eventually(() => {
				expect(
					screen.getByText(/Alpha set: which keyword declares a constant/),
				).toBeDefined();
			});

			expect(
				screen.getByText(/Beta set: which keyword declares a constant/),
			).toBeDefined();
		},
		TIMEOUT,
	);

	test(
		"shows the folders",
		async () => {
			await post("/api/folders", { name: "Shown folder" });

			show("#/folders");

			await eventually(() => {
				expect(screen.getByText("Shown folder")).toBeDefined();
			});
		},
		TIMEOUT,
	);

	test(
		"shows the global settings with the saved values",
		async () => {
			await put("/api/settings/global", {
				shuffleQuestions: true,
				intervalsDays: "1, 4, 9",
				maxIntervalDays: 60,
				maxRepetitions: 5,
			});

			show("#/settings/global");

			await eventually(() => {
				expect(screen.getByDisplayValue("1, 4, 9")).toBeDefined();
			});

			expect(screen.getByDisplayValue("60")).toBeDefined();
		},
		TIMEOUT,
	);

	test(
		"opens one question for editing with its options",
		async () => {
			const quizSetId = await seedSet("Editable set");
			const questions = (await (
				await api(`/api/questions?quizSetId=${quizSetId}`)
			).json()) as readonly { id: string }[];

			show(`#/questions/${questions[0]?.id}`);

			await eventually(() => {
				expect(screen.getByDisplayValue("const")).toBeDefined();
			});

			expect(screen.getByDisplayValue("let")).toBeDefined();
		},
		TIMEOUT,
	);

	test(
		"asks for the passphrase when the session is gone",
		async () => {
			const kept = cookie;

			cookie = "";

			try {
				show();

				await eventually(() => {
					expect(screen.getByLabelText("Пароль")).toBeDefined();
				});
			} finally {
				cookie = kept;
			}
		},
		TIMEOUT,
	);
});
