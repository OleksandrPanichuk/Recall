import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import { type QuizSetId, QuizSetNotFoundError } from "@/modules/quizzes";
import { type RepetitionSettings } from "@/modules/scheduling";
import { StudySettingsEntity } from "@/modules/study-settings";
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
	implements UseCase<Command<UpdateQuizSettingsCommand>, StudySettingsEntity>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;

	constructor(dependencies: UpdateQuizSettingsDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
	}

	execute(
		request: Command<UpdateQuizSettingsCommand>,
	): Promise<StudySettingsEntity> {
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
			const settings = StudySettingsEntity.create({
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
