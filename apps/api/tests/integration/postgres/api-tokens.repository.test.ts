import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import type { OwnerId } from "@/core/owner";
import { DatabaseHandle } from "@/db/connection";
import * as schema from "@/db/schema";
import {
	ApiTokenEntity,
	PostgresApiTokenCredentials,
	PostgresApiTokensRepository,
} from "@/modules/api-tokens";
import { FixedOwnerContext } from "@/shared/request-context";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedOwner,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

let harness: PostgresHarness;
let handle: DatabaseHandle;
let mine: OwnerId;
let theirs: OwnerId;

const tokensOf = (owner: OwnerId) =>
	new PostgresApiTokensRepository(handle, new FixedOwnerContext(owner));

const issue = async (owner: OwnerId, name: string) => {
	const id = randomUUID();
	const token = ApiTokenEntity.mint();

	await tokensOf(owner).insert({
		id,
		name,
		tokenHash: ApiTokenEntity.hashOf(token),
		scopes: ApiTokenEntity.DEFAULT_SCOPES,
	});

	return { id, token };
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("api-tokens-repository");
	await applyMigration(harness);
	handle = new DatabaseHandle(drizzle({ client: harness.client, schema }));
	mine = await seedOwner(harness, "token owner");
	theirs = await seedOwner(harness, "somebody else");
});

afterAll(async () => {
	await harness?.close();
});

describe.skipIf(!available)("personal tokens, scoped to their owner", () => {
	test("an owner lists only the tokens it issued", async () => {
		await issue(mine, "mine");
		await issue(theirs, "theirs");

		expect((await tokensOf(mine).listLive()).map((row) => row.name)).toEqual([
			"mine",
		]);
		expect(
			(await tokensOf(theirs).listLive()).map((row) => row.ownerId),
		).toEqual([String(theirs)]);
	});

	test("an owner cannot revoke somebody else's token", async () => {
		const { id } = await issue(theirs, "not yours");

		expect(await tokensOf(mine).revoke(id, new Date())).toBe(false);
		expect(await tokensOf(theirs).revoke(id, new Date())).toBe(true);
	});

	test("verification finds a token by its hash before anyone is known", async () => {
		const { id, token } = await issue(mine, "verify me");
		const credentials = new PostgresApiTokenCredentials(handle);
		const found = await credentials.findLiveByHash(
			ApiTokenEntity.hashOf(token),
			new Date(),
		);

		expect(found?.id).toBe(id);
		expect(found?.ownerId).toBe(String(mine));
	});
});
