import { createServerFn } from "@tanstack/react-start";
import { api } from "@/shared/lib/api";

export const loadRepetitions = createServerFn().handler(async () => ({
	due: await api().listDueRepetitions.execute({}),
	leeches: await api().listLeeches.execute({}),
	retired: await api().listRetired.execute({}),
}));

export const setQuestionRetired = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = value as { questionId: string; retired: boolean };

		return {
			questionId: String(input.questionId),
			retired: input.retired === true,
		};
	})
	.handler(async ({ data }) => api().retireQuestion.execute(data));
