import type { OwnerId } from "@/core/owner";
import type { UserEntity } from "./user.entity";

export interface CreateUserData {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly at: Date;
}

export abstract class UsersRepository {
	abstract insert(data: CreateUserData): Promise<OwnerId>;
	abstract findById(id: string): Promise<UserEntity | undefined>;
	abstract findByEmail(email: string): Promise<UserEntity | undefined>;
}
