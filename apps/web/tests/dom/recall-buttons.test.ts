import { describe, expect, test } from "bun:test";
import {
	RECALL_GRADE_LABELS,
	RECALL_GRADES,
} from "@/features/practice/constants/recall-grades";
import { RECALL_CHOICES } from "@/features/practice/ui/components/RecallButtons/RecallButtons.constants";

describe("what a learner may say about a recall", () => {
	test("three choices, and never Again", () => {
		expect(RECALL_CHOICES.map((choice) => choice.grade)).toEqual([
			"hard",
			"good",
			"easy",
		]);
	});

	test("they read hardest to easiest, so the row matches the intervals", () => {
		expect(RECALL_CHOICES[0]?.grade).toBe("hard");
		expect(RECALL_CHOICES.at(-1)?.grade).toBe("easy");
	});

	test("every choice says what it means, not only what it is called", () => {
		for (const choice of RECALL_CHOICES) {
			expect(choice.label.length).toBeGreaterThan(0);
			expect(choice.caption.length).toBeGreaterThan(0);
		}
	});

	test("a button says the same word the finish screen does", () => {
		for (const choice of RECALL_CHOICES) {
			expect(choice.label).toBe(RECALL_GRADE_LABELS[choice.grade]);
		}
	});

	test("the four grades run from Again to Easy, and every one has a label", () => {
		expect(RECALL_GRADES).toEqual(["again", "hard", "good", "easy"]);
		for (const grade of RECALL_GRADES) {
			expect(RECALL_GRADE_LABELS[grade].length).toBeGreaterThan(0);
		}
	});
});
