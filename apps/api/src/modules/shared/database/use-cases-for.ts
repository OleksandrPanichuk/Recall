import type { OwnerId } from "@/application/ports/owner";
import {
	createUseCases,
	systemClock,
	type UseCases,
	uuidGenerator,
} from "@/composition/create-application";
import { DatabaseConnection } from "@/db/connection";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";

export type UseCasesFor = (owner: OwnerId) => UseCases;

export const useCasesFor =
	(connection: DatabaseConnection): UseCasesFor =>
	(owner) =>
		createUseCases({
			unitOfWork: createPostgresUnitOfWork(connection.db, owner),
			scope: readOnlyScope(connection.db, owner),
			clock: systemClock,
			idGenerator: uuidGenerator,
			timezone: process.env.APP_TIMEZONE ?? "UTC",
		});
