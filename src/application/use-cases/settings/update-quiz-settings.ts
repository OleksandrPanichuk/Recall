import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { RepetitionSettings } from "@/domain/repetition/repetition";
import {
	createQuizSettings,
	type QuizSettings,
} from "@/domain/settings/quiz-settings";
import { QuizSetNotFoundError } from "../quiz-sets/update-quiz-set";
import { resolveWithSource } from "./resolve-quiz-settings";

export interface UpdateQuizSettingsCommand {
	readonly quizSetId?: QuizSetId;
	readonly repetition?: RepetitionSettings;
	readonly shuffleOptions?: boolean;
	readonly shuffleQuestions?: boolean;
	readonly examMode?: boolean;
	readonly inheritGlobal?: boolean;
}

export interface UpdateQuizSettingsDependencies {
	readonly repetition: RepetitionRepository;
	readonly quizSets: QuizSetRepository;
}

export class UpdateQuizSettings
	implements UseCase<Command<UpdateQuizSettingsCommand>, QuizSettings>
{
	private readonly repetition: RepetitionRepository;
	private readonly quizSets: QuizSetRepository;

	constructor(dependencies: UpdateQuizSettingsDependencies) {
		this.repetition = dependencies.repetition;
		this.quizSets = dependencies.quizSets;
	}

	async execute(
		request: Command<UpdateQuizSettingsCommand>,
	): Promise<QuizSettings> {
		const { quizSetId } = request;

		if (
			quizSetId !== undefined &&
			this.quizSets.findById(quizSetId) === undefined
		) {
			throw new QuizSetNotFoundError(quizSetId);
		}

		if (request.inheritGlobal === true && quizSetId !== undefined) {
			this.repetition.clearSettings(quizSetId);

			return resolveWithSource(this.repetition, quizSetId).settings;
		}

		const current = resolveWithSource(this.repetition, quizSetId).settings;
		const settings = createQuizSettings({
			repetition: request.repetition ?? current.repetition,
			shuffleOptions: request.shuffleOptions ?? current.shuffleOptions,
			shuffleQuestions: request.shuffleQuestions ?? current.shuffleQuestions,
			examMode: request.examMode ?? current.examMode,
		});

		if (quizSetId === undefined) {
			this.repetition.saveDefaults(settings);
		} else {
			this.repetition.saveSettings(quizSetId, settings);
		}

		return settings;
	}
}
