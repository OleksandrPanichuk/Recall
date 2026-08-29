import type { CurrentQuestionView } from "@recall/contracts";

export interface QuizCallToAction {
	readonly caption: string;
	readonly label: string;
	readonly resuming: boolean;
}

export function quizCallToAction(
	attempts: number,
	active: CurrentQuestionView | null,
): QuizCallToAction {
	const done = attempts === 0 ? "Ще жодної спроби" : `${attempts} спроб(и)`;

	if (active === null) {
		return {
			caption: done,
			label: attempts === 0 ? "Почати" : "Пройти ще раз",
			resuming: false,
		};
	}

	if (active.awaitingFinish) {
		return {
			caption: `${done} · спробу пройдено, залишилось завершити`,
			label: "Завершити спробу",
			resuming: true,
		};
	}

	return {
		caption: `${done} · почато, ${active.index + 1} з ${active.total}`,
		label: "Продовжити спробу",
		resuming: true,
	};
}
