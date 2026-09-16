import { afterEach, describe, expect, test } from "bun:test";
import type { ScheduledQuestion } from "@recall/contracts";

const { cleanup, render, screen } = await import("@testing-library/react");
const { ScheduleSummary } = await import(
	"@/features/practice/ui/components/ScheduleSummary"
);
const { gradeCounts, groupByDue } = await import(
	"@/features/practice/ui/components/ScheduleSummary/ScheduleSummary.lib"
);

afterEach(() => {
	cleanup();
});

const today = new Date(2026, 8, 16, 15, 30);
const dueIn = (days: number): string =>
	new Date(2026, 8, 16 + days, 0, 0).toISOString();

const scheduled: readonly ScheduledQuestion[] = [
	{ questionId: "q1", prompt: "One", grade: "good", dueAt: dueIn(3) },
	{ questionId: "q2", prompt: "Two", grade: "again", dueAt: dueIn(1) },
	{ questionId: "q3", prompt: "Three", grade: "hard" },
	{ questionId: "q4", prompt: "Four", grade: "good", dueAt: dueIn(1) },
	{ questionId: "q5", prompt: "Five", grade: "easy", dueAt: dueIn(0) },
];

describe("counting the grades given", () => {
	test("counts every grade, with zero for the ones nobody gave", () => {
		expect(gradeCounts(scheduled)).toEqual({
			again: 1,
			hard: 1,
			good: 2,
			easy: 1,
		});
		expect(gradeCounts([])).toEqual({ again: 0, hard: 0, good: 0, easy: 0 });
	});
});

describe("grouping by when a question comes back", () => {
	test("groups soonest first and puts retired questions last", () => {
		expect(groupByDue(scheduled, today).map((group) => group.label)).toEqual([
			"Today",
			"Tomorrow",
			"In 3 days",
			"Retired",
		]);
	});

	test("keeps the prompts of each group in the order they were answered", () => {
		const groups = groupByDue(scheduled, today);

		expect(
			groups
				.find((group) => group.label === "Tomorrow")
				?.questions.map((question) => question.prompt),
		).toEqual(["Two", "Four"]);
		expect(
			groups
				.find((group) => group.label === "Retired")
				?.questions.map((question) => question.prompt),
		).toEqual(["Three"]);
	});

	test("a question already due, or overdue, is due today", () => {
		const overdue = new Date(2026, 8, 10, 0, 0).toISOString();

		expect(
			groupByDue(
				[{ questionId: "q", prompt: "Late", grade: "again", dueAt: overdue }],
				today,
			).map((group) => group.label),
		).toEqual(["Today"]);
	});

	test("counts calendar days, not elapsed hours", () => {
		const lateTonight = new Date(2026, 8, 16, 23, 59);

		expect(
			groupByDue(
				[{ questionId: "q", prompt: "Soon", grade: "good", dueAt: dueIn(1) }],
				lateTonight,
			).map((group) => group.label),
		).toEqual(["Tomorrow"]);
	});

	test("does not touch the date it was given", () => {
		const given = new Date(today.getTime());

		groupByDue(scheduled, given);

		expect(given.getTime()).toBe(today.getTime());
	});

	test("nothing scheduled means no groups", () => {
		expect(groupByDue([], today)).toEqual([]);
	});
});

describe("rendering the schedule summary", () => {
	test("renders nothing for an empty list", () => {
		const { container } = render(
			<ScheduleSummary scheduled={[]} today={today} />,
		);

		expect(container.innerHTML).toBe("");
	});

	test("shows the group headings and the grades that were given", () => {
		render(<ScheduleSummary scheduled={scheduled} today={today} />);

		expect(screen.getByText("Today")).toBeTruthy();
		expect(screen.getByText("Tomorrow")).toBeTruthy();
		expect(screen.getByText("In 3 days")).toBeTruthy();
		expect(screen.getByText("Retired")).toBeTruthy();
		expect(screen.getByText("One")).toBeTruthy();
		expect(screen.getByText("Good")).toBeTruthy();
		expect(screen.getByText("Again")).toBeTruthy();
	});

	test("leaves out a grade nobody gave", () => {
		render(
			<ScheduleSummary
				scheduled={[
					{ questionId: "q", prompt: "One", grade: "good", dueAt: dueIn(1) },
				]}
				today={today}
			/>,
		);

		expect(screen.getByText("Good")).toBeTruthy();
		expect(screen.queryByText("Again")).toBeNull();
		expect(screen.queryByText("Hard")).toBeNull();
		expect(screen.queryByText("Easy")).toBeNull();
	});
});
