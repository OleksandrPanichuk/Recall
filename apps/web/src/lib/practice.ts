import type { UpdateQuizSettingsCommand } from "@recall/contracts";
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

export const saveSummary = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => {
		const input = value as { folderId: string; summary: string };

		return { folderId: String(input.folderId), summary: String(input.summary) };
	})
	.handler(async ({ data }) => {
		await api().writeSummary.execute(data);

		return api().browseFolder.execute({ folderId: data.folderId });
	});

export const searchPages = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => ({ query: String(value) }))
	.handler(async ({ data }) => api().searchPages.execute(data));

export const createPage = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => {
		const input = value as { name: string; parentId?: string };

		return { name: String(input.name), parentId: input.parentId };
	})
	.handler(async ({ data }) => api().createPage.execute(data));

export const renamePage = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => {
		const input = value as { folderId: string; name: string };

		return { folderId: String(input.folderId), name: String(input.name) };
	})
	.handler(async ({ data }) => {
		await api().renamePage.execute(data);

		return api().browseFolder.execute({ folderId: data.folderId });
	});

export const setPageIcon = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => {
		const input = value as { folderId: string; icon?: string };

		return { folderId: String(input.folderId), icon: input.icon };
	})
	.handler(async ({ data }) => {
		await api().setPageIcon.execute(data);

		return api().browseFolder.execute({ folderId: data.folderId });
	});

export const deletePage = createServerFn({ method: "POST" })
	.inputValidator(idInput)
	.handler(async ({ data }) => {
		await api().deletePage.execute({ folderId: data.id });
	});

export const loadPageTree = createServerFn().handler(async () => ({
	nodes: await api().listPageTree.execute({}),
}));

export const loadSettings = createServerFn()
	.inputValidator((value: unknown) => ({
		quizSetId: value === undefined ? undefined : String(value),
	}))
	.handler(async ({ data }) => api().resolveQuizSettings.execute(data));

export const saveSettings = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => value as UpdateQuizSettingsCommand)
	.handler(async ({ data }) => {
		await api().updateQuizSettings.execute(data);

		return api().resolveQuizSettings.execute({ quizSetId: data.quizSetId });
	});

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
