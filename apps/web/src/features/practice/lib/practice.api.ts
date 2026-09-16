import { ApiErrorName, type FeltGrade, isApiError } from "@recall/contracts";
import { createServerFn } from "@tanstack/react-start";
import { isPracticeSearchMode } from "@/features/practice/lib/practice-mode";
import { api } from "@/shared/lib/api";
import { idInput } from "@/shared/lib/request";

const blockedByFor = async (quizSetId: string | undefined) => ({
	quizSetId: quizSetId ?? null,
	title:
		quizSetId === undefined
			? null
			: await api()
					.getQuizStatistics.execute({ quizSetId })
					.then((statistics) => statistics.title)
					.catch(() => null),
});

const startedNow = async () => ({
	current: (await api().getCurrentQuestion.execute({})) ?? null,
	blockedBy: null,
	nothing: null,
});

export const loadCurrentQuestion = createServerFn().handler(async () => ({
	current: (await api().getCurrentQuestion.execute({})) ?? null,
}));

export const startAttempt = createServerFn({ method: "POST" })
	.validator(idInput)
	.handler(async ({ data }) => {
		try {
			await api().startQuizAttempt.execute({ quizSetId: data.id });
		} catch (error) {
			if (!isApiError(error, ApiErrorName.AttemptAlreadyInProgress)) {
				throw error;
			}

			return {
				current: null,
				blockedBy: await blockedByFor(error.details.quizSetId),
				nothing: null,
			};
		}

		return startedNow();
	});

export const startPractice = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = value as { id: string; mode: unknown };

		if (!isPracticeSearchMode(input.mode)) {
			throw new Error(`Unknown practice mode: ${String(input.mode)}`);
		}

		return { id: String(input.id), mode: input.mode };
	})
	.handler(async ({ data }) => {
		try {
			await api().startPracticeSession.execute({
				quizSetId: data.id,
				mode: data.mode,
			});
		} catch (error) {
			if (isApiError(error, ApiErrorName.NothingToPractice)) {
				return { current: null, blockedBy: null, nothing: data.mode };
			}

			if (!isApiError(error, ApiErrorName.AttemptAlreadyInProgress)) {
				throw error;
			}

			return {
				current: null,
				blockedBy: await blockedByFor(error.details.quizSetId),
				nothing: null,
			};
		}

		return startedNow();
	});

export const abandonAttempt = createServerFn({ method: "POST" }).handler(
	async () => api().abandonQuizAttempt.execute({}),
);

export const rateRecall = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = value as { questionId: string; recall: FeltGrade };

		return { questionId: String(input.questionId), recall: input.recall };
	})
	.handler(async ({ data }) => {
		await api().rateRecall.execute(data);
	});

export const pauseAttempt = createServerFn({ method: "POST" }).handler(
	async () => {
		await api().pauseQuizAttempt.execute({});
	},
);

export const resumeAttempt = createServerFn({ method: "POST" }).handler(
	async () => {
		await api().resumeQuizAttempt.execute({});

		return { current: (await api().getCurrentQuestion.execute({})) ?? null };
	},
);

export const answerQuestion = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = value as {
			questionId: string;
			selectedOptionPositions?: number[];
			typedAnswer?: string;
			revealed?: boolean;
		};

		return input;
	})
	.handler(async ({ data }) => {
		const result = await api().answerQuestion.execute(data);

		return {
			result,
			current: (await api().getCurrentQuestion.execute({})) ?? null,
		};
	});

export const finishAttempt = createServerFn({ method: "POST" }).handler(
	async () => api().finishQuizAttempt.execute({}),
);
