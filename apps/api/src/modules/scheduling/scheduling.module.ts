import { Module } from "@nestjs/common";
import { QuizzesModule } from "@/modules/quizzes";
import { PostgresSchedulesRepository } from "./repositories/schedules.postgres.repository";
import { SchedulingController } from "./scheduling.controller";
import { SchedulesRepository } from "./scheduling.repository";
import {
	ListDueRepetitionsUseCase,
	ListLeechesUseCase,
	ListRetiredUseCase,
	RetireQuestionUseCase,
} from "./use-cases";

@Module({
	controllers: [SchedulingController],
	imports: [QuizzesModule],
	providers: [
		{ provide: SchedulesRepository, useClass: PostgresSchedulesRepository },
		ListDueRepetitionsUseCase,
		ListLeechesUseCase,
		ListRetiredUseCase,
		RetireQuestionUseCase,
	],
	exports: [
		SchedulesRepository,
		ListDueRepetitionsUseCase,
		ListLeechesUseCase,
		ListRetiredUseCase,
		RetireQuestionUseCase,
	],
})
export class SchedulingModule {}
