import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { FolderId } from "@/domain/folder/folder";
import {
	createQuizSet,
	moveQuizSetToFolder,
	type QuizSetId,
	toQuizSetId,
} from "@/domain/quiz-set/quiz-set";

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

export interface CreateQuizSetDependencies {
	readonly quizSets: QuizSetRepository;
	readonly clock: Clock;
	readonly idGenerator: IdGenerator;
}

export class CreateQuizSet
	implements UseCase<Command<CreateQuizSetCommand>, CreateQuizSetResult>
{
	private readonly quizSets: QuizSetRepository;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;

	constructor(dependencies: CreateQuizSetDependencies) {
		this.quizSets = dependencies.quizSets;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
	}

	async execute(
		request: Command<CreateQuizSetCommand>,
	): Promise<CreateQuizSetResult> {
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

		this.quizSets.save(
			request.folderId === undefined
				? quizSet
				: moveQuizSetToFolder(quizSet, request.folderId, quizSet.createdAt),
		);

		return { quizSetId: quizSet.id };
	}
}
