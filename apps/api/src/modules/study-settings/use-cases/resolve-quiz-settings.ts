import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import type { PageId } from "@/modules/pages";
import {
	type QuizSetId,
	QuizSetNotFoundError,
	QuizzesRepository,
} from "@/modules/quizzes";
import {
	type ResolvedStudySettings,
	StudySettingsService,
} from "../study-settings.service";

export interface ResolveQuizSettingsUseCaseOptions {
	readonly quizSetId?: QuizSetId;
}

export interface ResolvedQuizSettings extends ResolvedStudySettings {
	readonly folderId?: PageId;
}

type Options = ResolveQuizSettingsUseCaseOptions;
type Result = ResolvedQuizSettings;

@Injectable()
export class ResolveQuizSettingsUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly settings: StudySettingsService,
		private readonly quizzes: QuizzesRepository,
	) {
		super();
	}

	async execute({ quizSetId }: Options): Promise<Result> {
		const resolved = await this.settings.resolve(quizSetId);

		if (quizSetId === undefined) {
			return resolved;
		}

		const quizSet = await this.quizzes.findById(quizSetId);

		if (quizSet === undefined) {
			throw new QuizSetNotFoundError(quizSetId);
		}

		return {
			...resolved,
			quizSetId: quizSet.id,
			title: quizSet.title,
			folderId: quizSet.folderId,
		};
	}
}
