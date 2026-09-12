import { Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { termPairs } from "@/db/schema";
import { isUuid } from "@/db/uuid";
import { type QuizSetId, toQuizSetId } from "@/modules/quizzes";
import { TermPairEntity, toVocabularyItemId, type VocabularyItemId } from "..";

type TermPairRow = typeof termPairs.$inferSelect;

const toPair = (row: TermPairRow): TermPairEntity =>
	TermPairEntity.restore({
		id: toVocabularyItemId(row.id),
		quizSetId: toQuizSetId(row.quizId),
		terms: row.terms,
		translations: row.translations,
		transcription: row.transcription ?? undefined,
		example: row.example ?? undefined,
		topic: row.topic ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});

import { OwnerContext } from "@/core/owner-context";
import { Database } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import { TermPairsRepository } from "../vocabulary.repository";

@Injectable()
export class PostgresTermPairsRepository extends TermPairsRepository {
	constructor(
		private readonly database: Database,
		private readonly owners: OwnerContext,
	) {
		super();
	}

	private get executor() {
		return DatabaseExecutor.for(this.database.db);
	}

	private get owner() {
		return this.owners.current();
	}

	private get mine() {
		return eq(termPairs.ownerId, this.owner);
	}

	async save(pair: TermPairEntity): Promise<void> {
		const row = {
			id: String(pair.id),
			ownerId: this.owner,
			quizId: String(pair.quizSetId),
			terms: [...pair.terms],
			translations: [...pair.translations],
			transcription: pair.transcription ?? null,
			example: pair.example ?? null,
			topic: pair.topic ?? null,
			createdAt: pair.createdAt,
			updatedAt: pair.updatedAt,
		};

		await this.executor
			.insert(termPairs)
			.values(row)
			.onConflictDoUpdate({ target: termPairs.id, set: row });
	}

	async findById(id: VocabularyItemId): Promise<TermPairEntity | undefined> {
		if (!isUuid(String(id))) {
			return undefined;
		}

		const [row] = await this.executor
			.select()
			.from(termPairs)
			.where(and(this.mine, eq(termPairs.id, String(id))))
			.limit(1);

		return row === undefined ? undefined : toPair(row);
	}

	async listForQuiz(quizId: QuizSetId): Promise<readonly TermPairEntity[]> {
		if (!isUuid(String(quizId))) {
			return [];
		}

		const rows = await this.executor
			.select()
			.from(termPairs)
			.where(and(this.mine, eq(termPairs.quizId, String(quizId))))
			.orderBy(asc(termPairs.createdAt), asc(termPairs.id));

		return rows.map(toPair);
	}
}
