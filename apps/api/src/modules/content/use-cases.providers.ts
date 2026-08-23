import type { Provider } from "@nestjs/common";
import { GetQuizSetUseCase } from "@/application/use-cases/quiz-sets/get-quiz-set";
import { ListQuizSetsUseCase } from "@/application/use-cases/quiz-sets/list-quiz-sets";
import type { UseCaseDependencies } from "../shared/database/database.module";
import { USE_CASE_DEPENDENCIES } from "../shared/database/tokens";

export const contentUseCases: Provider[] = [
	{
		provide: ListQuizSetsUseCase,
		inject: [USE_CASE_DEPENDENCIES],
		useFactory: (dependencies: UseCaseDependencies) =>
			new ListQuizSetsUseCase(dependencies),
	},
	{
		provide: GetQuizSetUseCase,
		inject: [USE_CASE_DEPENDENCIES],
		useFactory: (dependencies: UseCaseDependencies) =>
			new GetQuizSetUseCase(dependencies),
	},
];
