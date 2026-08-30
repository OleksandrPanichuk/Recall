import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import type { FolderId } from "@/domain/folder/folder";
import {
	createQuizSet,
	moveQuizSetToFolder,
	type QuizSetId,
	toQuizSetId,
} from "@/domain/quiz-set/quiz-set";
import { requireFolder } from "../folders/create-folder";

export interface CreateQuizSetCommand {
	readonly title: string;
	readonly language: string;
	readonly description?: string;
	readonly source?: string;
	readonly sourceChapters?: string;
	readonly tags?: readonly string[];
	readonly folderId?: FolderId;
}

export interface CreateQuizSetResult {
	readonly quizSetId: QuizSetId;
}

export type CreateQuizSetDependencies = ApplicationDependencies;

export class CreateQuizSetUseCase
	implements UseCase<Command<CreateQuizSetCommand>, CreateQuizSetResult>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;

	constructor(dependencies: CreateQuizSetDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
	}

	execute(
		request: Command<CreateQuizSetCommand>,
	): Promise<CreateQuizSetResult> {
		return this.unitOfWork.run(async ({ pages, quizzes }) => {
			if (request.folderId !== undefined) {
				await requireFolder(pages, request.folderId);
			}

			const quizSet = createQuizSet({
				id: toQuizSetId(this.idGenerator.generate()),
				title: request.title,
				language: request.language,
				createdAt: this.clock.now(),
				description: request.description,
				source: request.source,
				sourceChapters: request.sourceChapters,
				tags: request.tags,
			});

			await quizzes.save(
				request.folderId === undefined
					? quizSet
					: moveQuizSetToFolder(quizSet, request.folderId, quizSet.createdAt),
			);

			return { quizSetId: quizSet.id };
		});
	}
}
