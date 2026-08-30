import { ApiErrorName } from "@recall/contracts";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@/shared/lib/api";
import { idInput, missingAsNull } from "@/shared/lib/request";

export const loadInsights = createServerFn().handler(async () =>
	api().getInsights.execute({}),
);

export const loadStatistics = createServerFn()
	.inputValidator(idInput)
	.handler(async ({ data }) =>
		missingAsNull(
			() => api().getQuizStatistics.execute({ quizSetId: data.id }),
			[ApiErrorName.QuizSetNotFound],
		),
	);

export const loadAttempt = createServerFn()
	.inputValidator(idInput)
	.handler(async ({ data }) =>
		api().getAttemptDetail.execute({ attemptId: data.id }),
	);
