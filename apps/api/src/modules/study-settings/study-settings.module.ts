import { Module } from "@nestjs/common";
import { QuizzesModule } from "@/modules/quizzes";
import { PostgresStudySettingsRepository } from "./repositories/study-settings.postgres.repository";
import { StudySettingsRepository } from "./study-settings.repository";
import { StudySettingsService } from "./study-settings.service";
import {
	ResolveQuizSettingsUseCase,
	UpdateQuizSettingsUseCase,
} from "./use-cases";

@Module({
	imports: [QuizzesModule],
	providers: [
		{
			provide: StudySettingsRepository,
			useClass: PostgresStudySettingsRepository,
		},
		StudySettingsService,
		ResolveQuizSettingsUseCase,
		UpdateQuizSettingsUseCase,
	],
	exports: [
		StudySettingsRepository,
		StudySettingsService,
		ResolveQuizSettingsUseCase,
		UpdateQuizSettingsUseCase,
	],
})
export class StudySettingsModule {}
