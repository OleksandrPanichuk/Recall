import { createServerFn } from "@tanstack/react-start";
import { api } from "./api";
import { viewerOf } from "./session";

const idInput = (value: unknown): { id: string } => ({ id: String(value) });

export const loadSession = createServerFn().handler(async () => ({
	viewer: (await viewerOf()) ?? null,
}));

export const loadLibrary = createServerFn()
	.inputValidator((value: unknown) => ({
		folderId: value === undefined ? undefined : String(value),
	}))
	.handler(async ({ data }) => api().browseFolder.execute(data));

export const loadCurrentQuestion = createServerFn().handler(async () => ({
	current: (await api().getCurrentQuestion.execute({})) ?? null,
}));

export const loadRepetitions = createServerFn().handler(async () => ({
	due: await api().listDueRepetitions.execute({}),
	leeches: await api().listLeeches.execute({}),
}));

export const loadStatistics = createServerFn()
	.inputValidator(idInput)
	.handler(async ({ data }) =>
		api().getQuizStatistics.execute({ quizSetId: data.id }),
	);

export const loadAttempt = createServerFn()
	.inputValidator(idInput)
	.handler(async ({ data }) =>
		api().getAttemptDetail.execute({ attemptId: data.id }),
	);

export const startAttempt = createServerFn({ method: "POST" })
	.inputValidator(idInput)
	.handler(async ({ data }) => {
		await api().startQuizAttempt.execute({ quizSetId: data.id });

		return { current: (await api().getCurrentQuestion.execute({})) ?? null };
	});

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
