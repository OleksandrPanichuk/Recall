import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { type OwnerId, toOwnerId } from "@/core/owner";
import { DatabaseConnection } from "@/db/connection";
import { DatabaseExecutor } from "@/db/executor";
import { user } from "@/db/schema";
import { UserEntity } from "../user.entity";
import { type CreateUserData, UsersRepository } from "../users.repository";

@Injectable()
export class PostgresUsersRepository extends UsersRepository {
	constructor(private readonly connection: DatabaseConnection) {
		super();
	}

	private get executor() {
		return DatabaseExecutor.for(this.connection.db);
	}

	async insert(data: CreateUserData): Promise<OwnerId> {
		await this.executor.insert(user).values({
			id: data.id,
			name: data.name,
			email: UserEntity.normaliseEmail(data.email),
			emailVerified: false,
			createdAt: data.at,
			updatedAt: data.at,
		});

		return toOwnerId(data.id);
	}

	async findById(id: string): Promise<UserEntity | undefined> {
		const [row] = await this.executor
			.select()
			.from(user)
			.where(eq(user.id, id))
			.limit(1);

		return row;
	}

	async findByEmail(email: string): Promise<UserEntity | undefined> {
		const [row] = await this.executor
			.select()
			.from(user)
			.where(eq(user.email, UserEntity.normaliseEmail(email)))
			.limit(1);

		return row;
	}
}
