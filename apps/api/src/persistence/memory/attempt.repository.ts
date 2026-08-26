import type {
	AttemptRepository,
	AttemptStatistics,
	TopicAccuracy,
} from "@/application/ports/repositories/attempt.repository";
import {
	type QuizAttempt,
	type QuizAttemptId,
	QuizAttemptStatus,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { QuestionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { MemoryStore } from "./store";

export function createMemoryAttemptRepository(
	store: MemoryStore,
): AttemptRepository {
	// This store belongs to one owner, so every attempt in it is theirs.
	const forQuiz = (quizId: QuizSetId): readonly QuizAttempt[] =>
		[...store.attempts.values()].filter(
			(attempt) => String(attempt.quizSetId) === String(quizId),
		);

	const topicOf = (questionId: QuestionId): string | undefined => {
		for (const quiz of store.quizAggregates.values()) {
			const question = quiz.questions.find(
				(candidate) => String(candidate.id) === String(questionId),
			);

			if (question !== undefined) {
				return question.topic;
			}
		}

		return undefined;
	};

	return {
		async save(attempt: QuizAttempt): Promise<void> {
			const stored = store.attempts.get(String(attempt.id));

			if (stored !== undefined && stored.updatedAt > attempt.updatedAt) {
				return;
			}

			store.attempts.set(String(attempt.id), attempt);
		},

		async findById(id: QuizAttemptId): Promise<QuizAttempt | undefined> {
			return store.attempts.get(String(id));
		},

		async findActive(): Promise<QuizAttempt | undefined> {
			return [...store.attempts.values()]
				.filter(
					(attempt) =>
						attempt.status === QuizAttemptStatus.Active ||
						attempt.status === QuizAttemptStatus.Paused,
				)
				.sort(
					(left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
				)[0];
		},

		async listCompletedForQuiz(
			quizId: QuizSetId,
		): Promise<readonly AttemptStatistics[]> {
			return forQuiz(quizId)
				.filter((attempt) => attempt.status === QuizAttemptStatus.Completed)
				.sort(
					(left, right) =>
						(left.completedAt?.getTime() ?? 0) -
						(right.completedAt?.getTime() ?? 0),
				)
				.map((attempt) => ({
					attemptId: attempt.id,
					quizId,
					correct: attempt.responses.filter((entry) => entry.isCorrect).length,
					total: attempt.responses.length,
					completedAt: attempt.completedAt,
				}));
		},

		async topicAccuracy(quizId: QuizSetId): Promise<readonly TopicAccuracy[]> {
			const buckets = new Map<string, TopicAccuracy>();

			for (const attempt of forQuiz(quizId)) {
				for (const answer of attempt.responses) {
					const topic = topicOf(answer.questionId);
					const key = topic ?? " ";
					const current = buckets.get(key) ?? {
						topic,
						answered: 0,
						correct: 0,
					};

					buckets.set(key, {
						topic,
						answered: current.answered + 1,
						correct: current.correct + (answer.isCorrect ? 1 : 0),
					});
				}
			}

			return [...buckets.values()].sort((left, right) => {
				if (left.topic === undefined) {
					return 1;
				}

				if (right.topic === undefined) {
					return -1;
				}

				return left.topic.localeCompare(right.topic);
			});
		},

		async incorrectQuestionIds(
			quizId: QuizSetId,
		): Promise<readonly QuestionId[]> {
			const wrong = new Map<string, { id: QuestionId; at: number }>();
			const right = new Map<string, number>();

			for (const attempt of forQuiz(quizId)) {
				for (const answer of attempt.responses) {
					const key = String(answer.questionId);
					const at = answer.answeredAt.getTime();

					if (answer.isCorrect) {
						right.set(key, Math.max(right.get(key) ?? 0, at));
						continue;
					}

					const seen = wrong.get(key);

					if (seen === undefined || at > seen.at) {
						wrong.set(key, { id: answer.questionId, at });
					}
				}
			}

			return [...wrong.entries()]
				.filter(([key, entry]) => (right.get(key) ?? -1) <= entry.at)
				.sort(
					([leftKey, left], [rightKey, rightEntry]) =>
						rightEntry.at - left.at || leftKey.localeCompare(rightKey),
				)
				.map(([, entry]) => entry.id);
		},

		async answerCount(questionId: QuestionId): Promise<number> {
			let total = 0;

			for (const attempt of store.attempts.values()) {
				total += attempt.responses.filter(
					(answer) => String(answer.questionId) === String(questionId),
				).length;
			}

			return total;
		},
	};
}
