import { Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { OwnerId } from "@/core/owner";
import { studySettings } from "@/db/schema";
import { StudySettingsEntity } from "@/modules/study-settings";

type SettingsRow = typeof studySettings.$inferSelect;

const toSettings = (row: SettingsRow): StudySettingsEntity =>
	StudySettingsEntity.create({
		repetition: {
			scheduler: row.scheduler === "fsrs" ? "fsrs" : "ladder",
			intervalsDays: row.intervalsDays,
			maxIntervalDays: row.maxIntervalDays,
			maxRepetitions: row.maxRepetitions,
			desiredRetention: Number(row.desiredRetention),
		},
		shuffleOptions: row.shuffleOptions,
		shuffleQuestions: row.shuffleQuestions,
		examMode: row.examMode,
	});

const scopeMatch = (scope: SettingsScope, owner: OwnerId) =>
	and(
		eq(studySettings.ownerId, owner),
		scope.kind === "owner"
			? and(eq(studySettings.scopeType, "owner"), isNull(studySettings.scopeId))
			: and(
					eq(studySettings.scopeType, "quiz"),
					eq(studySettings.scopeId, String(scope.quizId)),
				),
	);

const scopeId = (scope: SettingsScope): string | null =>
	scope.kind === "owner" ? null : String(scope.quizId);

import { OwnerContext } from "@/core/owner-context";
import { Database } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import {
	type SettingsScope,
	StudySettingsRepository,
} from "../study-settings.repository";

@Injectable()
export class PostgresStudySettingsRepository extends StudySettingsRepository {
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

	async saveSettings(
		scope: SettingsScope,
		settings: StudySettingsEntity,
	): Promise<void> {
		const row = {
			id: crypto.randomUUID(),
			ownerId: this.owner,
			scopeType: scope.kind,
			scopeId: scopeId(scope),
			scheduler: settings.repetition.scheduler,
			intervalsDays: [...settings.repetition.intervalsDays],
			maxIntervalDays: settings.repetition.maxIntervalDays,
			maxRepetitions: settings.repetition.maxRepetitions,
			desiredRetention: String(settings.repetition.desiredRetention),
			shuffleOptions: settings.shuffleOptions,
			shuffleQuestions: settings.shuffleQuestions,
			examMode: settings.examMode,
			updatedAt: new Date(),
		};

		await this.executor
			.insert(studySettings)
			.values(row)
			.onConflictDoUpdate({
				target: [
					studySettings.ownerId,
					studySettings.scopeType,
					studySettings.scopeId,
				],
				set: {
					scheduler: row.scheduler,
					intervalsDays: row.intervalsDays,
					maxIntervalDays: row.maxIntervalDays,
					maxRepetitions: row.maxRepetitions,
					desiredRetention: row.desiredRetention,
					shuffleOptions: row.shuffleOptions,
					shuffleQuestions: row.shuffleQuestions,
					examMode: row.examMode,
					updatedAt: row.updatedAt,
				},
			});
	}

	async findSettings(
		scope: SettingsScope,
	): Promise<StudySettingsEntity | undefined> {
		const [row] = await this.executor
			.select()
			.from(studySettings)
			.where(scopeMatch(scope, this.owner))
			.limit(1);

		return row === undefined ? undefined : toSettings(row);
	}

	async clearSettings(scope: SettingsScope): Promise<void> {
		await this.executor
			.delete(studySettings)
			.where(scopeMatch(scope, this.owner));
	}
}
