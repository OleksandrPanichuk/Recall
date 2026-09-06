import { describe, expect, test } from "bun:test";
import {
	answers,
	counted,
	days,
	pages,
	questions,
	quizzes,
} from "@/shared/lib/plural";

describe("counting things in the interface", () => {
	test("one is singular and everything else is not", () => {
		expect(questions(1)).toBe("1 question");
		expect(questions(2)).toBe("2 questions");
		expect(questions(21)).toBe("21 questions");
	});

	test("zero is plural, as English has it", () => {
		expect(questions(0)).toBe("0 questions");
		expect(answers(0)).toBe("0 answers");
	});

	test("quiz takes -es, which the default rule would get wrong", () => {
		expect(quizzes(1)).toBe("1 quiz");
		expect(quizzes(8)).toBe("8 quizzes");
	});

	test("the plain words behave", () => {
		expect(pages(1)).toBe("1 page");
		expect(pages(3)).toBe("3 pages");
		expect(days(1)).toBe("1 day");
		expect(days(19)).toBe("19 days");
	});

	test("counted takes an irregular plural when one is given", () => {
		expect(counted(1, "person", "people")).toBe("1 person");
		expect(counted(4, "person", "people")).toBe("4 people");
	});
});
