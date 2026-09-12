import {
	type MiddlewareConsumer,
	Module,
	type NestModule,
} from "@nestjs/common";
import { silentLogger } from "@recall/kit";
import { loadApiEnvironment } from "@/configs/env.config";
import { AuthService } from "@/modules/auth";
import { InsightsModule } from "@/modules/insights";
import { PagesModule } from "@/modules/pages";
import { QuizzesModule } from "@/modules/quizzes";
import { SchedulingModule } from "@/modules/scheduling";
import { StatisticsModule } from "@/modules/statistics";
import { StudySettingsModule } from "@/modules/study-settings";
import { VocabularyModule } from "@/modules/vocabulary";
import { runAs } from "@/shared/request-context";
import { createAdminApi } from "./admin.api";
import { fetchRoutes } from "./admin.fetch-routes";
import { AdminUseCases } from "./admin.use-cases";

@Module({
	imports: [
		InsightsModule,
		PagesModule,
		QuizzesModule,
		SchedulingModule,
		StatisticsModule,
		StudySettingsModule,
		VocabularyModule,
	],
	providers: [AdminUseCases],
})
export class AdminModule implements NestModule {
	constructor(
		private readonly useCases: AdminUseCases,
		private readonly auth: AuthService,
	) {}

	configure(consumer: MiddlewareConsumer): void {
		const environment = loadApiEnvironment();

		if (environment.adminPassphrase === undefined) {
			return;
		}

		const routes = createAdminApi({
			application: this.useCases,
			logger: silentLogger,
			passphrase: environment.adminPassphrase,
			now: () => new Date(),
		});
		const handle = fetchRoutes(routes, async (run) =>
			runAs({ kind: "instance", owner: await this.auth.instanceOwner() }, run),
		);

		consumer.apply(handle).forRoutes("{*path}");
	}
}
