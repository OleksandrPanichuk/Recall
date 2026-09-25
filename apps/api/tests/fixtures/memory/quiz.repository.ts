import type { QuizRepository } from "@tests/fixtures/quiz-repository.alias";
import type {
	ListedQuestion,
	QuestionListFilter,
	QuestionLocation,
	QuizListFilter,
	QuizSummary,
} from "@/modules/quizzes";
import {
	type QuestionId,
	QuizSetEntity,
	type QuizSetId,
	QuizVersionConflictError,
} from "@/modules/quizzes";
import type { MemoryStore } from "./store";

export function createMemoryQuizRepository(store: MemoryStore): QuizRepository {
	return {
		async versionOf(id: QuizSetId): Promise<number | undefined> {
			return store.quizVersions.get(String(id));
		},

		async save(quiz: QuizSetEntity, expectedVersion?: number): Promise<number> {
			const id = String(quiz.id);
			const stored = store.quizVersions.get(id);

			if (
				expectedVersion !== undefined &&
				stored !== undefined &&
				stored !== expectedVersion
			) {
				throw new QuizVersionConflictError(quiz.id);
			}

			const answered = new Set(store.answeredQuestionIds);
			const removed = [...(store.quizAggregates.get(id)?.questions ?? [])]
				.filter(
					(question) =>
						!quiz.questions.some(
							(kept) => String(kept.id) === String(question.id),
						),
				)
				.filter((question) => answered.has(String(question.id)));

			if (removed.length > 0) {
				throw new Error(
					`update or delete on table "questions" violates foreign key constraint "responses_question_id_questions_id_fk"`,
				);
			}

			const nextVersion = (stored ?? -1) + 1;

			store.quizVersions.set(id, nextVersion);
			store.quizAggregates.set(id, quiz);
			store.quizzes.set(id, {
				id,
				pageId: quiz.folderId === undefined ? undefined : String(quiz.folderId),
				status: quiz.status,
			});

			return nextVersion;
		},

		async findById(id: QuizSetId): Promise<QuizSetEntity | undefined> {
			return store.quizAggregates.get(String(id));
		},

		async list(filter?: QuizListFilter): Promise<readonly QuizSummary[]> {
			return [...store.quizAggregates.values()]
				.filter(
					(quiz) =>
						filter?.statuses === undefined ||
						filter.statuses.includes(quiz.status),
				)
				.filter((quiz) => {
					if (filter?.pageId === undefined) {
						return true;
					}

					if (filter.pageId === null) {
						return quiz.folderId === undefined;
					}

					return String(quiz.folderId ?? "") === String(filter.pageId);
				})
				.filter(
					(quiz) =>
						filter?.ids === undefined ||
						filter.ids.some((id) => String(id) === String(quiz.id)),
				)
				.sort((left, right) => left.title.localeCompare(right.title))
				.map((quiz) => ({
					id: quiz.id,
					title: quiz.title,
					status: quiz.status,
					questionCount: quiz.questions.length,
					updatedAt: quiz.updatedAt,
				}));
		},

		async answerCounts(
			questionIds: readonly QuestionId[],
		): Promise<ReadonlyMap<QuestionId, number>> {
			const wanted = new Set(questionIds.map(String));
			const counts = new Map<QuestionId, number>();

			for (const attempt of store.attempts.values()) {
				for (const answer of attempt.responses) {
					if (wanted.has(String(answer.questionId))) {
						counts.set(
							answer.questionId,
							(counts.get(answer.questionId) ?? 0) + 1,
						);
					}
				}
			}

			return counts;
		},

		async locateQuestions(
			questionIds: readonly QuestionId[],
		): Promise<readonly QuestionLocation[]> {
			const wanted = new Set(questionIds.map(String));

			return [...store.quizAggregates.values()].flatMap((quiz) =>
				quiz.questions
					.filter((question) => wanted.has(String(question.id)))
					.map((question) => ({
						questionId: question.id,
						quizSetId: quiz.id,
						quizSetTitle: quiz.title,
						quizSetStatus: quiz.status,
						prompt: question.prompt,
					})),
			);
		},

		async listQuestions(
			filter?: QuestionListFilter,
		): Promise<readonly ListedQuestion[]> {
			return [...store.quizAggregates.values()]
				.filter(
					(quiz) =>
						filter?.quizSetId === undefined ||
						String(quiz.id) === String(filter.quizSetId),
				)
				.sort((left, right) =>
					left.title === right.title
						? String(left.id).localeCompare(String(right.id))
						: left.title.localeCompare(right.title),
				)
				.flatMap((quiz) =>
					quiz.questions
						.toSorted((left, right) => left.position - right.position)
						.map((question) => ({
							question,
							quizSetId: quiz.id,
							setTitle: quiz.title,
							setStatus: quiz.status,
						})),
				);
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
