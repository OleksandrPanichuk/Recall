import { Global, Module, type OnApplicationShutdown } from "@nestjs/common";
import { loadApiEnvironment } from "@/configs/env.config";
import { Database, DatabaseConnection } from "@/db/connection";

@Global()
@Module({
	providers: [
		{
			provide: DatabaseConnection,
			useFactory: (): DatabaseConnection =>
				new DatabaseConnection({ url: loadApiEnvironment().databaseUrl }),
		},
		{ provide: Database, useExisting: DatabaseConnection },
	],
	exports: [Database, DatabaseConnection],
})
export class DatabaseModule implements OnApplicationShutdown {
	constructor(private readonly connection: DatabaseConnection) {}

	async onApplicationShutdown(): Promise<void> {
		await this.connection.close();
	}
}
