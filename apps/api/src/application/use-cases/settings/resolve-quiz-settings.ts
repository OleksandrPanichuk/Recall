import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { FolderId } from "@/domain/folder/folder";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { RepetitionSettings } from "@/domain/repetition/repetition";
import {
	defaultQuizSettings,
	type QuizSettings,
} from "@/domain/settings/quiz-settings";
import { QuizSetNotFoundError } from "../quiz-sets/update-quiz-set";

export type QuizSettingsSource = "set" | "global" | "default";

export interface ResolvedQuizSettings {
	readonly settings: QuizSettings;
	readonly source: QuizSettingsSource;
	readonly quizSetId?: QuizSetId;
	readonly title?: string;
	readonly folderId?: FolderId;
}

export function resolveRepetitionSettings(
	repetition: RepetitionRepository,
	quizSetId: QuizSetId,
): RepetitionSettings {
	return resolveWithSource(repetition, quizSetId).settings.repetition;
}

export function resolveWithSource(
	repetition: RepetitionRepository,
	quizSetId: QuizSetId | undefined,
): ResolvedQuizSettings {
	const own =
		quizSetId === undefined ? undefined : repetition.findSettings(quizSetId);

	if (own !== undefined) {
		return { settings: own, source: "set" };
	}

	const global = repetition.findDefaults();

	if (global !== undefined) {
		return { settings: global, source: "global" };
	}

	return { settings: defaultQuizSettings(), source: "default" };
}

export interface ResolveQuizSettingsCommand {
	readonly quizSetId?: QuizSetId;
}

export interface ResolveQuizSettingsDependencies {
	readonly repetition: RepetitionRepository;
	readonly quizSets: QuizSetRepository;
}

export class ResolveQuizSettingsUseCase
	implements UseCase<Command<ResolveQuizSettingsCommand>, ResolvedQuizSettings>
{
	private readonly repetition: RepetitionRepository;
	private readonly quizSets: QuizSetRepository;

	constructor(dependencies: ResolveQuizSettingsDependencies) {
		this.repetition = dependencies.repetition;
		this.quizSets = dependencies.quizSets;
	}

	async execute(
		request: Command<ResolveQuizSettingsCommand>,
	): Promise<ResolvedQuizSettings> {
		if (request.quizSetId === undefined) {
			return resolveWithSource(this.repetition, undefined);
		}

		const quizSet = this.quizSets.findById(request.quizSetId);

		if (quizSet === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		return {
			...resolveWithSource(this.repetition, request.quizSetId),
			quizSetId: quizSet.id,
			title: quizSet.title,
			folderId: quizSet.folderId,
		};
	}
}
