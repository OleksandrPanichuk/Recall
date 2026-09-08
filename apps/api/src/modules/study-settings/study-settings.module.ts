import { Module } from "@nestjs/common";
import { QuizzesModule } from "@/modules/quizzes";
import { PostgresStudySettingsRepository } from "./repositories/study-settings.postgres.repository";
import { StudySettingsController } from "./study-settings.controller";
import { StudySettingsRepository } from "./study-settings.repository";
import { StudySettingsService } from "./study-settings.service";
import {
	ResolveQuizSettingsUseCase,
	UpdateQuizSettingsUseCase,
} from "./use-cases";

@Module({
	controllers: [StudySettingsController],
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
