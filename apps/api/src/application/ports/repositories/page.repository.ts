export type {
	PageMatch,
	PageRevision,
	PageShare,
	PagesRepository as PageRepository,
	RevisionAuthor,
} from "@/modules/pages";

import type { PagesRepository } from "@/modules/pages";
import type { AnalyticsRepository } from "./analytics.repository";
import type { AttachmentRepository } from "./attachment.repository";
import type { AttemptRepository } from "./attempt.repository";
import type { QuizRepository } from "./quiz.repository";
import type { ReviewRepository } from "./review.repository";
import type { TermPairRepository } from "./term-pair.repository";

export interface RepositoryScope {
	readonly pages: PagesRepository;
	readonly quizzes: QuizRepository;
	readonly attempts: AttemptRepository;
	readonly reviews: ReviewRepository;
	readonly termPairs: TermPairRepository;
	readonly analytics: AnalyticsRepository;
	readonly attachments: AttachmentRepository;
}
