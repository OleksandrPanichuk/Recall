import { Module } from "@nestjs/common";
import { PagesModule } from "@/modules/pages";
import { QuizzesPublicController } from "./quizzes.public.controller";
import { QuizzesRepository } from "./quizzes.repository";
import { QuizzesSurfaceController } from "./quizzes.surface.controller";
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
		...useCases,
	],
	exports: [QuizzesRepository, ...useCases],
})
export class QuizzesModule {}
