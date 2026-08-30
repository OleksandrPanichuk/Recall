import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type {
	ReviewRepository,
	SettingsScope,
} from "@/application/ports/repositories/review.repository";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
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

export const quizScope = (quizId: QuizSetId): SettingsScope => ({
	kind: "quiz",
	quizId,
});

export const ownerScope: SettingsScope = { kind: "owner" };

export async function resolveRepetitionSettings(
	reviews: ReviewRepository,
	quizSetId: QuizSetId,
): Promise<RepetitionSettings> {
	return (await resolveWithSource(reviews, quizSetId)).settings.repetition;
}

export async function resolveWithSource(
	reviews: ReviewRepository,
	quizSetId: QuizSetId | undefined,
): Promise<ResolvedQuizSettings> {
	const own =
		quizSetId === undefined
			? undefined
			: await reviews.findSettings(quizScope(quizSetId));

	if (own !== undefined) {
		return { settings: own, source: "set" };
	}

	const global = await reviews.findSettings(ownerScope);

	if (global !== undefined) {
		return { settings: global, source: "global" };
	}

	return { settings: defaultQuizSettings(), source: "default" };
}

export interface ResolveQuizSettingsCommand {
	readonly quizSetId?: QuizSetId;
}

export type ResolveQuizSettingsDependencies = ApplicationDependencies;

export class ResolveQuizSettingsUseCase
	implements UseCase<Command<ResolveQuizSettingsCommand>, ResolvedQuizSettings>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: ResolveQuizSettingsDependencies) {
		this.scope = dependencies.scope;
	}

	async execute(
		request: Command<ResolveQuizSettingsCommand>,
	): Promise<ResolvedQuizSettings> {
		const { reviews, quizzes } = this.scope;

		if (request.quizSetId === undefined) {
			return resolveWithSource(reviews, undefined);
		}

		const quizSet = await quizzes.findById(request.quizSetId);

		if (quizSet === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		return {
			...(await resolveWithSource(reviews, request.quizSetId)),
			quizSetId: quizSet.id,
			title: quizSet.title,
			folderId: quizSet.folderId,
		};
	}
}
