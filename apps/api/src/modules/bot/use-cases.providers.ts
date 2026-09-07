import type { Provider } from "@nestjs/common";
import { USE_CASE_DEPENDENCIES } from "@/application/tokens";
import type { ApplicationDependencies } from "@/application/use-case";
import { AttachQuizUseCase } from "@/application/use-cases/folders/attach-quiz";
import { BrowseFolderUseCase } from "@/application/use-cases/folders/browse-folder";

type Constructor = new (dependencies: ApplicationDependencies) => unknown;

const fromDependencies = (useCase: Constructor): Provider => ({
	provide: useCase,
	inject: [USE_CASE_DEPENDENCIES],
	useFactory: (dependencies: ApplicationDependencies) =>
		new useCase(dependencies),
});

export const botUseCases: Provider[] = [
	AttachQuizUseCase,
	BrowseFolderUseCase,
].map((useCase) => fromDependencies(useCase as unknown as Constructor));
