import { toOwnerId } from "@/application/ports/owner";
import {
	createMemoryPersistence,
	createMemoryStores,
} from "@/persistence/memory/unit-of-work";
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
