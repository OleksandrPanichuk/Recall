import type { OwnerId } from "./owner";

export abstract class OwnerContext {
	abstract current(): OwnerId;
}
