import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	createRepetitionSettings,
	type RepetitionSettings,
} from "@/domain/repetition/repetition";

export interface UpdateRepetitionSettingsCommand {
	readonly quizSetId?: QuizSetId;
	readonly settings: RepetitionSettings;
}

export interface UpdateRepetitionSettingsDependencies {
	readonly repetition: RepetitionRepository;
}

export class UpdateRepetitionSettings
	implements
		UseCase<Command<UpdateRepetitionSettingsCommand>, RepetitionSettings>
{
	private readonly repetition: RepetitionRepository;

	constructor(dependencies: UpdateRepetitionSettingsDependencies) {
		this.repetition = dependencies.repetition;
	}

	async execute(
		request: Command<UpdateRepetitionSettingsCommand>,
	): Promise<RepetitionSettings> {
		const settings = createRepetitionSettings(request.settings);

		if (request.quizSetId === undefined) {
			this.repetition.saveDefaults(settings);
		} else {
			this.repetition.saveSettings(request.quizSetId, settings);
		}

		return settings;
	}
}
