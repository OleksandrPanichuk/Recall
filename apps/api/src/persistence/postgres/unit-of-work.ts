import type { OwnerId } from "@/application/ports/owner";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { RecallDatabase } from "@/db/client";
import {
	DatabaseExecutor,
	type Executor,
	PostgresTransaction,
} from "@/db/executor";
import { createAnalyticsPostgresRepository } from "./repositories/analytics.repository";
import { createAttachmentPostgresRepository } from "./repositories/attachment.repository";
import { createAttemptPostgresRepository } from "./repositories/attempt.repository";
import { createPagePostgresRepository } from "./repositories/page.repository";
import { createQuizPostgresRepository } from "./repositories/quiz.repository";
import { createReviewPostgresRepository } from "./repositories/review.repository";
import { createTermPairPostgresRepository } from "./repositories/term-pair.repository";

export type { Executor } from "@/db/executor";

export const scopeFor = (
	executor: Executor,
	owner: OwnerId,
): RepositoryScope => ({
	pages: createPagePostgresRepository(executor, owner),
	quizzes: createQuizPostgresRepository(executor, owner),
	attempts: createAttemptPostgresRepository(executor, owner),
	reviews: createReviewPostgresRepository(executor, owner),
	termPairs: createTermPairPostgresRepository(executor, owner),
	analytics: createAnalyticsPostgresRepository(executor, owner),
	attachments: createAttachmentPostgresRepository(executor, owner),
});

export function createPostgresUnitOfWork(
	db: RecallDatabase,
	owner: OwnerId,
): UnitOfWork<RepositoryScope> {
	const transaction = new PostgresTransaction(db);

	return {
		run: (operation) =>
			transaction.run(() =>
				operation(scopeFor(DatabaseExecutor.for(db), owner)),
			),
	};
}

export const readOnlyScope = (
	db: RecallDatabase,
	owner: OwnerId,
): RepositoryScope => scopeFor(db, owner);
