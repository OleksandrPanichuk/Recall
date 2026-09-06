import { ApiErrorName, type FeltGrade, isApiError } from "@recall/contracts";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@/shared/lib/api";
import { idInput } from "@/shared/lib/request";

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

			const quizSetId = error.details.quizSetId;

			return {
				current: null,
				blockedBy: {
					quizSetId: quizSetId ?? null,
					title:
						quizSetId === undefined
							? null
							: await api()
									.getQuizStatistics.execute({ quizSetId })
									.then((statistics) => statistics.title)
									.catch(() => null),
				},
			};
		}

		return {
			current: (await api().getCurrentQuestion.execute({})) ?? null,
			blockedBy: null,
		};
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
