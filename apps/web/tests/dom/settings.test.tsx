import { afterEach, describe, expect, test } from "bun:test";
import type { ResolvedQuizSettings } from "@recall/contracts";

const { cleanup, fireEvent, render, screen } = await import(
	"@testing-library/react"
);
const { SettingsForm } = await import("@/components/SettingsForm");

afterEach(() => {
	cleanup();
});

const resolved: ResolvedQuizSettings = {
	source: "global",
	settings: {
		repetition: {
			intervalsDays: [1, 3, 7],
			maxIntervalDays: 30,
			maxRepetitions: 5,
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
					intervalsDays: [2, 5, 14],
					maxIntervalDays: 30,
					maxRepetitions: 5,
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
					intervalsDays: [1, 3, 7],
					maxIntervalDays: 30,
					maxRepetitions: 5,
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
