import { Module } from "@nestjs/common";
import { AttemptsModule } from "@/modules/attempts";
import { QuizzesModule } from "@/modules/quizzes";
import { GetAttemptDetailUseCase, GetQuizStatisticsUseCase } from "./use-cases";

@Module({
	imports: [AttemptsModule, QuizzesModule],
	providers: [GetAttemptDetailUseCase, GetQuizStatisticsUseCase],
	exports: [GetAttemptDetailUseCase, GetQuizStatisticsUseCase],
})
export class StatisticsModule {}
