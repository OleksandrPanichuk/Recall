import { HttpStatus } from "@nestjs/common";
import { ModuleError } from "@/core/errors";

export class PageNotSharedError extends ModuleError {
	readonly status = HttpStatus.NOT_FOUND;
	readonly code = "PAGE_NOT_SHARED";

	constructor() {
		super("That link does not point at a shared page");
	}
}
