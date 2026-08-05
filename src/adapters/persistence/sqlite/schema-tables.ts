/**
 * The application tables, in the order `sqlite_master` reports them. Kept apart
 * from `schema.ts` so operational tooling can name them without importing the
 * Drizzle table builders.
 */
export const applicationTables = [
	"question_options",
	"question_responses",
	"questions",
	"quiz_attempts",
	"quiz_sets",
	"review_items",
] as const;
