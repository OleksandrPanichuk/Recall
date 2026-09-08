import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	numeric,
	pgTable,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { updatedAt } from "./columns";
import { ownerId } from "./owner-id";

export const studySettings = pgTable(
	"study_settings",
	{
		ownerId: ownerId(),
		id: uuid("id").primaryKey(),
		scopeType: text("scope_type").notNull(),
		scopeId: uuid("scope_id"),
		scheduler: text("scheduler").notNull().default("ladder"),
		intervalsDays: integer("intervals_days").array().notNull(),
		maxIntervalDays: integer("max_interval_days").notNull(),
		maxRepetitions: integer("max_repetitions").notNull(),
		desiredRetention: numeric("desired_retention", { precision: 4, scale: 3 })
			.notNull()
			.default("0.9"),
		shuffleOptions: boolean("shuffle_options").notNull().default(false),
		shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
		examMode: boolean("exam_mode").notNull().default(false),
		updatedAt: updatedAt(),
	},
	(table) => [
		index("study_settings_owner_idx").on(table.ownerId),
		index("review_states_owner_idx").on(table.ownerId),
		check(
			"study_settings_scope_check",
			sql`${table.scopeType} in ('owner', 'page', 'quiz')`,
		),
		check(
			"study_settings_scheduler_check",
			sql`${table.scheduler} in ('ladder', 'fsrs')`,
		),
		unique("study_settings_scope_unique")
			.on(table.ownerId, table.scopeType, table.scopeId)
			.nullsNotDistinct(),
	],
);
