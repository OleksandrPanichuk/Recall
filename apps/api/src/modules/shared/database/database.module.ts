import {
	Global,
	Inject,
	Module,
	type OnApplicationShutdown,
} from "@nestjs/common";
import type { ApplicationDependencies } from "@/application/use-case";
import { systemClock, uuidGenerator } from "@/composition/create-application";
import {
	createPostgresConnection,
	type PostgresConnection,
} from "@/persistence/postgres/client";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";
import { loadApiEnvironment } from "../config/api-env";
import { CONNECTION, USE_CASE_DEPENDENCIES } from "./tokens";

@Global()
@Module({
	providers: [
		{
			provide: CONNECTION,
			useFactory: (): PostgresConnection =>
				createPostgresConnection({ url: loadApiEnvironment().databaseUrl }),
		},
		{
			provide: USE_CASE_DEPENDENCIES,
			inject: [CONNECTION],
			useFactory: (
				connection: PostgresConnection,
			): ApplicationDependencies => ({
				unitOfWork: createPostgresUnitOfWork(connection.db),
				scope: readOnlyScope(connection.db),
				clock: systemClock,
				idGenerator: uuidGenerator,
				timezone: process.env.APP_TIMEZONE ?? "UTC",
			}),
		},
	],
	exports: [CONNECTION, USE_CASE_DEPENDENCIES],
})
export class DatabaseModule implements OnApplicationShutdown {
	constructor(
		@Inject(CONNECTION) private readonly connection: PostgresConnection,
	) {}

	async onApplicationShutdown(): Promise<void> {
		await this.connection.close();
	}
}
