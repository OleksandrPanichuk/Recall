import type {
	QuizListFilter,
	QuizRepository,
	QuizSummary,
} from "@/application/ports/repositories/quiz.repository";
import { QuizVersionConflictError } from "@/application/ports/repositories/quiz.repository";
import type { QuizSet, QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { MemoryStore } from "./store";

export function createMemoryQuizRepository(store: MemoryStore): QuizRepository {
	return {
		async versionOf(id: QuizSetId): Promise<number | undefined> {
			return store.quizVersions.get(String(id));
		},

		async save(quiz: QuizSet, expectedVersion?: number): Promise<number> {
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

		async findById(id: QuizSetId): Promise<QuizSet | undefined> {
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
	};
}
