import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import { emptyStore, type MemoryStore } from "@/persistence/memory/store";
import { createMemoryPersistence } from "@/persistence/memory/unit-of-work";

export const DEFAULT_START_AT = new Date("2026-08-01T10:00:00.000Z");
export const DEFAULT_TIMEZONE = "Europe/Kyiv";

export interface MutableClock extends Clock {
	set(at: Date): void;
	advance(milliseconds: number): void;
}

export function createMutableClock(startAt = DEFAULT_START_AT): MutableClock {
	let current = new Date(startAt.getTime());

	return {
		now: () => new Date(current.getTime()),
		set: (at) => {
			current = new Date(at.getTime());
		},
		advance: (milliseconds) => {
			current = new Date(current.getTime() + milliseconds);
		},
	};
}

export function createUuidGenerator(): IdGenerator {
	return { generate: () => crypto.randomUUID() };
}

export interface MemoryContext {
	readonly store: MemoryStore;
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
	readonly clock: MutableClock;
	readonly idGenerator: IdGenerator;
	readonly timezone: string;
	close(): void;
}

export interface MemoryContextOptions {
	readonly startAt?: Date;
	readonly timezone?: string;
	readonly idGenerator?: IdGenerator;
}

export function createMemoryContext(
	options: MemoryContextOptions = {},
): MemoryContext {
	const store = emptyStore();
	const persistence = createMemoryPersistence(store);

	return {
		store,
		unitOfWork: persistence.unitOfWork,
		scope: persistence.scope,
		clock: createMutableClock(options.startAt),
		idGenerator: options.idGenerator ?? createUuidGenerator(),
		timezone: options.timezone ?? DEFAULT_TIMEZONE,
		close: () => {
			store.pages.clear();
			store.quizzes.clear();
			store.quizAggregates.clear();
			store.quizVersions.clear();
			store.answeredQuestionIds.clear();
			store.attempts.clear();
			store.schedules.clear();
			store.settings.clear();
			store.termPairs.clear();
		},
	};
}

export const attemptCount = (store: MemoryStore): number => store.attempts.size;

export const responseCount = (store: MemoryStore): number =>
	[...store.attempts.values()].reduce(
		(total, attempt) => total + attempt.responses.length,
		0,
	);

const hexOf = (prefix: string): string => {
	let hash = 0;

	for (const character of prefix) {
		hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 0xff_ff_ff_ff;
	}

	return hash.toString(16).padStart(8, "0").slice(0, 8);
};

// Deterministic, uuid-shaped ids: Postgres columns are uuid, so a counter alone
// will not do.
export const sequentialId = (prefix: string, nth: number): string =>
	`${hexOf(prefix)}-0000-4000-8000-${String(nth).padStart(12, "0")}`;

export function createSequentialIdGenerator(prefix = "0"): IdGenerator {
	let next = 0;

	return {
		generate: () => {
			next += 1;

			return sequentialId(prefix, next);
		},
	};
}
