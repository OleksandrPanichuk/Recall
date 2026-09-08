import { Injectable } from "@nestjs/common";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import {
	type QuizSetId,
	QuizSetNotFoundError,
	QuizzesRepository,
} from "@/modules/quizzes";
import type { RepetitionSettings } from "@/modules/scheduling";
import { StudySettingsEntity } from "../study-settings.entity";
import {
	OWNER_SCOPE,
	quizScope,
	StudySettingsService,
} from "../study-settings.service";

export interface UpdateQuizSettingsUseCaseOptions {
	readonly quizSetId?: QuizSetId;
	readonly repetition?: RepetitionSettings;
	readonly shuffleOptions?: boolean;
	readonly shuffleQuestions?: boolean;
	readonly examMode?: boolean;
	readonly inheritGlobal?: boolean;
}

type Options = UpdateQuizSettingsUseCaseOptions;
type Result = StudySettingsEntity;

@Injectable()
export class UpdateQuizSettingsUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly settings: StudySettingsService,
		private readonly quizzes: QuizzesRepository,
		private readonly transaction: Transaction,
	) {
		super();
	}

	execute(options: Options): Promise<Result> {
		return this.transaction.run(async () => {
			const { quizSetId } = options;

			if (
				quizSetId !== undefined &&
				(await this.quizzes.findById(quizSetId)) === undefined
			) {
				throw new QuizSetNotFoundError(quizSetId);
			}

			if (options.inheritGlobal === true && quizSetId !== undefined) {
				await this.settings.clear(quizScope(quizSetId));

				return (await this.settings.resolve(quizSetId)).settings;
			}

			const current = (await this.settings.resolve(quizSetId)).settings;
			const settings = StudySettingsEntity.create({
				repetition: options.repetition ?? current.repetition,
				shuffleOptions: options.shuffleOptions ?? current.shuffleOptions,
				shuffleQuestions: options.shuffleQuestions ?? current.shuffleQuestions,
				examMode: options.examMode ?? current.examMode,
			});

			await this.settings.save(
				quizSetId === undefined ? OWNER_SCOPE : quizScope(quizSetId),
				settings,
			);

			return settings;
		});
	}
}
