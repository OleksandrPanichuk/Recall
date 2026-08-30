import type { Provider } from "@nestjs/common";
import type { ApplicationDependencies } from "@/application/use-case";
import { GetQuizSetUseCase } from "@/application/use-cases/quiz-sets/get-quiz-set";
import { ListQuizSetsUseCase } from "@/application/use-cases/quiz-sets/list-quiz-sets";
import { USE_CASE_DEPENDENCIES } from "../shared/database/tokens";

export const contentUseCases: Provider[] = [
	{
		provide: ListQuizSetsUseCase,
		inject: [USE_CASE_DEPENDENCIES],
		useFactory: (dependencies: ApplicationDependencies) =>
			new ListQuizSetsUseCase(dependencies),
	},
	{
		provide: GetQuizSetUseCase,
		inject: [USE_CASE_DEPENDENCIES],
		useFactory: (dependencies: ApplicationDependencies) =>
			new GetQuizSetUseCase(dependencies),
	},
];
