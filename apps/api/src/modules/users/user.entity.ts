import type { user } from "@/db/schema";

export type UserRow = typeof user.$inferSelect;

export interface UserEntity extends UserRow {}

export class UserEntity {
	private constructor() {}

	static normaliseEmail(email: string): string {
		return email.trim().toLowerCase();
	}

	static isEmailVerified(entity: UserEntity): boolean {
		return entity.emailVerified;
	}

	static displayName(entity: UserEntity): string {
		const trimmed = entity.name.trim();

		return trimmed.length === 0 ? entity.email : trimmed;
	}
}
