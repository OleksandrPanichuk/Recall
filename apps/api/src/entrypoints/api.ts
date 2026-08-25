import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "@/modules/app.module";
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
	const app = await NestFactory.create(AppModule, { bufferLogs: false });

	const environment = loadApiEnvironment();

	// The admin app is served from its own origin, so it needs credentialed CORS.
	// Without an explicit origin nothing cross-origin is allowed at all.
	if (environment.adminOrigin !== undefined) {
		app.enableCors({ origin: environment.adminOrigin, credentials: true });
	}

	// The MCP surface is a whole Express app. Mounting it through Nest middleware
	// would put it behind a path and Express would strip that prefix, so /mcp
	// would never match. A path-less use() on the underlying instance does not.
	const mcp = app.get<McpSurface>(MCP_SURFACE);

	if (mcp.app !== undefined) {
		app.getHttpAdapter().getInstance().use(mcp.app);
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
