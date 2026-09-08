import type { Clock } from "@/core/ports/clock";
import type { IdGenerator } from "@/core/ports/id-generator";
import type { RepositoryScope } from "./repository-scope";
import type { UnitOfWork } from "./unit-of-work";

export { type Command, UseCase } from "@/core/use-case";

export interface ApplicationDependencies {
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
	readonly clock: Clock;
	readonly idGenerator: IdGenerator;
	readonly timezone: string;
}
