import { Global, Module } from "@nestjs/common";
import { loadApiEnvironment } from "@/configs/env.config";
import type { PostgresConnection } from "@/persistence/postgres/client";
import { CONNECTION } from "../shared/database/tokens";
import { ApiTokenService } from "./api-token.service";
import { createAuth, type RecallAuth } from "./build-auth";
import { mailerFor } from "./mailer-for";
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
					signUpsPerHour: environment.signUpsPerHour,
					rateLimit: environment.authRateLimit,
					mailer: mailerFor(environment),
				});
			},
		},
		ApiTokenService,
		TelegramIdentityService,
	],
	exports: [AUTH, ApiTokenService, TelegramIdentityService],
})
export class AuthModule {}

export { AUTH } from "./tokens";
