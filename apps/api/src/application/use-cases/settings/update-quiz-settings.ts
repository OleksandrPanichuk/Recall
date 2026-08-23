import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { RepetitionSettings } from "@/domain/repetition/repetition";
import {
	createQuizSettings,
	type QuizSettings,
} from "@/domain/settings/quiz-settings";
import { QuizSetNotFoundError } from "../quiz-sets/update-quiz-set";
import {
	ownerScope,
	quizScope,
	resolveWithSource,
} from "./resolve-quiz-settings";

export interface UpdateQuizSettingsCommand {
	readonly quizSetId?: QuizSetId;
	readonly repetition?: RepetitionSettings;
	readonly shuffleOptions?: boolean;
	readonly shuffleQuestions?: boolean;
	readonly examMode?: boolean;
	readonly inheritGlobal?: boolean;
}

export type UpdateQuizSettingsDependencies = ApplicationDependencies;

export class UpdateQuizSettingsUseCase
	implements UseCase<Command<UpdateQuizSettingsCommand>, QuizSettings>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;

	constructor(dependencies: UpdateQuizSettingsDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
	}

	execute(request: Command<UpdateQuizSettingsCommand>): Promise<QuizSettings> {
		return this.unitOfWork.run(async ({ quizzes, reviews }) => {
			const { quizSetId } = request;

			if (
				quizSetId !== undefined &&
				(await quizzes.findById(quizSetId)) === undefined
			) {
				throw new QuizSetNotFoundError(quizSetId);
			}

			if (request.inheritGlobal === true && quizSetId !== undefined) {
				await reviews.clearSettings(quizScope(quizSetId));

				return (await resolveWithSource(reviews, quizSetId)).settings;
			}

			const current = (await resolveWithSource(reviews, quizSetId)).settings;
			const settings = createQuizSettings({
				repetition: request.repetition ?? current.repetition,
				shuffleOptions: request.shuffleOptions ?? current.shuffleOptions,
				shuffleQuestions: request.shuffleQuestions ?? current.shuffleQuestions,
				examMode: request.examMode ?? current.examMode,
			});

			await reviews.saveSettings(
				quizSetId === undefined ? ownerScope : quizScope(quizSetId),
				settings,
			);

			return settings;
		});
	}
}
