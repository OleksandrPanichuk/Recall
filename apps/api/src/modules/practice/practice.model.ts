import type { StartPracticeSessionResult as WirePracticeResult } from "@recall/contracts";
import type { StartPracticeSessionResult } from "./use-cases";

export const practiceResultToWire = (
	result: StartPracticeSessionResult,
): WirePracticeResult => ({
	attemptId: String(result.attemptId),
	currentQuestionId:
		result.currentQuestionId === undefined
			? undefined
			: String(result.currentQuestionId),
	questionCount: result.questionCount,
	topics: [...result.topics],
});
