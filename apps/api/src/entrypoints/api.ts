import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "@/modules/app.module";
import { loadApiEnvironment } from "@/modules/shared/config/api-env";
import { DomainExceptionFilter } from "@/modules/shared/errors/domain-exception.filter";
import {
	mountSwagger,
	SWAGGER_PATH,
} from "@/modules/shared/swagger/build-document";

export async function createApiApp() {
	const app = await NestFactory.create(AppModule, { bufferLogs: false });

	const environment = loadApiEnvironment();

	// The admin app is served from its own origin, so it needs credentialed CORS.
	// Without an explicit origin nothing cross-origin is allowed at all.
	if (environment.adminOrigin !== undefined) {
		app.enableCors({ origin: environment.adminOrigin, credentials: true });
	}

	app.useGlobalFilters(new DomainExceptionFilter());
	app.enableShutdownHooks();
	mountSwagger(app);

	return app;
}

async function main(): Promise<void> {
	const environment = loadApiEnvironment();
	const app = await createApiApp();

	await app.listen(environment.port, environment.host);

	console.log(
		`api listening on http://${environment.host}:${environment.port} (docs at /${SWAGGER_PATH})`,
	);
}

if (import.meta.main) {
	await main();
}
