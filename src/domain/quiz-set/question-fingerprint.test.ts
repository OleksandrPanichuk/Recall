import { describe, expect, test } from "bun:test";
import { createQuestion } from "./create-question";
import {
	Difficulty,
	type Question,
	QuestionType,
	toQuestionId,
	toQuestionOptionId,
} from "./question";
import { questionFingerprint } from "./question-fingerprint";

const option = (text: string, isCorrect: boolean, position: number) => ({
	id: toQuestionOptionId(`option-${position}`),
	text,
	isCorrect,
	position,
});

const validDraft = {
	id: toQuestionId("question-1"),
	type: QuestionType.SingleChoice,
	prompt: "  What does replication improve?  ",
	difficulty: Difficulty.Medium,
	position: 0,
	options: [option("Availability", true, 0), option("Index size", false, 1)],
	explanation: "  Replication keeps copies on several nodes.  ",
	topic: "   ",
};

describe("questionFingerprint", () => {
	test("is equal for identical content", () => {
		expect(questionFingerprint(createQuestion(validDraft))).toBe(
			questionFingerprint(
				createQuestion({
					...validDraft,
					id: toQuestionId("question-2"),
					position: 3,
				}),
			),
		);
	});

	test("is equal for reordered options", () => {
		const reordered = createQuestion({
			...validDraft,
			options: [
				option("Index size", false, 0),
				option("Availability", true, 1),
			],
		});

		expect(questionFingerprint(reordered)).toBe(
			questionFingerprint(createQuestion(validDraft)),
		);
	});

	test("differs when a correct flag changes", () => {
		const flipped = createQuestion({
			...validDraft,
			options: [
				option("Availability", false, 0),
				option("Index size", true, 1),
			],
		});

		expect(questionFingerprint(flipped)).not.toBe(
			questionFingerprint(createQuestion(validDraft)),
		);
	});

	test("differs when option text contains the canonical delimiters", () => {
		const separateOptions = createQuestion({
			...validDraft,
			type: QuestionType.MultipleChoice,
			prompt: "q",
			options: [
				option("b", false, 0),
				option("c", true, 1),
				option("d", false, 2),
			],
		});
		const injectedDelimiters = createQuestion({
			...validDraft,
			type: QuestionType.MultipleChoice,
			prompt: "q",
			options: [option("b:0\nc", true, 0), option("d", false, 1)],
		});

		expect(questionFingerprint(injectedDelimiters)).not.toBe(
			questionFingerprint(separateOptions),
		);
	});

	test("differs when only the type changes", () => {
		const singleChoice = createQuestion(validDraft);
		const multipleChoice = createQuestion({
			...validDraft,
			type: QuestionType.MultipleChoice,
		});

		expect(questionFingerprint(multipleChoice)).not.toBe(
			questionFingerprint(singleChoice),
		);
	});

	test("differs when the prompt changes", () => {
		const other = createQuestion({
			...validDraft,
			prompt: "What does sharding improve?",
		});

		expect(questionFingerprint(other)).not.toBe(
			questionFingerprint(createQuestion(validDraft)),
		);
	});
});

describe("order-bearing questions", () => {
	const ordering = (texts: readonly string[]): Question =>
		createQuestion({
			id: toQuestionId("q-order"),
			type: QuestionType.Ordering,
			prompt: "Build it",
			difficulty: Difficulty.Easy,
			position: 0,
			options: texts.map((text, index) => ({
				id: toQuestionOptionId(`o-${text}`),
				text,
				isCorrect: true,
				position: index,
			})),
		});

	const matching = (keys: readonly string[]): Question =>
		createQuestion({
			id: toQuestionId("q-match"),
			type: QuestionType.Matching,
			prompt: "Match",
			difficulty: Difficulty.Easy,
			position: 0,
			options: ["cat", "dog", "кіт", "пес"].map((text, index) => ({
				id: toQuestionOptionId(`o-${text}`),
				text,
				isCorrect: true,
				position: index,
				matchKey: keys[index],
			})),
		});

	test("a different correct order is a different question", () => {
		expect(questionFingerprint(ordering(["a", "b", "c"]))).not.toBe(
			questionFingerprint(ordering(["a", "c", "b"])),
		);
	});

	test("the same order is the same question", () => {
		expect(questionFingerprint(ordering(["a", "b", "c"]))).toBe(
			questionFingerprint(ordering(["a", "b", "c"])),
		);
	});

	test("a different pairing is a different question", () => {
		expect(questionFingerprint(matching(["p0", "p1", "p0", "p1"]))).not.toBe(
			questionFingerprint(matching(["p0", "p1", "p1", "p0"])),
		);
	});

	test("a reordered single choice is still the same question", () => {
		const build = (texts: readonly string[]): Question =>
			createQuestion({
				id: toQuestionId("q-single"),
				type: QuestionType.SingleChoice,
				prompt: "Pick",
				difficulty: Difficulty.Easy,
				position: 0,
				options: texts.map((text, index) => ({
					id: toQuestionOptionId(`o-${text}`),
					text,
					isCorrect: text === "a",
					position: index,
				})),
			});

		expect(questionFingerprint(build(["a", "b"]))).toBe(
			questionFingerprint(build(["b", "a"])),
		);
	});
});
