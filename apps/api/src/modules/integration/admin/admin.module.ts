import {
	Inject,
	type MiddlewareConsumer,
	Module,
	type NestModule,
} from "@nestjs/common";
import { silentLogger } from "@recall/kit";
import { createAdminApi } from "@/adapters/admin/api";
import type { ApplicationDependencies } from "@/application/use-case";
import { createUseCases } from "@/composition/create-application";
import { loadApiEnvironment } from "../../shared/config/api-env";
import { USE_CASE_DEPENDENCIES } from "../../shared/database/tokens";
import { fetchRoutes } from "./fetch-routes";

export const ADMIN_PREFIX = "admin-api";

@Module({})
export class AdminModule implements NestModule {
	constructor(
		@Inject(USE_CASE_DEPENDENCIES)
		private readonly dependencies: ApplicationDependencies,
	) {}

	configure(consumer: MiddlewareConsumer): void {
		const environment = loadApiEnvironment();

		if (environment.adminPassphrase === undefined) {
			return;
		}

		const routes = createAdminApi({
			application: createUseCases(this.dependencies),
			logger: silentLogger,
			passphrase: environment.adminPassphrase,
			now: () => new Date(),
		});

		consumer.apply(fetchRoutes(routes)).forRoutes("{*path}");
	}
}
