export type {
	PageMatch,
	PageRevision,
	PageShare,
	PagesRepository as PageRepository,
	RevisionAuthor,
} from "@/modules/pages";

import type { AttachmentsRepository } from "@/modules/attachments";
import type { AttemptsRepository } from "@/modules/attempts";
import type { AnalyticsRepository } from "@/modules/insights";
import type { PagesRepository } from "@/modules/pages";
import type { QuizRepository } from "./quiz-repository.alias";
import type { ReviewRepository } from "./review-repository.alias";
import type { TermPairRepository } from "./term-pair-repository.alias";

export interface RepositoryScope {
	readonly pages: PagesRepository;
	readonly quizzes: QuizRepository;
	readonly attempts: AttemptsRepository;
	readonly reviews: ReviewRepository;
	readonly termPairs: TermPairRepository;
	readonly analytics: AnalyticsRepository;
	readonly attachments: AttachmentsRepository;
}
