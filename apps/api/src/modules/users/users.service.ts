import { Injectable } from "@nestjs/common";
import type { OwnerId } from "@/core/owner";
import type { UserEntity } from "./user.entity";
import { type CreateUserData, UsersRepository } from "./users.repository";

@Injectable()
export class UsersService {
	constructor(private readonly repository: UsersRepository) {}

	create(data: CreateUserData): Promise<OwnerId> {
		return this.repository.insert(data);
	}

	findById(id: string): Promise<UserEntity | undefined> {
		return this.repository.findById(id);
	}

	findByEmail(email: string): Promise<UserEntity | undefined> {
		return this.repository.findByEmail(email);
	}
}
