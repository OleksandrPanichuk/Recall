import { Module } from "@nestjs/common";
import { QuizzesModule } from "@/modules/quizzes";
import { PostgresSchedulesRepository } from "./repositories/schedules.postgres.repository";
import { SchedulesRepository } from "./scheduling.repository";
import { ListDueRepetitionsUseCase, ListLeechesUseCase } from "./use-cases";

@Module({
	imports: [QuizzesModule],
	providers: [
		{ provide: SchedulesRepository, useClass: PostgresSchedulesRepository },
		ListDueRepetitionsUseCase,
		ListLeechesUseCase,
	],
	exports: [SchedulesRepository, ListDueRepetitionsUseCase, ListLeechesUseCase],
})
export class SchedulingModule {}
