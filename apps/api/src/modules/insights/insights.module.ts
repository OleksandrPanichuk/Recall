import { Module } from "@nestjs/common";
import { InsightsController } from "./insights.controller";
import { AnalyticsRepository } from "./insights.repository";
import { PostgresAnalyticsRepository } from "./repositories/insights.postgres.repository";
import { GetInsightsUseCase } from "./use-cases";

@Module({
	controllers: [InsightsController],
	providers: [
		{ provide: AnalyticsRepository, useClass: PostgresAnalyticsRepository },
		GetInsightsUseCase,
	],
	exports: [AnalyticsRepository, GetInsightsUseCase],
})
export class InsightsModule {}
