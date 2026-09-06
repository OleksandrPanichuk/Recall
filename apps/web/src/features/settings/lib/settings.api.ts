import type { UpdateQuizSettingsCommand } from "@recall/contracts";
import { ApiErrorName } from "@recall/contracts";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@/shared/lib/api";
import { missingAsNull } from "@/shared/lib/request";

export const loadSettings = createServerFn()
	.validator((value: unknown) => ({
		quizSetId: value === undefined ? undefined : String(value),
	}))
	.handler(async ({ data }) =>
		missingAsNull(
			() => api().resolveQuizSettings.execute(data),
			[ApiErrorName.QuizSetNotFound],
		),
	);

export const saveSettings = createServerFn({ method: "POST" })
	.validator((value: unknown) => value as UpdateQuizSettingsCommand)
	.handler(async ({ data }) => {
		await api().updateQuizSettings.execute(data);

		return api().resolveQuizSettings.execute({ quizSetId: data.quizSetId });
	});
