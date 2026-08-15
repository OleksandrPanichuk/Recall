import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	createRepetitionSettings,
	type RepetitionSettings,
} from "@/domain/repetition/repetition";
import { QuizSetNotFoundError } from "../quiz-sets/update-quiz-set";

export interface UpdateRepetitionSettingsCommand {
	readonly quizSetId?: QuizSetId;
	readonly settings: RepetitionSettings;
}

export interface UpdateRepetitionSettingsDependencies {
	readonly repetition: RepetitionRepository;
	readonly quizSets: QuizSetRepository;
}

export class UpdateRepetitionSettings
	implements
		UseCase<Command<UpdateRepetitionSettingsCommand>, RepetitionSettings>
{
	private readonly repetition: RepetitionRepository;
	private readonly quizSets: QuizSetRepository;

	constructor(dependencies: UpdateRepetitionSettingsDependencies) {
		this.repetition = dependencies.repetition;
		this.quizSets = dependencies.quizSets;
	}

	async execute(
		request: Command<UpdateRepetitionSettingsCommand>,
	): Promise<RepetitionSettings> {
		const settings = createRepetitionSettings(request.settings);

		if (request.quizSetId === undefined) {
			this.repetition.saveDefaults(settings);
		} else if (this.quizSets.findById(request.quizSetId) === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		} else {
			this.repetition.saveSettings(request.quizSetId, settings);
		}

		return settings;
	}
}
