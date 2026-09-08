import { Module } from "@nestjs/common";
import { AnalyticsRepository } from "./insights.repository";
import { PostgresAnalyticsRepository } from "./repositories/insights.postgres.repository";
import { GetInsightsUseCase } from "./use-cases";

@Module({
	providers: [
		{ provide: AnalyticsRepository, useClass: PostgresAnalyticsRepository },
		GetInsightsUseCase,
	],
	exports: [AnalyticsRepository, GetInsightsUseCase],
})
export class InsightsModule {}
