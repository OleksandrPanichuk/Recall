import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { QuizAttemptMode } from "@/domain/quiz-attempt/quiz-attempt";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { defaultQuizSettings } from "@/domain/settings/quiz-settings";
import {
	AttemptAlreadyInProgressError,
	QuizSetNotPublishedError,
} from "../attempts/start-quiz-attempt";
import { QuizSetNotFoundError } from "../quiz-sets/update-quiz-set";
import { quizScope } from "../settings/resolve-quiz-settings";
import {
	aQuestionInput,
	createPracticeHarness,
	type PracticeHarness,
	USER,
} from "./practice.fixture";
import { NothingToPracticeError } from "./start-practice-session";

let harness: PracticeHarness;

beforeEach(() => {
	harness = createPracticeHarness();
});

afterEach(() => {
	harness.context.close();
});

const startMistakes = (quizSetId: ReturnType<typeof toQuizSetId>) =>
	harness.practice.execute({
		quizSetId,
		telegramUserId: USER,
		mode: QuizAttemptMode.Mistakes,
	});

const startWeakTopics = (quizSetId: ReturnType<typeof toQuizSetId>) =>
	harness.practice.execute({
		quizSetId,
		telegramUserId: USER,
		mode: QuizAttemptMode.WeakTopics,
	});

describe("a mistakes session", () => {
	test("asks only the questions still answered wrong", async () => {
		const quizSetId = await harness.seedPublishedSet([
			aQuestionInput("One"),
			aQuestionInput("Two"),
			aQuestionInput("Three"),
		]);
		await harness.playAttempt(quizSetId, [true, false, false]);

		const result = await startMistakes(quizSetId);

		expect(result.questionCount).toBe(2);
		expect([...(await harness.plannedPrompts(quizSetId))].toSorted()).toEqual([
			"Three",
			"Two",
		]);
	});

	test("drops a question once it has been answered correctly", async () => {
		const quizSetId = await harness.seedPublishedSet([
			aQuestionInput("One"),
			aQuestionInput("Two"),
		]);
		await harness.playAttempt(quizSetId, [false, false]);
		await harness.playAttempt(quizSetId, [true, false]);

		await startMistakes(quizSetId);

		expect(await harness.plannedPrompts(quizSetId)).toEqual(["Two"]);
	});

	test("refuses when nothing is outstanding", async () => {
		const quizSetId = await harness.seedPublishedSet([aQuestionInput("One")]);
		await harness.playAttempt(quizSetId, [true]);

		await expect(startMistakes(quizSetId)).rejects.toThrow(
			NothingToPracticeError,
		);
	});

	test("refuses a set that was never taken", async () => {
		const quizSetId = await harness.seedPublishedSet([aQuestionInput("One")]);

		await expect(startMistakes(quizSetId)).rejects.toThrow(
			NothingToPracticeError,
		);
	});

	test("leaves another set's mistakes alone", async () => {
		const studied = await harness.seedPublishedSet([aQuestionInput("One")]);
		const other = await harness.seedPublishedSet([aQuestionInput("Two")]);
		await harness.playAttempt(other, [false]);

		await expect(startMistakes(studied)).rejects.toThrow(
			NothingToPracticeError,
		);
	});

	test("records the mode on the attempt", async () => {
		const quizSetId = await harness.seedPublishedSet([aQuestionInput("One")]);
		await harness.playAttempt(quizSetId, [false]);

		await startMistakes(quizSetId);

		expect(
			(await harness.context.scope.attempts.findActiveFor(USER))?.mode,
		).toBe(QuizAttemptMode.Mistakes);
	});
});

describe("a weak-topic session", () => {
	const seedTopics = async () =>
		harness.seedPublishedSet([
			aQuestionInput("W1", "Weak"),
			aQuestionInput("W2", "Weak"),
			aQuestionInput("W3", "Weak"),
			aQuestionInput("S1", "Strong"),
			aQuestionInput("S2", "Strong"),
			aQuestionInput("S3", "Strong"),
			aQuestionInput("U1"),
		]);

	test("asks every question of a topic that is mostly wrong", async () => {
		const quizSetId = await seedTopics();
		await harness.playAttempt(quizSetId, [
			false,
			false,
			false,
			true,
			true,
			true,
			false,
		]);

		const result = await startWeakTopics(quizSetId);

		expect(result.topics).toEqual(["Weak"]);
		expect([...(await harness.plannedPrompts(quizSetId))].toSorted()).toEqual([
			"W1",
			"W2",
			"W3",
		]);
	});

	test("includes a question of that topic you never reached", async () => {
		const quizSetId = await harness.seedPublishedSet([
			aQuestionInput("W1", "Weak"),
			aQuestionInput("W2", "Weak"),
			aQuestionInput("W3", "Weak"),
			aQuestionInput("W4", "Weak"),
		]);
		await harness.playAttempt(quizSetId, [false, false, false]);

		await startWeakTopics(quizSetId);

		expect([...(await harness.plannedPrompts(quizSetId))].toSorted()).toEqual([
			"W1",
			"W2",
			"W3",
			"W4",
		]);
	});

	test("refuses when no topic is weak enough", async () => {
		const quizSetId = await seedTopics();
		await harness.playAttempt(quizSetId, [
			true,
			true,
			true,
			true,
			true,
			true,
			true,
		]);

		await expect(startWeakTopics(quizSetId)).rejects.toThrow(
			NothingToPracticeError,
		);
	});

	test("refuses when the only weak questions carry no topic", async () => {
		const quizSetId = await harness.seedPublishedSet([
			aQuestionInput("U1"),
			aQuestionInput("U2"),
			aQuestionInput("U3"),
		]);
		await harness.playAttempt(quizSetId, [false, false, false]);

		await expect(startWeakTopics(quizSetId)).rejects.toThrow(
			NothingToPracticeError,
		);
	});

	test("records the mode on the attempt", async () => {
		const quizSetId = await seedTopics();
		await harness.playAttempt(quizSetId, [
			false,
			false,
			false,
			true,
			true,
			true,
			false,
		]);

		await startWeakTopics(quizSetId);

		expect(
			(await harness.context.scope.attempts.findActiveFor(USER))?.mode,
		).toBe(QuizAttemptMode.WeakTopics);
	});
});

describe("guards shared with a normal attempt", () => {
	test("refuses an unknown set", async () => {
		await expect(startMistakes(toQuizSetId("missing"))).rejects.toThrow(
			QuizSetNotFoundError,
		);
	});

	test("refuses a draft set", async () => {
		const quizSetId = await harness.seedDraftSet([aQuestionInput("One")]);

		await expect(startMistakes(quizSetId)).rejects.toThrow(
			QuizSetNotPublishedError,
		);
	});

	test("refuses an archived set", async () => {
		const quizSetId = await harness.seedPublishedSet([aQuestionInput("One")]);
		await harness.playAttempt(quizSetId, [false]);
		await harness.archive.execute({ quizSetId });

		await expect(startMistakes(quizSetId)).rejects.toThrow(
			QuizSetNotPublishedError,
		);
	});

	test("refuses while an attempt is still unfinished", async () => {
		const quizSetId = await harness.seedPublishedSet([
			aQuestionInput("One"),
			aQuestionInput("Two"),
		]);
		await harness.playAttempt(quizSetId, [false, false]);
		await startMistakes(quizSetId);

		await expect(startMistakes(quizSetId)).rejects.toThrow(
			AttemptAlreadyInProgressError,
		);
	});
});

describe("finishing a drill", () => {
	const scheduleOf = async (quizSetId: ReturnType<typeof toQuizSetId>) => {
		const questionId = (await harness.context.scope.quizzes.findById(quizSetId))
			?.questions[0]?.id;

		const [schedule] = await harness.context.scope.reviews.findSchedules(
			[questionId as never],
			USER,
		);

		return schedule;
	};

	test("leaves the repetition schedule exactly where it was", async () => {
		const quizSetId = await harness.seedPublishedSet([aQuestionInput("One")]);
		await harness.playAttempt(quizSetId, [false]);

		const before = await scheduleOf(quizSetId);

		await startMistakes(quizSetId);
		await harness.answerCurrent(true);
		harness.context.clock.advance(60_000);
		await harness.finish.execute({ telegramUserId: USER });

		expect(await scheduleOf(quizSetId)).toEqual(before);
	});

	test("still records the answer, so the mistake stops being outstanding", async () => {
		const quizSetId = await harness.seedPublishedSet([aQuestionInput("One")]);
		await harness.playAttempt(quizSetId, [false]);

		await startMistakes(quizSetId);
		await harness.answerCurrent(true);
		harness.context.clock.advance(60_000);
		await harness.finish.execute({ telegramUserId: USER });

		await expect(startMistakes(quizSetId)).rejects.toThrow(
			NothingToPracticeError,
		);
	});
});

describe("question order", () => {
	test("follows the shuffle setting", async () => {
		const quizSetId = await harness.seedPublishedSet(
			["One", "Two", "Three", "Four", "Five", "Six", "Seven"].map((prompt) =>
				aQuestionInput(prompt, "Weak"),
			),
		);
		await harness.playAttempt(quizSetId, [
			false,
			false,
			false,
			false,
			false,
			false,
			false,
		]);
		await harness.context.unitOfWork.run(({ reviews }) =>
			reviews.saveSettings(quizScope(quizSetId), {
				...defaultQuizSettings(),
				shuffleQuestions: true,
			}),
		);

		await startMistakes(quizSetId);

		expect(await harness.plannedPrompts(quizSetId)).not.toEqual(
			await harness.promptsOf(quizSetId),
		);
	});
});
