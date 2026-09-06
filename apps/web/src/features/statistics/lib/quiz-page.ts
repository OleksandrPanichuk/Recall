import type { CurrentQuestionView } from "@recall/contracts";
import { attempts as countedAttempts } from "@/shared/lib/plural";

export interface QuizCallToAction {
	readonly caption: string;
	readonly label: string;
	readonly resuming: boolean;
}

export function quizCallToAction(
	attempts: number,
	active: CurrentQuestionView | null,
): QuizCallToAction {
	const done = attempts === 0 ? "No attempts yet" : countedAttempts(attempts);

	if (active === null) {
		return {
			caption: done,
			label: attempts === 0 ? "Start" : "Run it again",
			resuming: false,
		};
	}

	if (active.awaitingFinish) {
		return {
			caption: `${done} · answered through, waiting to be finished`,
			label: "Finish attempt",
			resuming: true,
		};
	}

	const where = `${active.index + 1} of ${active.total}`;

	return {
		caption:
			active.status === "paused"
				? `${done} · paused at ${where}`
				: `${done} · started, ${where}`,
		label: "Carry on",
		resuming: true,
	};
}
