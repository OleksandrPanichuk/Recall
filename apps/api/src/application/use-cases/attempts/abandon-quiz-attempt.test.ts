import { beforeEach, describe, expect, test } from "bun:test";
import {
	AbandonQuizAttemptUseCase,
	AttemptAlreadyFinishedError,
} from "./abandon-quiz-attempt";
import {
	type AttemptsHarness,
	createAttemptsHarness,
} from "./attempts.fixture";
import { AttemptAlreadyInProgressError } from "./start-quiz-attempt";

let harness: AttemptsHarness;
let abandon: AbandonQuizAttemptUseCase;

beforeEach(() => {
	harness = createAttemptsHarness();
	abandon = new AbandonQuizAttemptUseCase(harness.context);
});

describe("abandoning an attempt", () => {
	test("unblocks a different quiz set", async () => {
		const first = await harness.seedPublishedSet(["One", "Two"]);
		const second = await harness.seedPublishedSet(["Three"]);

		await harness.start.execute({ quizSetId: first });

		expect(harness.start.execute({ quizSetId: second })).rejects.toThrow(
			AttemptAlreadyInProgressError,
		);

		expect(await abandon.execute({})).toEqual({ abandoned: true });

		const started = await harness.start.execute({ quizSetId: second });

		expect(started.resumed).toBe(false);
	});

	test("names the attempt and the set it belongs to, so a caller can offer a way out", async () => {
		const first = await harness.seedPublishedSet(["One"]);
		const second = await harness.seedPublishedSet(["Two"]);
		const active = await harness.start.execute({ quizSetId: first });

		const refusal = await harness.start
			.execute({ quizSetId: second })
			.then(() => undefined)
			.catch((error: unknown) => error as AttemptAlreadyInProgressError);

		expect(refusal).toBeInstanceOf(AttemptAlreadyInProgressError);
		expect(String(refusal?.attemptId)).toBe(String(active.attemptId));
		expect(String(refusal?.quizSetId)).toBe(String(first));
	});

	test("leaves nothing behind for the statistics to count", async () => {
		const quizSetId = await harness.seedPublishedSet(["One", "Two"]);
		const { attemptId } = await harness.start.execute({ quizSetId });

		await harness.answer.execute({
			questionId: await harness.questionIdOf(quizSetId, 0),
			selectedOptionPositions: [await harness.positionOf(quizSetId, 0, true)],
		});
		await abandon.execute({});

		expect(
			await harness.context.scope.attempts.findById(attemptId),
		).toBeUndefined();
		expect(
			await harness.context.scope.attempts.listCompletedForQuiz(quizSetId),
		).toEqual([]);
	});

	test("says so when there was nothing to abandon", async () => {
		expect(await abandon.execute({})).toEqual({ abandoned: false });
	});

	test("refuses to throw away a finished attempt", async () => {
		const quizSetId = await harness.seedPublishedSet(["One"]);
		const { attemptId } = await harness.start.execute({ quizSetId });

		await harness.answer.execute({
			questionId: await harness.questionIdOf(quizSetId, 0),
			selectedOptionPositions: [await harness.positionOf(quizSetId, 0, true)],
		});
		await harness.finish.execute({});

		expect(abandon.execute({ attemptId })).rejects.toThrow(
			AttemptAlreadyFinishedError,
		);
	});
});
