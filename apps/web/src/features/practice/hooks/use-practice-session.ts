import type {
	AnswerQuestionResult,
	CurrentQuestionView,
} from "@recall/contracts";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	abandonAttempt,
	answerQuestion,
	finishAttempt,
} from "@/features/practice/lib/practice.api";
import { messageFor } from "@/features/practice/lib/practice.errors";
import type {
	Answer,
	FinishedAttempt,
} from "@/features/practice/lib/practice.types";

export function usePracticeSession(started: CurrentQuestionView | null) {
	const router = useRouter();
	const [current, setCurrent] = useState(started);
	const [pending, setPending] = useState<CurrentQuestionView | null>(null);
	const [verdict, setVerdict] = useState<AnswerQuestionResult | null>(null);
	const [finished, setFinished] = useState<FinishedAttempt | null>(null);
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	const finish = async (): Promise<void> => {
		setBusy(true);
		setFailure(null);

		try {
			const result = await finishAttempt();

			setFinished({
				attemptId: result.attemptId,
				correct: result.score.correct,
				total: result.score.total,
				percentage: result.score.percentage,
			});
		} catch (error) {
			setFailure(messageFor(error));
		} finally {
			setBusy(false);
		}
	};

	return {
		current,
		failure,
		pending,
		verdict,
		finished,
		busy,
		finish,
		send: async (answer: Answer): Promise<void> => {
			const question = current?.question;

			if (question === undefined || busy) {
				return;
			}

			setBusy(true);
			setFailure(null);

			try {
				const answered = await answerQuestion({
					data: { questionId: question.id, ...answer },
				});

				setVerdict(answered.result);
				setPending(answered.current);
			} catch (error) {
				setFailure(messageFor(error));
			} finally {
				setBusy(false);
			}
		},
		next: (): void => {
			setVerdict(null);
			setCurrent(pending);
			setPending(null);
		},
		abandon: async (): Promise<void> => {
			await abandonAttempt();
			await router.invalidate();
		},
	};
}
