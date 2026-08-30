import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import type { FolderId } from "@/domain/folder/folder";
import {
	moveQuizSetToFolder,
	type QuizSetId,
} from "@/domain/quiz-set/quiz-set";
import { requireFolder } from "../folders/create-folder";
import { QuizSetNotFoundError } from "./update-quiz-set";

export interface MoveQuizSetCommand {
	readonly quizSetId: QuizSetId;
	readonly folderId?: FolderId;
}

export type MoveQuizSetDependencies = ApplicationDependencies;

export class MoveQuizSetUseCase
	implements UseCase<Command<MoveQuizSetCommand>, void>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: MoveQuizSetDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<MoveQuizSetCommand>): Promise<void> {
		await this.unitOfWork.run(async ({ pages, quizzes }) => {
			const stored = await quizzes.findById(request.quizSetId);

			if (stored === undefined) {
				throw new QuizSetNotFoundError(request.quizSetId);
			}

			if (request.folderId !== undefined) {
				await requireFolder(pages, request.folderId);
			}

			await quizzes.save(
				moveQuizSetToFolder(stored, request.folderId, this.clock.now()),
			);
		});
	}
}
