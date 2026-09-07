import type { OwnerId } from "@/application/ports/owner";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { RecallDatabase } from "@/db/client";
import { DatabaseHandle } from "@/db/connection";
import {
	DatabaseExecutor,
	type Executor,
	PostgresTransaction,
} from "@/db/executor";
import { PostgresAttachmentsRepository } from "@/modules/attachments";
import { PostgresPagesRepository } from "@/modules/pages";
import { PostgresQuizzesRepository } from "@/modules/quizzes";
import { PostgresTermPairsRepository } from "@/modules/vocabulary";
import { FixedOwnerContext } from "@/shared/request-context";
import { createAnalyticsPostgresRepository } from "./repositories/analytics.repository";
import { createAttemptPostgresRepository } from "./repositories/attempt.repository";
import { createReviewPostgresRepository } from "./repositories/review.repository";

export type { Executor } from "@/db/executor";

export const scopeFor = (
	db: RecallDatabase,
	owner: OwnerId,
): RepositoryScope => {
	const executor: Executor = DatabaseExecutor.for(db);

	return {
		pages: new PostgresPagesRepository(
			new DatabaseHandle(db),
			new FixedOwnerContext(owner),
		),
		quizzes: new PostgresQuizzesRepository(
			new DatabaseHandle(db),
			new FixedOwnerContext(owner),
		),
		attempts: createAttemptPostgresRepository(executor, owner),
		reviews: createReviewPostgresRepository(executor, owner),
		termPairs: new PostgresTermPairsRepository(
			new DatabaseHandle(db),
			new FixedOwnerContext(owner),
		),
		analytics: createAnalyticsPostgresRepository(executor, owner),
		attachments: new PostgresAttachmentsRepository(
			new DatabaseHandle(db),
			new FixedOwnerContext(owner),
		),
	};
};

export function createPostgresUnitOfWork(
	db: RecallDatabase,
	owner: OwnerId,
): UnitOfWork<RepositoryScope> {
	const transaction = new PostgresTransaction(() => db);

	return {
		run: (operation) => transaction.run(() => operation(scopeFor(db, owner))),
	};
}

export const readOnlyScope = (
	db: RecallDatabase,
	owner: OwnerId,
): RepositoryScope => scopeFor(db, owner);
