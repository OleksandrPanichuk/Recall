import {
	createMemoryPersistence,
	createMemoryStores,
} from "@tests/fixtures/memory/unit-of-work";
import { toOwnerId } from "@/core/owner";
import { describeOwnership } from "../contracts/ownership.contract";

const MINE = toOwnerId("owner-mine");
const THEIRS = toOwnerId("owner-theirs");

let stores = createMemoryStores();

describeOwnership("in-memory", () => {
	const mine = createMemoryPersistence(stores.of(MINE));
	const theirs = createMemoryPersistence(stores.of(THEIRS));

	return {
		mine: { unitOfWork: mine.unitOfWork, scope: mine.scope },
		theirs: { unitOfWork: theirs.unitOfWork, scope: theirs.scope },
		reset: async () => {
			stores = createMemoryStores();
		},
	};
});
