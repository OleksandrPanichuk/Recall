import { createServerFn } from "@tanstack/react-start";
import { api } from "@/shared/lib/api";
import { idInput, missingAsNull } from "@/shared/lib/request";

export const createQuizSet = createServerFn({ method: "POST" })
	.inputValidator(
		(value: unknown) =>
			value as { title: string; language: string; folderId?: string },
	)
	.handler(async ({ data }) => api().createQuizSet.execute(data));

export const loadQuizSet = createServerFn()
	.inputValidator(idInput)
	.handler(async ({ data }) =>
		missingAsNull(
			() => api().getQuizSet.execute({ quizSetId: data.id }),
			["QuizSetNotFoundError"],
		),
	);

export const updateQuizSet = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => value as Record<string, unknown>)
	.handler(async ({ data }) => {
		await api().updateQuizSet.execute(data as never);
	});

export const publishQuizSet = createServerFn({ method: "POST" })
	.inputValidator(idInput)
	.handler(async ({ data }) => {
		await api().publishQuizSet.execute({ quizSetId: data.id });
	});

export const archiveQuizSet = createServerFn({ method: "POST" })
	.inputValidator(idInput)
	.handler(async ({ data }) => {
		await api().archiveQuizSet.execute({ quizSetId: data.id });
	});

export const addQuestions = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => value as Record<string, unknown>)
	.handler(async ({ data }) => api().addQuestions.execute(data as never));

export const updateQuestion = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => value as Record<string, unknown>)
	.handler(async ({ data }) => {
		await api().updateQuestion.execute(data as never);
	});

export const deleteQuestion = createServerFn({ method: "POST" })
	.inputValidator(
		(value: unknown) => value as { quizSetId: string; questionId: string },
	)
	.handler(async ({ data }) => api().deleteQuestion.execute(data));
