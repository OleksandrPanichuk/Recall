import { Module } from "@nestjs/common";
import { USE_CASE_DEPENDENCIES } from "@/application/tokens";
import type { ApplicationDependencies } from "@/application/use-case";
import { PagesModule } from "@/modules/pages";
import { QuizzesPublicController } from "./quizzes.public.controller";
import { QuizzesRepository } from "./quizzes.repository";
import { QuizzesSurfaceController } from "./quizzes.surface.controller";
import { ATTEMPTS, TERM_PAIRS } from "./quizzes.tokens";
import { PostgresQuizzesRepository } from "./repositories/quizzes.postgres.repository";
import {
	AddQuestionsUseCase,
	ArchiveQuizSetUseCase,
	CreateQuizSetUseCase,
	DeleteQuestionUseCase,
	GetQuizSetUseCase,
	ListQuestionsUseCase,
	ListQuizSetsUseCase,
	MoveQuizSetUseCase,
	PublishQuizSetUseCase,
	UpdateQuestionUseCase,
	UpdateQuizSetUseCase,
} from "./use-cases";

const useCases = [
	AddQuestionsUseCase,
	ArchiveQuizSetUseCase,
	CreateQuizSetUseCase,
	DeleteQuestionUseCase,
	GetQuizSetUseCase,
	ListQuestionsUseCase,
	ListQuizSetsUseCase,
	MoveQuizSetUseCase,
	PublishQuizSetUseCase,
	UpdateQuestionUseCase,
	UpdateQuizSetUseCase,
];

@Module({
	controllers: [QuizzesPublicController, QuizzesSurfaceController],
	imports: [PagesModule],
	providers: [
		{ provide: QuizzesRepository, useClass: PostgresQuizzesRepository },
		{
			provide: ATTEMPTS,
			inject: [USE_CASE_DEPENDENCIES],
			useFactory: (dependencies: ApplicationDependencies) =>
				dependencies.scope.attempts,
		},
		{
			provide: TERM_PAIRS,
			inject: [USE_CASE_DEPENDENCIES],
			useFactory: (dependencies: ApplicationDependencies) =>
				dependencies.scope.termPairs,
		},
		...useCases,
	],
	exports: [QuizzesRepository, ...useCases],
})
export class QuizzesModule {}
