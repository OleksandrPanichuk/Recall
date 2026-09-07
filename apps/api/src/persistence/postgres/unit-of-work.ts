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
import { PostgresAttemptsRepository } from "@/modules/attempts";
import { PostgresAnalyticsRepository } from "@/modules/insights";
import { PostgresPagesRepository } from "@/modules/pages";
import { PostgresQuizzesRepository } from "@/modules/quizzes";
import { PostgresSchedulesRepository } from "@/modules/scheduling";
import { PostgresStudySettingsRepository } from "@/modules/study-settings";
import { PostgresTermPairsRepository } from "@/modules/vocabulary";
import { FixedOwnerContext } from "@/shared/request-context";

export type { Executor } from "@/db/executor";

const scheduleMethods = (schedules: PostgresSchedulesRepository) => ({
	saveSchedules: (
		values: Parameters<PostgresSchedulesRepository["saveSchedules"]>[0],
	) => schedules.saveSchedules(values),
	findSchedules: (
		ids: Parameters<PostgresSchedulesRepository["findSchedules"]>[0],
	) => schedules.findSchedules(ids),
	listDue: (at: Date) => schedules.listDue(at),
	listLeeches: (threshold: number) => schedules.listLeeches(threshold),
});

const settingsMethods = (settings: PostgresStudySettingsRepository) => ({
	saveSettings: (
		scope: Parameters<PostgresStudySettingsRepository["saveSettings"]>[0],
		values: Parameters<PostgresStudySettingsRepository["saveSettings"]>[1],
	) => settings.saveSettings(scope, values),
	findSettings: (
		scope: Parameters<PostgresStudySettingsRepository["findSettings"]>[0],
	) => settings.findSettings(scope),
	clearSettings: (
		scope: Parameters<PostgresStudySettingsRepository["clearSettings"]>[0],
	) => settings.clearSettings(scope),
});

export const scopeFor = (
	db: RecallDatabase,
	owner: OwnerId,
): RepositoryScope => {
	const executor: Executor = DatabaseExecutor.for(db);
	const handle = new DatabaseHandle(db);
	const context = new FixedOwnerContext(owner);
	const schedules = new PostgresSchedulesRepository(handle, context);
	const settings = new PostgresStudySettingsRepository(handle, context);

	return {
		pages: new PostgresPagesRepository(
			new DatabaseHandle(db),
			new FixedOwnerContext(owner),
		),
		quizzes: new PostgresQuizzesRepository(
			new DatabaseHandle(db),
			new FixedOwnerContext(owner),
		),
		attempts: new PostgresAttemptsRepository(handle, context),
		reviews: { ...scheduleMethods(schedules), ...settingsMethods(settings) },
		termPairs: new PostgresTermPairsRepository(
			new DatabaseHandle(db),
			new FixedOwnerContext(owner),
		),
		analytics: new PostgresAnalyticsRepository(handle, context),
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
