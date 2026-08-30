import { Module } from "@nestjs/common";
import { GetQuizSetUseCase } from "@/application/use-cases/quiz-sets/get-quiz-set";
import { ListQuizSetsUseCase } from "@/application/use-cases/quiz-sets/list-quiz-sets";
import { QuizzesController } from "./quizzes.controller";
import { contentUseCases } from "./use-cases.providers";

@Module({
	controllers: [QuizzesController],
	providers: [...contentUseCases],
	exports: [ListQuizSetsUseCase, GetQuizSetUseCase],
})
export class ContentModule {}
