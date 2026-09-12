import type { SchedulesRepository } from "@/modules/scheduling";
import type { StudySettingsRepository } from "@/modules/study-settings";

export type { SettingsScope } from "@/modules/study-settings";

export type ReviewRepository = SchedulesRepository & StudySettingsRepository;
