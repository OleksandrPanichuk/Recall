import {
	Global,
	Inject,
	Module,
	type OnApplicationShutdown,
} from "@nestjs/common";
import type { ObjectStore } from "@/application/ports/object-store";
import type { ApplicationDependencies } from "@/application/use-case";
import { systemClock, uuidGenerator } from "@/composition/create-application";
import { createMinioObjectStore } from "@/persistence/objects/minio.object-store";
import {
	createPostgresConnection,
	type PostgresConnection,
} from "@/persistence/postgres/client";
import {
	lazyScope,
	lazyUnitOfWork,
	type OwnerResolver,
} from "@/persistence/postgres/lazy-scope";
import { loadApiEnvironment } from "../config/api-env";
import { instanceOwnerResolver } from "./instance-owner";
import {
	CONNECTION,
	INSTANCE_OWNER,
	OBJECT_STORE,
	USE_CASE_DEPENDENCIES,
	USE_CASES_FOR,
} from "./tokens";
import { type UseCasesFor, useCasesFor } from "./use-cases-for";

@Global()
@Module({
	providers: [
		{
			provide: USE_CASES_FOR,
			inject: [CONNECTION],
			useFactory: (connection: PostgresConnection): UseCasesFor =>
				useCasesFor(connection),
		},
		{
			provide: INSTANCE_OWNER,
			inject: [CONNECTION],
			useFactory: (connection: PostgresConnection): OwnerResolver =>
				instanceOwnerResolver(connection.db),
		},
		{
			provide: OBJECT_STORE,
			useFactory: (): ObjectStore => {
				const environment = loadApiEnvironment();

				return createMinioObjectStore({
					endpoint: environment.objectStoreEndpoint,
					accessKey: environment.objectStoreAccessKey,
					secretKey: environment.objectStoreSecretKey,
					bucket: environment.objectStoreBucket,
				});
			},
		},
		{
			provide: CONNECTION,
			useFactory: (): PostgresConnection =>
				createPostgresConnection({ url: loadApiEnvironment().databaseUrl }),
		},
		{
			provide: USE_CASE_DEPENDENCIES,
			inject: [CONNECTION, INSTANCE_OWNER],
			useFactory: (
				connection: PostgresConnection,
				owner: OwnerResolver,
			): ApplicationDependencies => ({
				unitOfWork: lazyUnitOfWork(connection.db, owner),
				scope: lazyScope(connection.db, owner),
				clock: systemClock,
				idGenerator: uuidGenerator,
				timezone: process.env.APP_TIMEZONE ?? "UTC",
			}),
		},
	],
	exports: [
		CONNECTION,
		INSTANCE_OWNER,
		OBJECT_STORE,
		USE_CASE_DEPENDENCIES,
		USE_CASES_FOR,
	],
})
export class DatabaseModule implements OnApplicationShutdown {
	constructor(
		@Inject(CONNECTION) private readonly connection: PostgresConnection,
	) {}

	async onApplicationShutdown(): Promise<void> {
		await this.connection.close();
	}
}
