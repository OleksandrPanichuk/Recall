import type { OwnerId } from "@/application/ports/owner";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type { RecallDatabase } from "./client";
import { scopeFor } from "./unit-of-work";

export type OwnerResolver = () => Promise<OwnerId>;

const lazyRepository = <TRepository extends object>(
	resolve: () => Promise<TRepository>,
): TRepository =>
	new Proxy({} as TRepository, {
		get:
			(_target, key) =>
			async (...args: unknown[]) => {
				const repository = (await resolve()) as Record<string, unknown>;
				const method = repository[key as string];

				if (typeof method !== "function") {
					throw new TypeError(`the repository has no method "${String(key)}"`);
				}

				return (method as (...values: unknown[]) => unknown).apply(
					repository,
					args,
				);
			},
	});

export const lazyScope = (
	db: RecallDatabase,
	owner: OwnerResolver,
): RepositoryScope => {
	const scope = async (): Promise<RepositoryScope> =>
		scopeFor(db, await owner());

	return {
		pages: lazyRepository(async () => (await scope()).pages),
		quizzes: lazyRepository(async () => (await scope()).quizzes),
		attempts: lazyRepository(async () => (await scope()).attempts),
		reviews: lazyRepository(async () => (await scope()).reviews),
		termPairs: lazyRepository(async () => (await scope()).termPairs),
		analytics: lazyRepository(async () => (await scope()).analytics),
	};
};

export const lazyUnitOfWork = (
	db: RecallDatabase,
	owner: OwnerResolver,
): UnitOfWork<RepositoryScope> => ({
	run: async (operation) => {
		const resolved = await owner();

		return db.transaction((tx) => operation(scopeFor(tx, resolved)));
	},
});
