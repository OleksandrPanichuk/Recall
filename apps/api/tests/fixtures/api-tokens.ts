import type { RecallDatabase } from "@/db/client";
import { Database, DatabaseHandle } from "@/db/connection";
import { PostgresTransaction } from "@/db/executor";
import {
	ApiTokensService,
	PostgresApiTokenCredentials,
	PostgresApiTokensRepository,
} from "@/modules/api-tokens";
import {
	AuthEngine,
	AuthService,
	PostgresAuthRepository,
} from "@/modules/auth";
import { PostgresUsersRepository, UsersService } from "@/modules/users";
import { AlsOwnerContext } from "@/shared/request-context";

export const databaseOver = (db: RecallDatabase): Database =>
	new DatabaseHandle(db);

export function authOver(db: RecallDatabase): AuthService {
	const database = databaseOver(db);

	return new AuthService(
		new PostgresAuthRepository(database),
		new UsersService(new PostgresUsersRepository(database)),
		new AuthEngine(undefined),
		new PostgresTransaction(() => db),
	);
}

export function issuerOver(db: RecallDatabase): ApiTokensService {
	const database = databaseOver(db);

	return new ApiTokensService(
		new PostgresApiTokensRepository(database, new AlsOwnerContext()),
		new PostgresApiTokenCredentials(database),
		authOver(db),
		{ now: () => new Date() },
	);
}
