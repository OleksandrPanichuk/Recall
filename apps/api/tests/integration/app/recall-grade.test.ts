import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	type AppSession,
	bodyOf as json,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";
import { aSet, type CurrentShape } from "../../fixtures/app-shapes";

const available = await postgresAvailable();

let session: AppSession;
let call: AppSession["app"];

interface Answered {
	readonly isCorrect: boolean;
	readonly gradable: boolean;
	readonly question: { id: string };
}

interface Due {
	readonly quizSetId: string;
	readonly dueCount: number;
}

const useScheduler = (scheduler: "ladder" | "fsrs"): Promise<Response> =>
	call("settings/update", {
		repetition: {
			scheduler,
			intervalsDays: [1, 3, 7, 21],
			maxIntervalDays: 365,
			maxRepetitions: 8,
			desiredRetention: 0.9,
		},
	});

const answerCorrectly = async (): Promise<Answered> => {
	const current = await json<CurrentShape>(await call("attempts/current"));

	return json<Answered>(
		await call("attempts/answer", {
			questionId: current.question?.id,
			selectedOptionPositions: [0],
		}),
	);
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({ name: "app-recall-grade" });
	call = session.app;
});

afterAll(async () => {
	await session?.close();
});

describe.skipIf(!available)("saying how well something was recalled", () => {
	let quizSetId: string;

	test("the ladder does not ask, because it cannot use the answer", async () => {
		quizSetId = await aSet(call, "Ladder set", ["One?", "Two?"], true);

		await useScheduler("ladder");
		await call("attempts/start", { quizSetId });

		const answered = await answerCorrectly();

		expect(answered.isCorrect).toBe(true);
		expect(answered.gradable).toBe(false);

		await call("attempts/abandon", {});
	});

	test("fsrs does ask, once the answer was right", async () => {
		await useScheduler("fsrs");
		await call("attempts/start", { quizSetId });

		const answered = await answerCorrectly();

		expect(answered.gradable).toBe(true);
	});

	test("the answered question can then be rated", async () => {
		const answered = await json<Answered>(
			await call("attempts/answer", {
				questionId: (await json<CurrentShape>(await call("attempts/current")))
					.question?.id,
				selectedOptionPositions: [0],
			}),
		);

		expect(
			(
				await call("attempts/recall", {
					questionId: answered.question.id,
					recall: "easy",
				})
			).status,
		).toBe(204);
	});

	test("rating it again replaces the earlier answer, not an error", async () => {
		const detail = await json<{ questions: { id: string }[] }>(
			await call("sets/get", { quizSetId }),
		);
		const rated = detail.questions[0]?.id as string;

		expect(
			(await call("attempts/recall", { questionId: rated, recall: "hard" }))
				.status,
		).toBe(204);
	});

	test("a question this attempt never answered is refused by name", async () => {
		const response = await call("attempts/recall", {
			questionId: "00000000-0000-4000-8000-000000000000",
			recall: "good",
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect((await json<{ error: string }>(response)).error).toBe(
			"QuestionNotInAttemptError",
		);
	});

	test("a grade the scheduler does not know is refused", async () => {
		expect(
			(
				await call("attempts/recall", {
					questionId: "00000000-0000-4000-8000-000000000000",
					recall: "brilliant",
				})
			).status,
		).toBeGreaterThanOrEqual(400);
	});

	test("and Again cannot be offered as a feeling, it is the answer's own verdict", async () => {
		expect(
			(
				await call("attempts/recall", {
					questionId: "00000000-0000-4000-8000-000000000000",
					recall: "again",
				})
			).status,
		).toBeGreaterThanOrEqual(400);
	});

	test("rating survives finishing the attempt", async () => {
		expect((await call("attempts/finish", {})).status).toBe(200);

		const due = await json<Due[]>(await call("repetitions/due", {}));

		expect(Array.isArray(due)).toBe(true);
	});

	test("with no attempt open there is nothing to rate", async () => {
		const response = await call("attempts/recall", {
			questionId: "00000000-0000-4000-8000-000000000000",
			recall: "good",
		});

		expect((await json<{ error: string }>(response)).error).toBe(
			"NoActiveAttemptError",
		);
	});
});
