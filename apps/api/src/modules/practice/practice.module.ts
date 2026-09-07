import { Module } from "@nestjs/common";
import { AttemptsModule } from "@/modules/attempts";
import { QuizzesModule } from "@/modules/quizzes";
import { StudySettingsModule } from "@/modules/study-settings";
import { StartPracticeSessionUseCase } from "./use-cases";

@Module({
	imports: [AttemptsModule, QuizzesModule, StudySettingsModule],
	providers: [StartPracticeSessionUseCase],
	exports: [StartPracticeSessionUseCase],
})
export class PracticeModule {}
