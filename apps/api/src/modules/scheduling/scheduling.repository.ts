import type { QuestionId } from "@/modules/quizzes";
import type { ScheduleEntity } from "./schedule.entity";

export abstract class SchedulesRepository {
	abstract saveSchedules(schedules: readonly ScheduleEntity[]): Promise<void>;
	abstract findSchedules(
		questionIds: readonly QuestionId[],
	): Promise<readonly ScheduleEntity[]>;
	abstract listDue(at: Date): Promise<readonly ScheduleEntity[]>;
	abstract listLeeches(threshold: number): Promise<readonly ScheduleEntity[]>;
}
