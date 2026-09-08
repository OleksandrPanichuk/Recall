import type { RecallDatabase } from "@/db/client";
import { Database } from "@/db/connection";
import { PostgresTransaction } from "@/db/executor";
import {
	ApiTokensService,
	PostgresApiTokensRepository,
} from "@/modules/api-tokens";
import {
	AuthEngine,
	AuthService,
	PostgresAuthRepository,
} from "@/modules/auth";
import { PostgresUsersRepository, UsersService } from "@/modules/users";

class DirectDatabase extends Database {
	constructor(readonly db: RecallDatabase) {
		super();
	}
}

export const databaseOver = (db: RecallDatabase): Database =>
	new DirectDatabase(db);

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
	return new ApiTokensService(
		new PostgresApiTokensRepository(databaseOver(db)),
		authOver(db),
		{ now: () => new Date() },
	);
}
