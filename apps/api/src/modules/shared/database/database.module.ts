import { Global, Module, type OnApplicationShutdown } from "@nestjs/common";
import type { ObjectStore } from "@/application/ports/object-store";
import type { ApplicationDependencies } from "@/application/use-case";
import { systemClock, uuidGenerator } from "@/composition/create-application";
import { loadApiEnvironment } from "@/configs/env.config";
import { DatabaseConnection } from "@/db/connection";
import { AuthService } from "@/modules/auth";
import { createMinioObjectStore } from "@/persistence/objects/minio.object-store";
import {
	lazyScope,
	lazyUnitOfWork,
	type OwnerResolver,
} from "@/persistence/postgres/lazy-scope";
import {
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
			inject: [DatabaseConnection],
			useFactory: (connection: DatabaseConnection): UseCasesFor =>
				useCasesFor(connection),
		},
		{
			provide: INSTANCE_OWNER,
			inject: [AuthService],
			useFactory:
				(auth: AuthService): OwnerResolver =>
				() =>
					auth.instanceOwner(),
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
			provide: DatabaseConnection,
			useFactory: (): DatabaseConnection =>
				new DatabaseConnection({ url: loadApiEnvironment().databaseUrl }),
		},
		{
			provide: USE_CASE_DEPENDENCIES,
			inject: [DatabaseConnection, INSTANCE_OWNER],
			useFactory: (
				connection: DatabaseConnection,
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
		DatabaseConnection,
		INSTANCE_OWNER,
		OBJECT_STORE,
		USE_CASE_DEPENDENCIES,
		USE_CASES_FOR,
	],
})
export class DatabaseModule implements OnApplicationShutdown {
	constructor(private readonly connection: DatabaseConnection) {}

	async onApplicationShutdown(): Promise<void> {
		await this.connection.close();
	}
}
