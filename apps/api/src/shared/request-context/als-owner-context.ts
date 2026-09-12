import type { OwnerId } from "@/core/owner";
import { OwnerContext } from "@/core/owner-context";
import { requireOwner } from "./request-context";

export class AlsOwnerContext extends OwnerContext {
	current(): OwnerId {
		return requireOwner();
	}
}
