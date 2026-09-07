import { Module } from "@nestjs/common";
import { QuizzesModule } from "@/modules/quizzes";
import { SchedulingModule } from "@/modules/scheduling";
import { StudySettingsModule } from "@/modules/study-settings";
import { AttemptsController } from "./attempts.controller";
import { AttemptsRepository } from "./attempts.repository";
import { PostgresAttemptsRepository } from "./repositories/attempts.postgres.repository";
import {
	AbandonQuizAttemptUseCase,
	AnswerQuestionUseCase,
	FinishQuizAttemptUseCase,
	GetCurrentQuestionUseCase,
	PauseQuizAttemptUseCase,
	RateRecallUseCase,
	ResumeQuizAttemptUseCase,
	StartQuizAttemptUseCase,
} from "./use-cases";

const useCases = [
	AbandonQuizAttemptUseCase,
	AnswerQuestionUseCase,
	FinishQuizAttemptUseCase,
	GetCurrentQuestionUseCase,
	PauseQuizAttemptUseCase,
	RateRecallUseCase,
	ResumeQuizAttemptUseCase,
	StartQuizAttemptUseCase,
];

@Module({
	controllers: [AttemptsController],
	imports: [QuizzesModule, SchedulingModule, StudySettingsModule],
	providers: [
		{ provide: AttemptsRepository, useClass: PostgresAttemptsRepository },
		...useCases,
	],
	exports: [AttemptsRepository, ...useCases],
})
export class AttemptsModule {}
