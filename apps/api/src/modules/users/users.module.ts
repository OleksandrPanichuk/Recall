import { Module } from "@nestjs/common";
import { PostgresUsersRepository } from "./repositories/users.postgres.repository";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

@Module({
	providers: [
		{ provide: UsersRepository, useClass: PostgresUsersRepository },
		UsersService,
	],
	exports: [UsersService, UsersRepository],
})
export class UsersModule {}
