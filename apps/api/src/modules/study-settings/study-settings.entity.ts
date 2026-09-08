import { type RepetitionSettings, ScheduleEntity } from "@/modules/scheduling";

export interface StudySettingsEntity {
	readonly repetition: RepetitionSettings;
	readonly shuffleOptions: boolean;
	readonly shuffleQuestions: boolean;
	readonly examMode: boolean;
}

export class StudySettingsEntity {
	private constructor() {}

	static defaults(): StudySettingsEntity {
		return Object.freeze({
			repetition: ScheduleEntity.defaultSettings(),
			shuffleOptions: false,
			shuffleQuestions: false,
			examMode: false,
		});
	}

	static create(draft: StudySettingsEntity): StudySettingsEntity {
		return Object.freeze({
			repetition: ScheduleEntity.createSettings(draft.repetition),
			shuffleOptions: draft.shuffleOptions === true,
			shuffleQuestions: draft.shuffleQuestions === true,
			examMode: draft.examMode === true,
		});
	}

	static withRepetition(
		settings: StudySettingsEntity,
		repetition: RepetitionSettings,
	): StudySettingsEntity {
		return StudySettingsEntity.create({ ...settings, repetition });
	}

	static withShuffleOptions(
		settings: StudySettingsEntity,
		shuffleOptions: boolean,
	): StudySettingsEntity {
		return StudySettingsEntity.create({ ...settings, shuffleOptions });
	}

	static withShuffleQuestions(
		settings: StudySettingsEntity,
		shuffleQuestions: boolean,
	): StudySettingsEntity {
		return StudySettingsEntity.create({ ...settings, shuffleQuestions });
	}

	static withExamMode(
		settings: StudySettingsEntity,
		examMode: boolean,
	): StudySettingsEntity {
		return StudySettingsEntity.create({ ...settings, examMode });
	}
}
