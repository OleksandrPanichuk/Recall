import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { toNodeHandler } from "better-auth/node";
import { type Express, json, urlencoded } from "express";
import { AppModule } from "@/modules/app.module";
import { AUTH_BASE_PATH, type RecallAuth } from "@/modules/auth/build-auth";
import { AUTH } from "@/modules/auth/tokens";
import {
	MCP_SURFACE,
	type McpSurface,
} from "@/modules/integration/mcp/mcp.module";
import { loadApiEnvironment } from "@/modules/shared/config/api-env";
import { DomainExceptionFilter } from "@/modules/shared/errors/domain-exception.filter";
import {
	mountSwagger,
	SWAGGER_PATH,
} from "@/modules/shared/swagger/build-document";

export async function createApiApp() {
	const app = await NestFactory.create(AppModule, {
		bufferLogs: false,
		bodyParser: false,
	});

	const environment = loadApiEnvironment();

	const browserOrigins = [
		environment.adminOrigin,
		environment.webAppUrl,
	].filter((origin): origin is string => origin !== undefined);

	if (browserOrigins.length > 0) {
		app.enableCors({ origin: browserOrigins, credentials: true });
	}

	const mcp = app.get<McpSurface>(MCP_SURFACE);

	if (mcp.app !== undefined) {
		app.getHttpAdapter().getInstance().use(mcp.app);
	}

	const auth = app.get<RecallAuth | undefined>(AUTH);
	const instance = app.getHttpAdapter().getInstance() as Express;

	if (auth !== undefined) {
		instance.all(`${AUTH_BASE_PATH}/*splat`, toNodeHandler(auth));
	}

	instance.use(json());
	instance.use(urlencoded({ extended: false }));

	app.useGlobalFilters(new DomainExceptionFilter());
	app.enableShutdownHooks();
	mountSwagger(app);

	return app;
}

export async function startApi(): Promise<void> {
	const environment = loadApiEnvironment();
	const app = await createApiApp();

	await app.listen(environment.port, environment.host);

	console.log(
		`api listening on http://${environment.host}:${environment.port} (docs at /${SWAGGER_PATH})`,
	);
}
