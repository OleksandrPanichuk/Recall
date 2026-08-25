import { Global, Module } from "@nestjs/common";
import type { PostgresConnection } from "@/persistence/postgres/client";
import { loadApiEnvironment } from "../shared/config/api-env";
import { CONNECTION } from "../shared/database/tokens";
import { createAuth, type RecallAuth } from "./build-auth";
import { TelegramIdentityService } from "./telegram-identity.service";
import { AUTH } from "./tokens";

@Global()
@Module({
	providers: [
		{
			provide: AUTH,
			inject: [CONNECTION],
			useFactory: (connection: PostgresConnection): RecallAuth | undefined => {
				const environment = loadApiEnvironment();

				if (environment.authSecret === undefined) {
					return undefined;
				}

				return createAuth({
					db: connection.db,
					secret: environment.authSecret,
					baseUrl: environment.authBaseUrl,
					successUrl: environment.authSuccessUrl,
					trustedOrigins: environment.authTrustedOrigins,
				});
			},
		},
		TelegramIdentityService,
	],
	exports: [AUTH, TelegramIdentityService],
})
export class AuthModule {}

export { AUTH } from "./tokens";
