import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { GetQuizSetUseCase } from "@/application/use-cases/quiz-sets/get-quiz-set";
import { ListQuizSetsUseCase } from "@/application/use-cases/quiz-sets/list-quiz-sets";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";

export interface QuizSummaryBody {
	readonly id: string;
	readonly title: string;
	readonly status: string;
	readonly questionCount: number;
	readonly updatedAt: string;
}

export interface QuizDetailBody {
	readonly id: string;
	readonly title: string;
	readonly status: string;
	readonly language: string;
	readonly questionCount: number;
}

@ApiTags("quizzes")
@Controller("quizzes")
export class QuizzesController {
	constructor(
		@Inject(ListQuizSetsUseCase)
		private readonly listQuizSets: ListQuizSetsUseCase,
		@Inject(GetQuizSetUseCase)
		private readonly getQuizSet: GetQuizSetUseCase,
	) {}

	@Get()
	@ApiOkResponse({ description: "Every quiz the owner can practise." })
	async list(
		@Query("includeUnpublished") includeUnpublished?: string,
	): Promise<readonly QuizSummaryBody[]> {
		const summaries = await this.listQuizSets.execute({
			includeUnpublished: includeUnpublished === "true",
		});

		return summaries.map((summary) => ({
			id: String(summary.id),
			title: summary.title,
			status: summary.status,
			questionCount: summary.questionCount,
			updatedAt: summary.updatedAt.toISOString(),
		}));
	}

	@Get(":id")
	@ApiOkResponse({ description: "One quiz and how many questions it holds." })
	async detail(@Param("id") id: string): Promise<QuizDetailBody> {
		const quizSet = await this.getQuizSet.execute({
			quizSetId: toQuizSetId(id),
		});

		return {
			id: String(quizSet.id),
			title: quizSet.title,
			status: quizSet.status,
			language: quizSet.language,
			questionCount: quizSet.questions.length,
		};
	}
}
