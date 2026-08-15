import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	defaultRepetitionSettings,
	type RepetitionSettings,
} from "@/domain/repetition/repetition";

export function resolveRepetitionSettings(
	repetition: RepetitionRepository,
	quizSetId: QuizSetId,
): RepetitionSettings {
	return (
		repetition.findSettings(quizSetId) ??
		repetition.findDefaults() ??
		defaultRepetitionSettings()
	);
}

export interface ResolveRepetitionSettingsCommand {
	readonly quizSetId: QuizSetId;
}

export interface ResolveRepetitionSettingsDependencies {
	readonly repetition: RepetitionRepository;
}

export class ResolveRepetitionSettings
	implements
		UseCase<Command<ResolveRepetitionSettingsCommand>, RepetitionSettings>
{
	private readonly repetition: RepetitionRepository;

	constructor(dependencies: ResolveRepetitionSettingsDependencies) {
		this.repetition = dependencies.repetition;
	}

	async execute(
		request: Command<ResolveRepetitionSettingsCommand>,
	): Promise<RepetitionSettings> {
		return resolveRepetitionSettings(this.repetition, request.quizSetId);
	}
}
