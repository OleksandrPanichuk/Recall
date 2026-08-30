import { ApiErrorName, isApiError } from "@recall/contracts";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@/shared/lib/api";
import { idInput } from "@/shared/lib/request";

export const loadCurrentQuestion = createServerFn().handler(async () => ({
	current: (await api().getCurrentQuestion.execute({})) ?? null,
}));

export const startAttempt = createServerFn({ method: "POST" })
	.inputValidator(idInput)
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

export const answerQuestion = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => {
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
