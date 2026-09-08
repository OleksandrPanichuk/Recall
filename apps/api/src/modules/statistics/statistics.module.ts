import { Module } from "@nestjs/common";
import { AttemptsModule } from "@/modules/attempts";
import { QuizzesModule } from "@/modules/quizzes";
import { StatisticsController } from "./statistics.controller";
import { GetAttemptDetailUseCase, GetQuizStatisticsUseCase } from "./use-cases";

@Module({
	controllers: [StatisticsController],
	imports: [AttemptsModule, QuizzesModule],
	providers: [GetAttemptDetailUseCase, GetQuizStatisticsUseCase],
	exports: [GetAttemptDetailUseCase, GetQuizStatisticsUseCase],
})
export class StatisticsModule {}
