import { Global, Module } from "@nestjs/common";
import { loadApiEnvironment } from "@/configs/env.config";
import type { PostgresConnection } from "@/db/client";
import { Mailer, NotificationsModule } from "@/modules/notifications";
import { CONNECTION } from "../shared/database/tokens";
import { ApiTokenService } from "./api-token.service";
import { createAuth, type RecallAuth } from "./build-auth";
import { TelegramIdentityService } from "./telegram-identity.service";
import { AUTH } from "./tokens";

@Global()
@Module({
	imports: [NotificationsModule],
	providers: [
		{
			provide: AUTH,
			inject: [CONNECTION, Mailer],
			useFactory: (
				connection: PostgresConnection,
				mailer: Mailer,
			): RecallAuth | undefined => {
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
					mailer,
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
