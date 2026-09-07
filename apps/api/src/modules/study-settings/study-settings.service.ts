import { Injectable } from "@nestjs/common";
import type { QuizSetId } from "@/modules/quizzes";
import type { RepetitionSettings } from "@/modules/scheduling";
import { StudySettingsEntity } from "./study-settings.entity";
import {
	type SettingsScope,
	StudySettingsRepository,
} from "./study-settings.repository";

export type StudySettingsSource = "set" | "global" | "default";

export interface ResolvedStudySettings {
	readonly settings: StudySettingsEntity;
	readonly source: StudySettingsSource;
	readonly quizSetId?: QuizSetId;
	readonly title?: string;
}

export const OWNER_SCOPE: SettingsScope = { kind: "owner" };

export const quizScope = (quizId: QuizSetId): SettingsScope => ({
	kind: "quiz",
	quizId,
});

@Injectable()
export class StudySettingsService {
	constructor(private readonly settings: StudySettingsRepository) {}

	async resolve(
		quizSetId: QuizSetId | undefined,
	): Promise<ResolvedStudySettings> {
		const own =
			quizSetId === undefined
				? undefined
				: await this.settings.findSettings(quizScope(quizSetId));

		if (own !== undefined) {
			return { settings: own, source: "set" };
		}

		const global = await this.settings.findSettings(OWNER_SCOPE);

		if (global !== undefined) {
			return { settings: global, source: "global" };
		}

		return { settings: StudySettingsEntity.defaults(), source: "default" };
	}

	async repetitionFor(quizSetId: QuizSetId): Promise<RepetitionSettings> {
		return (await this.resolve(quizSetId)).settings.repetition;
	}

	save(scope: SettingsScope, settings: StudySettingsEntity): Promise<void> {
		return this.settings.saveSettings(scope, settings);
	}

	clear(scope: SettingsScope): Promise<void> {
		return this.settings.clearSettings(scope);
	}
}
