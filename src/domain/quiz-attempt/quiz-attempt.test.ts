import { describe, expect, test } from "bun:test";
import {
	type QuestionId,
	type QuestionOptionId,
	toQuestionId,
	toQuestionOptionId,
} from "../quiz-set/question";
import { toQuizSetId } from "../quiz-set/quiz-set";
import {
	attemptScore,
	completeQuizAttempt,
	currentQuestionId,
	isQuizAttemptMode,
	isQuizAttemptStatus,
	pauseQuizAttempt,
	type QuestionResponse,
	type QuizAttempt,
	QuizAttemptMode,
	QuizAttemptStatus,
	recordResponse,
	restoreQuizAttempt,
	resumeQuizAttempt,
	startQuizAttempt,
	toQuizAttemptId,
} from "./quiz-attempt";
import {
	DuplicateResponseError,
	EmptyQuizAttemptError,
	QuestionNotInAttemptError,
	QuizAttemptTransitionError,
	QuizAttemptValidationError,
} from "./quiz-attempt.errors";

const startedAt = new Date("2026-08-01T10:00:00.000Z");
const laterAt = new Date("2026-08-01T11:00:00.000Z");
const evenLaterAt = new Date("2026-08-01T12:00:00.000Z");
const earlierAt = new Date("2026-07-31T10:00:00.000Z");
const invalidDate = new Date("not a date");

const firstQuestionId = toQuestionId("question-1");
const secondQuestionId = toQuestionId("question-2");
const unplannedQuestionId = toQuestionId("question-99");

const validDraft = {
	id: toQuizAttemptId("attempt-1"),
	quizSetId: toQuizSetId("quiz-set-1"),
	telegramUserId: 42,
	mode: QuizAttemptMode.Full,
	questionIds: [firstQuestionId, secondQuestionId],
	startedAt,
};

type QuizAttemptDraft = Parameters<typeof startQuizAttempt>[0];

const issuesOf = (draft: QuizAttemptDraft): readonly string[] => {
	try {
		startQuizAttempt(draft);
	} catch (caught) {
		expect(caught).toBeInstanceOf(QuizAttemptValidationError);

		return (caught as QuizAttemptValidationError).issues;
	}

	throw new Error("expected startQuizAttempt to throw");
};

const answer = (
	questionId: QuestionId,
	isCorrect: boolean,
	answeredAt: Date,
	selectedOptionIds: readonly QuestionOptionId[] = [
		toQuestionOptionId(`${questionId}-option-0`),
	],
): QuestionResponse => ({
	questionId,
	selectedOptionIds,
	isCorrect,
	answeredAt,
});

const activeAttempt = (): QuizAttempt => startQuizAttempt(validDraft);

const answeredOnce = (isCorrect = true): QuizAttempt =>
	recordResponse(activeAttempt(), answer(firstQuestionId, isCorrect, laterAt));

describe("QuizAttempt", () => {
	describe("isQuizAttemptStatus", () => {
		test.each(Object.values(QuizAttemptStatus))("accepts %p", (value) => {
			expect(isQuizAttemptStatus(value)).toBe(true);
		});

		test.each([
			"abandoned",
			"",
			"Active",
			undefined,
			null,
			0,
			1,
			{},
			[["active"]],
		])("rejects %p", (value) => {
			expect(isQuizAttemptStatus(value)).toBe(false);
		});
	});

	describe("isQuizAttemptMode", () => {
		test.each(Object.values(QuizAttemptMode))("accepts %p", (value) => {
			expect(isQuizAttemptMode(value)).toBe(true);
		});

		test.each([
			"weakTopics",
			"",
			"Full",
			undefined,
			null,
			0,
			1,
			{},
			[["full"]],
		])("rejects %p", (value) => {
			expect(isQuizAttemptMode(value)).toBe(false);
		});
	});

	describe("startQuizAttempt", () => {
		test("starts active with no responses", () => {
			const attempt = activeAttempt();

			expect(attempt.status).toBe(QuizAttemptStatus.Active);
			expect(attempt.responses).toHaveLength(0);
			expect(attempt.mode).toBe(QuizAttemptMode.Full);
			expect(attempt.questionIds).toEqual([firstQuestionId, secondQuestionId]);
			expect(attempt.startedAt).toEqual(startedAt);
			expect(attempt.updatedAt).toEqual(startedAt);
			expect(attempt.completedAt).toBeUndefined();
		});

		test("returns a deeply frozen attempt", () => {
			const attempt = activeAttempt();

			expect(Object.isFrozen(attempt)).toBe(true);
			expect(Object.isFrozen(attempt.questionIds)).toBe(true);
			expect(Object.isFrozen(attempt.responses)).toBe(true);
		});

		test("does not alias the caller's questionIds", () => {
			const questionIds = [firstQuestionId];
			const attempt = startQuizAttempt({ ...validDraft, questionIds });

			expect(Object.isFrozen(questionIds)).toBe(false);

			questionIds.push(secondQuestionId);

			expect(attempt.questionIds).toEqual([firstQuestionId]);
		});

		test("copies startedAt so later mutation cannot reach the attempt", () => {
			const mutable = new Date(startedAt.getTime());
			const attempt = startQuizAttempt({ ...validDraft, startedAt: mutable });

			mutable.setFullYear(1999);

			expect(attempt.startedAt).toEqual(startedAt);
			expect(attempt.updatedAt).toEqual(startedAt);
		});

		test("rejects an empty plan", () => {
			expect(() =>
				startQuizAttempt({ ...validDraft, questionIds: [] }),
			).toThrow(EmptyQuizAttemptError);
			expect(() =>
				startQuizAttempt({ ...validDraft, questionIds: [] }),
			).toThrow("An attempt requires at least one question");
		});

		test("rejects duplicate question ids", () => {
			expect(
				issuesOf({
					...validDraft,
					questionIds: [firstQuestionId, firstQuestionId],
				}),
			).toEqual(["questionIds must not contain duplicates"]);
		});

		test.each([
			0,
			-1,
			1.5,
			Number.NaN,
			Number.MAX_SAFE_INTEGER + 2,
		])("rejects the telegramUserId %p", (telegramUserId) => {
			expect(issuesOf({ ...validDraft, telegramUserId })).toEqual([
				"telegramUserId must be a positive integer",
			]);
		});

		test("rejects an invalid startedAt", () => {
			expect(issuesOf({ ...validDraft, startedAt: invalidDate })).toEqual([
				"startedAt must be a valid date",
			]);
		});

		test("reports every issue at once in the documented order", () => {
			expect(
				issuesOf({
					...validDraft,
					telegramUserId: 0,
					questionIds: [firstQuestionId, firstQuestionId],
					startedAt: invalidDate,
				}),
			).toEqual([
				"telegramUserId must be a positive integer",
				"questionIds must not contain duplicates",
				"startedAt must be a valid date",
			]);
		});

		test("names every issue in the error message", () => {
			expect(() =>
				startQuizAttempt({ ...validDraft, telegramUserId: 0 }),
			).toThrow(
				"Invalid quiz attempt:\n- telegramUserId must be a positive integer",
			);
		});

		test("reports the empty plan before the other issues", () => {
			expect(() =>
				startQuizAttempt({
					...validDraft,
					questionIds: [],
					telegramUserId: 0,
				}),
			).toThrow(EmptyQuizAttemptError);
		});
	});

	describe("currentQuestionId", () => {
		test("points at the first planned question initially", () => {
			expect(currentQuestionId(activeAttempt())).toBe(firstQuestionId);
		});

		test("advances to the second question after one response", () => {
			expect(currentQuestionId(answeredOnce())).toBe(secondQuestionId);
		});

		test("is undefined once every planned question is answered", () => {
			const answered = recordResponse(
				answeredOnce(),
				answer(secondQuestionId, false, evenLaterAt),
			);

			expect(currentQuestionId(answered)).toBeUndefined();
		});
	});

	describe("recordResponse", () => {
		test("appends the response and advances the current question", () => {
			const attempt = answeredOnce();

			expect(attempt.responses).toHaveLength(1);
			expect(attempt.responses[0]?.questionId).toBe(firstQuestionId);
			expect(attempt.responses[0]?.answeredAt).toEqual(laterAt);
			expect(attempt.updatedAt).toEqual(laterAt);
			expect(currentQuestionId(attempt)).toBe(secondQuestionId);
		});

		test("does not mutate the input attempt", () => {
			const attempt = activeAttempt();

			recordResponse(attempt, answer(firstQuestionId, true, laterAt));

			expect(attempt.responses).toHaveLength(0);
			expect(attempt.updatedAt).toEqual(startedAt);
		});

		test("deeply freezes the stored response", () => {
			const attempt = answeredOnce();
			const stored = attempt.responses[0];

			expect(Object.isFrozen(attempt.responses)).toBe(true);
			expect(Object.isFrozen(stored)).toBe(true);
			expect(Object.isFrozen(stored?.selectedOptionIds)).toBe(true);
		});

		test("does not alias the caller's selectedOptionIds", () => {
			const selectedOptionIds = [toQuestionOptionId("option-a")];
			const attempt = recordResponse(
				activeAttempt(),
				answer(firstQuestionId, true, laterAt, selectedOptionIds),
			);

			expect(Object.isFrozen(selectedOptionIds)).toBe(false);

			selectedOptionIds.push(toQuestionOptionId("option-b"));

			expect(attempt.responses[0]?.selectedOptionIds).toHaveLength(1);
		});

		test("copies answeredAt so later mutation cannot reach the attempt", () => {
			const mutable = new Date(laterAt.getTime());
			const attempt = recordResponse(
				activeAttempt(),
				answer(firstQuestionId, true, mutable),
			);

			mutable.setFullYear(1999);

			expect(attempt.responses[0]?.answeredAt).toEqual(laterAt);
			expect(attempt.updatedAt).toEqual(laterAt);
		});

		test("rejects a second response for the same question", () => {
			const attempt = answeredOnce();

			expect(() =>
				recordResponse(attempt, answer(firstQuestionId, true, evenLaterAt)),
			).toThrow(DuplicateResponseError);
			expect(() =>
				recordResponse(attempt, answer(firstQuestionId, true, evenLaterAt)),
			).toThrow("An attempt cannot answer the same question twice");
		});

		test("rejects a replay that carries a different selection", () => {
			const attempt = answeredOnce();

			expect(() =>
				recordResponse(
					attempt,
					answer(firstQuestionId, false, evenLaterAt, [
						toQuestionOptionId("option-z"),
						toQuestionOptionId("option-y"),
					]),
				),
			).toThrow(DuplicateResponseError);
		});

		test("rejects a question outside the plan", () => {
			expect(() =>
				recordResponse(
					activeAttempt(),
					answer(unplannedQuestionId, true, laterAt),
				),
			).toThrow(QuestionNotInAttemptError);
			expect(() =>
				recordResponse(
					activeAttempt(),
					answer(unplannedQuestionId, true, laterAt),
				),
			).toThrow("An attempt can only answer its current planned question");
		});

		test("rejects answering out of order", () => {
			expect(() =>
				recordResponse(
					activeAttempt(),
					answer(secondQuestionId, true, laterAt),
				),
			).toThrow(QuestionNotInAttemptError);
		});

		test("rejects an empty selection", () => {
			expect(() =>
				recordResponse(
					activeAttempt(),
					answer(firstQuestionId, false, laterAt, []),
				),
			).toThrow("Invalid quiz attempt:\n- selectedOptionIds must not be empty");
		});

		test("rejects duplicate selected option ids", () => {
			const repeated = toQuestionOptionId("option-a");

			expect(() =>
				recordResponse(
					activeAttempt(),
					answer(firstQuestionId, false, laterAt, [repeated, repeated]),
				),
			).toThrow(
				"Invalid quiz attempt:\n- selectedOptionIds must not contain duplicates",
			);
		});

		test("rejects an invalid answeredAt", () => {
			expect(() =>
				recordResponse(
					activeAttempt(),
					answer(firstQuestionId, true, invalidDate),
				),
			).toThrow(QuizAttemptValidationError);
			expect(() =>
				recordResponse(
					activeAttempt(),
					answer(firstQuestionId, true, invalidDate),
				),
			).toThrow("Invalid quiz attempt:\n- answeredAt must be a valid date");
		});

		test("rejects an answeredAt that precedes startedAt", () => {
			expect(() =>
				recordResponse(
					activeAttempt(),
					answer(firstQuestionId, true, earlierAt),
				),
			).toThrow(
				"Invalid quiz attempt:\n- answeredAt must not precede updatedAt",
			);
		});

		test("accepts an answeredAt equal to startedAt", () => {
			const attempt = recordResponse(
				activeAttempt(),
				answer(firstQuestionId, true, startedAt),
			);

			expect(attempt.updatedAt).toEqual(startedAt);
		});

		test("rejects an answeredAt that precedes the last transition", () => {
			const pausedAt = new Date("2026-08-01T20:00:00.000Z");
			const resumedAt = new Date("2026-08-01T21:00:00.000Z");
			const staleAt = new Date("2026-08-01T10:00:01.000Z");
			const resumed = resumeQuizAttempt(
				pauseQuizAttempt(activeAttempt(), pausedAt),
				resumedAt,
			);

			expect(() =>
				recordResponse(resumed, answer(firstQuestionId, true, staleAt)),
			).toThrow(QuizAttemptValidationError);
			expect(() =>
				recordResponse(resumed, answer(firstQuestionId, true, staleAt)),
			).toThrow(
				"Invalid quiz attempt:\n- answeredAt must not precede updatedAt",
			);
		});

		test("accepts an answeredAt equal to the previous response", () => {
			const attempt = recordResponse(
				answeredOnce(),
				answer(secondQuestionId, false, laterAt),
			);

			expect(attempt.responses).toHaveLength(2);
			expect(attempt.updatedAt).toEqual(laterAt);
		});

		test("rejects an answeredAt that precedes the previous response", () => {
			const attempt = recordResponse(
				activeAttempt(),
				answer(firstQuestionId, true, evenLaterAt),
			);

			expect(() =>
				recordResponse(attempt, answer(secondQuestionId, true, laterAt)),
			).toThrow(
				"Invalid quiz attempt:\n- answeredAt must not precede updatedAt",
			);
		});

		test("rejects recording on a paused attempt", () => {
			const paused = pauseQuizAttempt(activeAttempt(), laterAt);

			expect(() =>
				recordResponse(paused, answer(firstQuestionId, true, evenLaterAt)),
			).toThrow(QuizAttemptTransitionError);
			expect(() =>
				recordResponse(paused, answer(firstQuestionId, true, evenLaterAt)),
			).toThrow("A paused attempt cannot be answered");
		});

		test("rejects recording on a completed attempt", () => {
			const completed = completeQuizAttempt(activeAttempt(), laterAt);

			expect(() =>
				recordResponse(completed, answer(firstQuestionId, true, evenLaterAt)),
			).toThrow(QuizAttemptTransitionError);
		});

		test("reports the status failure before an invalid answeredAt", () => {
			const paused = pauseQuizAttempt(activeAttempt(), laterAt);

			expect(() =>
				recordResponse(paused, answer(firstQuestionId, true, invalidDate)),
			).toThrow(QuizAttemptTransitionError);
		});

		test("reports a duplicate response before the out-of-order guard", () => {
			const attempt = answeredOnce();

			expect(() =>
				recordResponse(attempt, answer(firstQuestionId, true, evenLaterAt)),
			).toThrow(DuplicateResponseError);
		});
	});

	describe("transitions", () => {
		test("walks active to paused to active to completed", () => {
			const paused = pauseQuizAttempt(activeAttempt(), laterAt);

			expect(paused.status).toBe(QuizAttemptStatus.Paused);
			expect(paused.updatedAt).toEqual(laterAt);

			const resumed = resumeQuizAttempt(paused, evenLaterAt);

			expect(resumed.status).toBe(QuizAttemptStatus.Active);
			expect(resumed.updatedAt).toEqual(evenLaterAt);

			const completed = completeQuizAttempt(resumed, evenLaterAt);

			expect(completed.status).toBe(QuizAttemptStatus.Completed);
			expect(completed.completedAt).toEqual(evenLaterAt);
			expect(completed.updatedAt).toEqual(evenLaterAt);
		});

		test("does not mutate the input attempt", () => {
			const attempt = activeAttempt();

			pauseQuizAttempt(attempt, laterAt);
			completeQuizAttempt(attempt, laterAt);

			expect(attempt.status).toBe(QuizAttemptStatus.Active);
			expect(attempt.completedAt).toBeUndefined();
			expect(attempt.updatedAt).toEqual(startedAt);
		});

		test("returns frozen attempts", () => {
			const paused = pauseQuizAttempt(answeredOnce(), evenLaterAt);

			expect(Object.isFrozen(paused)).toBe(true);
			expect(Object.isFrozen(paused.responses)).toBe(true);
			expect(Object.isFrozen(paused.responses[0])).toBe(true);
			expect(Object.isFrozen(paused.responses[0]?.selectedOptionIds)).toBe(
				true,
			);
		});

		test("copies the completion date", () => {
			const mutable = new Date(laterAt.getTime());
			const completed = completeQuizAttempt(activeAttempt(), mutable);

			mutable.setFullYear(1999);

			expect(completed.completedAt).toEqual(laterAt);
			expect(completed.updatedAt).toEqual(laterAt);
		});

		test("rejects pausing a paused attempt", () => {
			const paused = pauseQuizAttempt(activeAttempt(), laterAt);

			expect(() => pauseQuizAttempt(paused, evenLaterAt)).toThrow(
				QuizAttemptTransitionError,
			);
			expect(() => pauseQuizAttempt(paused, evenLaterAt)).toThrow(
				"A paused attempt cannot be paused",
			);
		});

		test("rejects pausing a completed attempt", () => {
			const completed = completeQuizAttempt(activeAttempt(), laterAt);

			expect(() => pauseQuizAttempt(completed, evenLaterAt)).toThrow(
				QuizAttemptTransitionError,
			);
		});

		test("rejects resuming an active attempt", () => {
			expect(() => resumeQuizAttempt(activeAttempt(), laterAt)).toThrow(
				"A active attempt cannot be resumed",
			);
		});

		test("rejects resuming a completed attempt", () => {
			const completed = completeQuizAttempt(activeAttempt(), laterAt);

			expect(() => resumeQuizAttempt(completed, evenLaterAt)).toThrow(
				QuizAttemptTransitionError,
			);
		});

		test("completes a paused attempt", () => {
			const paused = pauseQuizAttempt(activeAttempt(), laterAt);
			const completed = completeQuizAttempt(paused, evenLaterAt);

			expect(completed.status).toBe(QuizAttemptStatus.Completed);
			expect(completed.completedAt).toEqual(evenLaterAt);
		});

		test("rejects completing twice", () => {
			const completed = completeQuizAttempt(activeAttempt(), laterAt);

			expect(() => completeQuizAttempt(completed, evenLaterAt)).toThrow(
				"A completed attempt cannot be completed",
			);
		});

		test.each([
			["pauseQuizAttempt", pauseQuizAttempt],
			["completeQuizAttempt", completeQuizAttempt],
		] as const)("%s rejects an invalid at date", (_name, transition) => {
			expect(() => transition(activeAttempt(), invalidDate)).toThrow(
				"Invalid quiz attempt:\n- at must be a valid date",
			);
		});

		test.each([
			["pauseQuizAttempt", pauseQuizAttempt],
			["completeQuizAttempt", completeQuizAttempt],
		] as const)("%s rejects an at date before startedAt", (_name, transition) => {
			expect(() => transition(activeAttempt(), earlierAt)).toThrow(
				"Invalid quiz attempt:\n- at must not precede updatedAt",
			);
		});

		test.each([
			["pauseQuizAttempt", pauseQuizAttempt],
			["completeQuizAttempt", completeQuizAttempt],
		] as const)("%s rejects an at date before updatedAt", (_name, transition) => {
			const answered = answeredOnce();

			expect(answered.updatedAt).toEqual(laterAt);
			expect(() => transition(answered, startedAt)).toThrow(
				"Invalid quiz attempt:\n- at must not precede updatedAt",
			);
		});

		test.each([
			["pauseQuizAttempt", pauseQuizAttempt],
			["completeQuizAttempt", completeQuizAttempt],
		] as const)("%s accepts an at date equal to updatedAt", (_name, transition) => {
			expect(transition(answeredOnce(), laterAt).updatedAt).toEqual(laterAt);
		});

		test("resumeQuizAttempt rejects an at date before updatedAt", () => {
			const paused = pauseQuizAttempt(activeAttempt(), evenLaterAt);

			expect(() => resumeQuizAttempt(paused, laterAt)).toThrow(
				"Invalid quiz attempt:\n- at must not precede updatedAt",
			);
		});

		test("resumeQuizAttempt accepts an at date equal to updatedAt", () => {
			const paused = pauseQuizAttempt(activeAttempt(), laterAt);

			expect(resumeQuizAttempt(paused, laterAt).updatedAt).toEqual(laterAt);
		});

		test("resumeQuizAttempt rejects an invalid at date", () => {
			const paused = pauseQuizAttempt(activeAttempt(), laterAt);

			expect(() => resumeQuizAttempt(paused, invalidDate)).toThrow(
				"Invalid quiz attempt:\n- at must be a valid date",
			);
		});

		test("resumeQuizAttempt rejects an at date before startedAt", () => {
			const paused = pauseQuizAttempt(activeAttempt(), laterAt);

			expect(() => resumeQuizAttempt(paused, earlierAt)).toThrow(
				"Invalid quiz attempt:\n- at must not precede updatedAt",
			);
		});

		test("accepts an at date equal to startedAt", () => {
			expect(pauseQuizAttempt(activeAttempt(), startedAt).updatedAt).toEqual(
				startedAt,
			);
		});
	});

	describe("attemptScore", () => {
		test("scores one correct answer out of two planned questions", () => {
			expect(attemptScore(answeredOnce())).toEqual({
				correct: 1,
				total: 2,
				percentage: 50,
			});
		});

		test("scores an untouched attempt as zero", () => {
			expect(attemptScore(activeAttempt())).toEqual({
				correct: 0,
				total: 2,
				percentage: 0,
			});
		});

		test("scores a wrong answer as zero correct", () => {
			expect(attemptScore(answeredOnce(false))).toEqual({
				correct: 0,
				total: 2,
				percentage: 0,
			});
		});
	});

	describe("restoreQuizAttempt", () => {
		type QuizAttemptSnapshot = Parameters<typeof restoreQuizAttempt>[0];

		const snapshotOf = (attempt: QuizAttempt): QuizAttemptSnapshot => ({
			id: attempt.id,
			quizSetId: attempt.quizSetId,
			telegramUserId: attempt.telegramUserId,
			mode: attempt.mode,
			status: attempt.status,
			questionIds: attempt.questionIds,
			responses: attempt.responses,
			startedAt: attempt.startedAt,
			updatedAt: attempt.updatedAt,
			completedAt: attempt.completedAt,
		});

		const snapshot = (
			overrides: Partial<QuizAttemptSnapshot> = {},
		): QuizAttemptSnapshot => ({
			...snapshotOf(answeredOnce()),
			...overrides,
		});

		const restoreIssues = (
			candidate: QuizAttemptSnapshot,
		): readonly string[] => {
			try {
				restoreQuizAttempt(candidate);
			} catch (caught) {
				expect(caught).toBeInstanceOf(QuizAttemptValidationError);

				return (caught as QuizAttemptValidationError).issues;
			}

			throw new Error("expected restoreQuizAttempt to throw");
		};

		test("restores the attempt the transitions produce", () => {
			const expected = answeredOnce();

			expect(restoreQuizAttempt(snapshotOf(expected))).toEqual(expected);
		});

		test("restores a completed attempt", () => {
			const expected = completeQuizAttempt(answeredOnce(), evenLaterAt);

			expect(restoreQuizAttempt(snapshotOf(expected))).toEqual(expected);
		});

		test("restores an active attempt whose updatedAt advanced past its last answer", () => {
			const restored = restoreQuizAttempt(snapshot({ updatedAt: evenLaterAt }));

			expect(restored.status).toBe(QuizAttemptStatus.Active);
			expect(restored.updatedAt).toEqual(evenLaterAt);
		});

		test("restores an attempt that has not been answered yet", () => {
			const expected = activeAttempt();

			expect(restoreQuizAttempt(snapshotOf(expected))).toEqual(expected);
		});

		test("copies dates and freezes the restored attempt", () => {
			const source = snapshot();
			const restored = restoreQuizAttempt(source);

			source.startedAt.setFullYear(1999);

			expect(restored.startedAt).toEqual(startedAt);
			expect(Object.isFrozen(restored)).toBe(true);
			expect(Object.isFrozen(restored.responses)).toBe(true);
			expect(Object.isFrozen(restored.responses[0])).toBe(true);
		});

		test("rejects an empty plan", () => {
			expect(() =>
				restoreQuizAttempt(snapshot({ questionIds: [], responses: [] })),
			).toThrow(EmptyQuizAttemptError);
		});

		test("rejects duplicate planned questions", () => {
			expect(
				restoreIssues(
					snapshot({ questionIds: [firstQuestionId, firstQuestionId] }),
				),
			).toContain("questionIds must not contain duplicates");
		});

		test("rejects a non-positive telegram user id", () => {
			expect(restoreIssues(snapshot({ telegramUserId: 0 }))).toContain(
				"telegramUserId must be a positive integer",
			);
		});

		test("rejects more responses than planned questions", () => {
			expect(
				restoreIssues(
					snapshot({
						questionIds: [firstQuestionId],
						responses: [
							answer(firstQuestionId, true, laterAt),
							answer(secondQuestionId, true, evenLaterAt),
						],
						updatedAt: evenLaterAt,
					}),
				),
			).toContain("responses must not outnumber the planned questions");
		});

		test("rejects responses that depart from plan order", () => {
			expect(
				restoreIssues(
					snapshot({ responses: [answer(secondQuestionId, true, laterAt)] }),
				),
			).toContain("responses must follow the planned question order");
		});

		test("rejects a response for a question outside the plan", () => {
			expect(
				restoreIssues(
					snapshot({ responses: [answer(unplannedQuestionId, true, laterAt)] }),
				),
			).toContain("responses must follow the planned question order");
		});

		test("rejects answers that move backwards in time", () => {
			expect(
				restoreIssues(
					snapshot({
						responses: [
							answer(firstQuestionId, true, laterAt),
							answer(secondQuestionId, true, startedAt),
						],
					}),
				),
			).toContain("answeredAt must not precede the previous response");
		});

		test("rejects a first answer that precedes the start", () => {
			expect(
				restoreIssues(
					snapshot({
						responses: [answer(firstQuestionId, true, earlierAt)],
					}),
				),
			).toContain("answeredAt must not precede startedAt");
		});

		test("rejects empty selected options", () => {
			expect(
				restoreIssues(
					snapshot({
						responses: [answer(firstQuestionId, true, laterAt, [])],
					}),
				),
			).toContain("selectedOptionIds must not be empty");
		});

		test("rejects duplicate selected options", () => {
			const optionId = toQuestionOptionId("option-1");

			expect(
				restoreIssues(
					snapshot({
						responses: [
							answer(firstQuestionId, true, laterAt, [optionId, optionId]),
						],
					}),
				),
			).toContain("selectedOptionIds must not contain duplicates");
		});

		test("rejects an updatedAt that precedes the last answer", () => {
			expect(restoreIssues(snapshot({ updatedAt: startedAt }))).toContain(
				"updatedAt must not precede the last response",
			);
		});

		test("rejects an updatedAt that precedes the start", () => {
			expect(
				restoreIssues(snapshot({ responses: [], updatedAt: earlierAt })),
			).toContain("updatedAt must not precede startedAt");
		});

		test("rejects invalid dates", () => {
			expect(restoreIssues(snapshot({ startedAt: invalidDate }))).toContain(
				"startedAt must be a valid date",
			);
			expect(restoreIssues(snapshot({ updatedAt: invalidDate }))).toContain(
				"updatedAt must be a valid date",
			);
			expect(
				restoreIssues(
					snapshot({
						responses: [answer(firstQuestionId, true, invalidDate)],
					}),
				),
			).toContain("answeredAt must be a valid date");
		});

		test("rejects a completed attempt without a completion timestamp", () => {
			expect(
				restoreIssues(snapshot({ status: QuizAttemptStatus.Completed })),
			).toContain("a completed attempt must have completedAt");
		});

		test("rejects an unfinished attempt that carries a completion timestamp", () => {
			expect(restoreIssues(snapshot({ completedAt: laterAt }))).toContain(
				"only a completed attempt may have completedAt",
			);
		});

		test("rejects a completedAt that disagrees with updatedAt", () => {
			expect(
				restoreIssues(
					snapshot({
						status: QuizAttemptStatus.Completed,
						completedAt: evenLaterAt,
					}),
				),
			).toContain("completedAt must equal updatedAt");
		});

		test("rejects an unsupported status", () => {
			expect(
				restoreIssues(snapshot({ status: "retired" as QuizAttemptStatus })),
			).toContain("status must be a supported quiz attempt status");
		});

		test("rejects an unsupported mode", () => {
			expect(
				restoreIssues(snapshot({ mode: "cram" as QuizAttemptMode })),
			).toContain("mode must be a supported quiz attempt mode");
		});
	});
});
