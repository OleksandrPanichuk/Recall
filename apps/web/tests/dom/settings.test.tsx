import { afterEach, describe, expect, test } from "bun:test";
import type { ResolvedQuizSettings } from "@recall/contracts";

const { cleanup, fireEvent, render, screen } = await import(
	"@testing-library/react"
);
const { SettingsForm } = await import(
	"@/features/settings/ui/components/SettingsForm"
);

afterEach(() => {
	cleanup();
});

const resolved: ResolvedQuizSettings = {
	source: "global",
	settings: {
		repetition: {
			scheduler: "ladder",
			intervalsDays: [1, 3, 7],
			maxIntervalDays: 30,
			maxRepetitions: 5,
			desiredRetention: 0.9,
		},
		shuffleOptions: true,
		shuffleQuestions: false,
		examMode: false,
	},
};

const open = (over: Partial<ResolvedQuizSettings> = {}, scoped = false) => {
	const changes: Record<string, unknown>[] = [];

	render(
		<SettingsForm
			resolved={{ ...resolved, ...over }}
			state="idle"
			scoped={scoped}
			onChange={(change) => changes.push(change)}
		/>,
	);

	return changes;
};

describe("quiz settings", () => {
	test("says where the settings came from", () => {
		open();

		expect(screen.getByText(/спільні налаштування/)).toBeDefined();
	});

	test("reports a toggle as the single field that changed", () => {
		const changes = open();

		fireEvent.click(screen.getByLabelText("Режим іспиту"));

		expect(changes).toEqual([{ examMode: true }]);
	});

	test("turns a written list of days into intervals", () => {
		const changes = open();
		const field = screen.getByLabelText("Інтервали повторення, дні");

		fireEvent.change(field, { target: { value: "2, 5, 14" } });
		fireEvent.blur(field);

		expect(changes).toEqual([
			{
				repetition: {
					scheduler: "ladder",
					intervalsDays: [2, 5, 14],
					maxIntervalDays: 30,
					maxRepetitions: 5,
					desiredRetention: 0.9,
				},
			},
		]);
	});

	test("refuses an unreadable list and puts the old one back", () => {
		const changes = open();
		const field = screen.getByLabelText("Інтервали повторення, дні");

		fireEvent.change(field, { target: { value: "хтозна" } });
		fireEvent.blur(field);

		expect(changes).toEqual([]);
		expect((field as HTMLInputElement).value).toBe("1, 3, 7");
	});
});

describe("a single set's settings", () => {
	const OWN = "Власні налаштування для цього набору";

	test("is not offered at all when editing the shared settings", () => {
		open();

		expect(screen.queryByLabelText(OWN)).toBeNull();
	});

	test("shows the set as inheriting until it has its own", () => {
		open({ source: "global" }, true);

		expect((screen.getByLabelText(OWN) as HTMLInputElement).checked).toBe(
			false,
		);
		expect(screen.getByText(/використовує спільні налаштування/)).toBeDefined();
	});

	test("taking ownership writes the values the set is inheriting", () => {
		const changes = open({ source: "global" }, true);

		fireEvent.click(screen.getByLabelText(OWN));

		expect(changes).toEqual([
			{
				shuffleOptions: true,
				shuffleQuestions: false,
				examMode: false,
				repetition: {
					scheduler: "ladder",
					intervalsDays: [1, 3, 7],
					maxIntervalDays: 30,
					maxRepetitions: 5,
					desiredRetention: 0.9,
				},
			},
		]);
	});

	test("giving it up asks to inherit again, and sends nothing else", () => {
		const changes = open({ source: "set" }, true);

		expect((screen.getByLabelText(OWN) as HTMLInputElement).checked).toBe(true);

		fireEvent.click(screen.getByLabelText(OWN));

		expect(changes).toEqual([{ inheritGlobal: true }]);
	});

	test("changing one toggle still sends only that toggle", () => {
		const changes = open({ source: "global" }, true);

		fireEvent.click(screen.getByLabelText("Режим іспиту"));

		expect(changes).toEqual([{ examMode: true }]);
	});
});

describe("choosing a scheduler", () => {
	const fsrs = (over: Partial<ResolvedQuizSettings> = {}) =>
		open({
			...over,
			settings: {
				...resolved.settings,
				repetition: { ...resolved.settings.repetition, scheduler: "fsrs" },
			},
		});

	test("the ladder is shown as chosen, and fsrs is not", () => {
		open();

		expect(
			screen
				.getByRole("button", { name: /Сходинка/ })
				.getAttribute("aria-pressed"),
		).toBe("true");
		expect(
			screen.getByRole("button", { name: /FSRS/ }).getAttribute("aria-pressed"),
		).toBe("false");
	});

	test("picking fsrs sends the whole repetition block, not a bare field", () => {
		const changes = open();

		fireEvent.click(screen.getByRole("button", { name: /FSRS/ }));

		expect(changes).toEqual([
			{
				repetition: {
					scheduler: "fsrs",
					intervalsDays: [1, 3, 7],
					maxIntervalDays: 30,
					maxRepetitions: 5,
					desiredRetention: 0.9,
				},
			},
		]);
	});

	test("the intervals field is gone once fsrs computes them", () => {
		fsrs();

		expect(screen.queryByLabelText("Інтервали повторення, дні")).toBeNull();
	});

	test("retention is offered only under fsrs", () => {
		open();

		expect(screen.queryByRole("button", { name: "90%" })).toBeNull();

		cleanup();
		fsrs();

		expect(
			screen.getByRole("button", { name: "90%" }).getAttribute("aria-pressed"),
		).toBe("true");
	});

	test("a different retention is sent as a whole repetition block", () => {
		const changes = fsrs();

		fireEvent.click(screen.getByRole("button", { name: "95%" }));

		expect(changes).toEqual([
			{
				repetition: {
					scheduler: "fsrs",
					intervalsDays: [1, 3, 7],
					maxIntervalDays: 30,
					maxRepetitions: 5,
					desiredRetention: 0.95,
				},
			},
		]);
	});
});
