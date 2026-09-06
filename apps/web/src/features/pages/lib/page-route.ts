import type { BrowseView, PageRevision, QuizSummary } from "@recall/contracts";

export interface PageRouteInput {
	readonly page: BrowseView | null;
	readonly inProgressQuizId?: string;
	readonly revisions: readonly PageRevision[];
	readonly quizzes: readonly QuizSummary[];
}

export interface PageRouteData {
	readonly page: BrowseView;
	readonly inProgressQuizId?: string;
	readonly revisions: readonly PageRevision[];
	readonly attachable: readonly QuizSummary[];
}

export function pageRouteData(input: PageRouteInput): PageRouteData | null {
	return input.page === null
		? null
		: {
				page: input.page,
				inProgressQuizId: input.inProgressQuizId,
				revisions: input.revisions,
				attachable: input.quizzes,
			};
}
