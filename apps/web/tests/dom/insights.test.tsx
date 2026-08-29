import { afterEach, describe, expect, test } from "bun:test";
import type { DailyActivity, QuestionStat } from "@recall/contracts";

const { cleanup, render, screen } = await import("@testing-library/react");
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { ActivityHeatmap } = await import("@/components/ActivityHeatmap");
const { DueForecast } = await import("@/components/DueForecast");
const { HardestQuestions } = await import("@/components/HardestQuestions");
const { HEATMAP_WEEKS, heatmapWeeks, levelOf, forecastDays } = await import(
	"@/lib/insights"
);

afterEach(() => {
	cleanup();
});

const today = new Date("2026-08-29T12:00:00.000Z");

const routed = (element: React.ReactNode) =>
	render(
		<RouterProvider
			router={createRouter({
				routeTree: createRootRoute({ component: () => element }),
				history: createMemoryHistory({ initialEntries: ["/"] }),
			})}
		/>,
	);

describe("heatmap shaping", () => {
	const activity: DailyActivity[] = [
		{ day: "2026-08-28", attempts: 1, answered: 10, correct: 8 },
		{ day: "2026-08-29", attempts: 1, answered: 2, correct: 2 },
	];

	test("covers whole weeks, ending on the week that holds today", () => {
		const weeks = heatmapWeeks(activity, today);

		expect(weeks).toHaveLength(HEATMAP_WEEKS);
		expect(weeks.every((week) => week.length === 7)).toBe(true);
		expect(weeks.flat().some((cell) => cell.day === "2026-08-29")).toBe(true);
	});

	test("puts the busiest day at the top step and a quiet day below it", () => {
		const cells = heatmapWeeks(activity, today).flat();
		const busiest = cells.find((cell) => cell.day === "2026-08-28");
		const quiet = cells.find((cell) => cell.day === "2026-08-29");

		expect(busiest?.level).toBe(5);
		expect(quiet?.level).toBeLessThan(5);
		expect(quiet?.level).toBeGreaterThan(0);
	});

	test("a day with nothing answered is the empty step, not the lightest colour", () => {
		expect(levelOf(0, 10)).toBe(0);
		expect(levelOf(1, 10)).toBeGreaterThan(0);
	});

	test("a single answered day does not read as the whole scale", () => {
		expect(levelOf(1, 1)).toBe(3);
	});

	test("names each day and its count for a screen reader", () => {
		render(<ActivityHeatmap activity={activity} today={today} />);

		expect(screen.getByLabelText("28 серпня: 10 відповідей")).toBeDefined();
	});
});

describe("the due forecast", () => {
	test("fills the days nothing is due, so the axis stays even", () => {
		const days = forecastDays([{ day: "2026-08-31", due: 3 }], today, 14);

		expect(days).toHaveLength(14);
		expect(days[0]).toEqual({ day: "2026-08-29", due: 0 });
		expect(days[2]).toEqual({ day: "2026-08-31", due: 3 });
	});

	test("rolls anything overdue into today rather than hiding it", () => {
		const days = forecastDays(
			[
				{ day: "2026-08-20", due: 4 },
				{ day: "2026-08-29", due: 1 },
			],
			today,
			14,
		);

		expect(days[0]).toEqual({ day: "2026-08-29", due: 5 });
	});

	test("says so when the fortnight is empty instead of drawing a flat chart", () => {
		render(<DueForecast forecast={[]} today={today} />);

		expect(
			screen.getByText("Найближчим часом нічого не повертається."),
		).toBeDefined();
	});
});

describe("the hardest questions", () => {
	const stat = (prompt: string, correct: number): QuestionStat => ({
		questionId: `q-${prompt}`,
		quizSetId: "quiz-1",
		quizSetTitle: "Клітина",
		prompt,
		answered: 4,
		correct,
		lapses: 0,
	});

	test("shows the accuracy of each question against its set", async () => {
		routed(<HardestQuestions hardest={[stat("Hard one", 1)]} />);

		expect(await screen.findByText("25%")).toBeDefined();
		expect(await screen.findByText("Клітина")).toBeDefined();
		expect(await screen.findByText(/1 з 4/)).toBeDefined();
	});

	test("says when there is not enough evidence yet", async () => {
		routed(<HardestQuestions hardest={[]} />);

		expect(await screen.findByText(/Замало відповідей/)).toBeDefined();
	});
});
