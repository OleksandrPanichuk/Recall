import type { Clock } from "@/application/ports/clock";
import type { FolderRepository } from "@/application/ports/repositories/folder.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
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

export interface MoveQuizSetDependencies {
	readonly quizSets: QuizSetRepository;
	readonly folders: FolderRepository;
	readonly clock: Clock;
}

export class MoveQuizSetUseCase
	implements UseCase<Command<MoveQuizSetCommand>, void>
{
	private readonly quizSets: QuizSetRepository;
	private readonly folders: FolderRepository;
	private readonly clock: Clock;

	constructor(dependencies: MoveQuizSetDependencies) {
		this.quizSets = dependencies.quizSets;
		this.folders = dependencies.folders;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<MoveQuizSetCommand>): Promise<void> {
		const stored = this.quizSets.findById(request.quizSetId);

		if (stored === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		if (request.folderId !== undefined) {
			requireFolder(this.folders, request.folderId);
		}

		this.quizSets.save(
			moveQuizSetToFolder(stored, request.folderId, this.clock.now()),
		);
	}
}
