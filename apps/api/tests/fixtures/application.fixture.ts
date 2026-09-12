import {
	createUseCases,
	type UseCases,
} from "@tests/fixtures/application.use-cases";
import {
	createMemoryContext,
	type MemoryContext,
	type MemoryContextOptions,
} from "@tests/fixtures/memory.fixture";

export interface MemoryApplication extends UseCases {
	readonly context: MemoryContext;
	close(): Promise<void>;
}

export function createMemoryApplication(
	options: MemoryContextOptions = {},
): MemoryApplication {
	const context = createMemoryContext(options);

	return {
		context,
		...createUseCases(context),
		close: async () => {
			context.close();
		},
	};
}
