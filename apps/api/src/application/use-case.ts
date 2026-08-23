import type { Clock } from "./ports/clock";
import type { IdGenerator } from "./ports/id-generator";
import type { RepositoryScope } from "./ports/repositories/page.repository";
import type { UnitOfWork } from "./ports/unit-of-work";

export type Command<TPayload> = Readonly<TPayload>;

export interface UseCase<TRequest, TResult> {
	execute(request: TRequest): Promise<TResult>;
}

export interface ApplicationDependencies {
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
	readonly clock: Clock;
	readonly idGenerator: IdGenerator;
	readonly timezone: string;
}
