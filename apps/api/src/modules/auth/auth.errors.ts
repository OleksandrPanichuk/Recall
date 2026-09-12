import { HttpStatus } from "@nestjs/common";
import { ModuleError } from "@/core/errors";

export class IdentityNotConfiguredError extends ModuleError {
	readonly status = HttpStatus.SERVICE_UNAVAILABLE;
	readonly code = "IDENTITY_NOT_CONFIGURED";

	constructor() {
		super("identity is not configured on this api");
	}
}

export class NotSignedInError extends ModuleError {
	readonly status = HttpStatus.UNAUTHORIZED;
	readonly code = "NOT_SIGNED_IN";

	constructor() {
		super("sign in first");
	}
}

export class BotTokenNotConfiguredError extends ModuleError {
	readonly status = HttpStatus.UNAUTHORIZED;
	readonly code = "BOT_SURFACE_NOT_CONFIGURED";

	constructor() {
		super("the bot surface is not configured");
	}
}

export class WrongBotTokenError extends ModuleError {
	readonly status = HttpStatus.UNAUTHORIZED;
	readonly code = "WRONG_BOT_TOKEN";

	constructor() {
		super("that token is not the bot's token");
	}
}

export class ForeignTelegramAccountError extends ModuleError {
	readonly status = HttpStatus.FORBIDDEN;
	readonly code = "FOREIGN_TELEGRAM_ACCOUNT";

	constructor() {
		super("this api serves one telegram account, and that is not it");
	}
}

export class InstanceHasNoOwnerError extends ModuleError {
	readonly status = HttpStatus.SERVICE_UNAVAILABLE;
	readonly code = "INSTANCE_HAS_NO_OWNER";
}

export class TelegramAccountNotLinkedError extends ModuleError {
	readonly status = HttpStatus.SERVICE_UNAVAILABLE;
	readonly code = "TELEGRAM_ACCOUNT_NOT_LINKED";

	constructor() {
		super(
			"this telegram account has not linked the platform yet — send /login to the bot first",
		);
	}
}
