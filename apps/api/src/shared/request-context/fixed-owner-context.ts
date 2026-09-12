import type { OwnerId } from "@/core/owner";
import { OwnerContext } from "@/core/owner-context";

export class FixedOwnerContext extends OwnerContext {
	constructor(private readonly owner: OwnerId) {
		super();
	}

	current(): OwnerId {
		return this.owner;
	}
}
