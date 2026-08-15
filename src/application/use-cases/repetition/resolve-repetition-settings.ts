import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	defaultRepetitionSettings,
	type RepetitionSettings,
} from "@/domain/repetition/repetition";
import { QuizSetNotFoundError } from "../quiz-sets/update-quiz-set";

export type RepetitionSettingsSource = "set" | "global" | "default";

export interface ResolvedRepetitionSettings {
	readonly settings: RepetitionSettings;
	readonly source: RepetitionSettingsSource;
}

export function resolveRepetitionSettings(
	repetition: RepetitionRepository,
	quizSetId: QuizSetId,
): RepetitionSettings {
	return resolveWithSource(repetition, quizSetId).settings;
}

export function resolveWithSource(
	repetition: RepetitionRepository,
	quizSetId: QuizSetId | undefined,
): ResolvedRepetitionSettings {
	const own =
		quizSetId === undefined ? undefined : repetition.findSettings(quizSetId);

	if (own !== undefined) {
		return { settings: own, source: "set" };
	}

	const global = repetition.findDefaults();

	if (global !== undefined) {
		return { settings: global, source: "global" };
	}

	return { settings: defaultRepetitionSettings(), source: "default" };
}

export interface ResolveRepetitionSettingsCommand {
	readonly quizSetId?: QuizSetId;
}

export interface ResolveRepetitionSettingsDependencies {
	readonly repetition: RepetitionRepository;
	readonly quizSets: QuizSetRepository;
}

export class ResolveRepetitionSettings
	implements
		UseCase<
			Command<ResolveRepetitionSettingsCommand>,
			ResolvedRepetitionSettings
		>
{
	private readonly repetition: RepetitionRepository;
	private readonly quizSets: QuizSetRepository;

	constructor(dependencies: ResolveRepetitionSettingsDependencies) {
		this.repetition = dependencies.repetition;
		this.quizSets = dependencies.quizSets;
	}

	async execute(
		request: Command<ResolveRepetitionSettingsCommand>,
	): Promise<ResolvedRepetitionSettings> {
		if (
			request.quizSetId !== undefined &&
			this.quizSets.findById(request.quizSetId) === undefined
		) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		return resolveWithSource(this.repetition, request.quizSetId);
	}
}
