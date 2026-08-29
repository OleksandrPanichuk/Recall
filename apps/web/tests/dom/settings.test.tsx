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

const open = () => {
	const changes: Record<string, unknown>[] = [];

	render(
		<SettingsForm
			resolved={resolved}
			state="idle"
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
