import type { DynamicModule } from "@nestjs/common";
import { Global, Module } from "@nestjs/common";
import type { BetterAuthPlugin } from "better-auth";
import { loadApiEnvironment } from "@/configs/env.config";
import { DatabaseConnection } from "@/db/connection";
import { Mailer, NotificationsModule } from "@/modules/notifications";
import { UsersModule } from "@/modules/users";
import { BotTokenGuard } from "./auth.bot.guard";
import { AuthEngine } from "./auth.engine";
import { AuthFactory } from "./auth.factory";
import { InstanceOwnerGuard } from "./auth.instance.guard";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { SessionGuard } from "./auth.session.guard";
import { PostgresAuthRepository } from "./repositories/auth.postgres.repository";

export interface AuthModuleOptions {
	readonly plugins: () => readonly BetterAuthPlugin[];
}

@Global()
@Module({})
export class AuthModule {
	static forRoot(options: AuthModuleOptions): DynamicModule {
		return {
			module: AuthModule,
			imports: [NotificationsModule, UsersModule],
			providers: [
				{ provide: AuthRepository, useClass: PostgresAuthRepository },
				{
					provide: AuthEngine,
					inject: [DatabaseConnection, Mailer],
					useFactory: (
						connection: DatabaseConnection,
						mailer: Mailer,
					): AuthEngine => {
						const environment = loadApiEnvironment();

						if (environment.authSecret === undefined) {
							return new AuthEngine(undefined);
						}

						return new AuthEngine(
							AuthFactory.create({
								db: connection.db,
								secret: environment.authSecret,
								baseUrl: environment.authBaseUrl,
								trustedOrigins: environment.authTrustedOrigins,
								signUpsPerHour: environment.signUpsPerHour,
								rateLimit: environment.authRateLimit,
								mailer,
								plugins: options.plugins(),
							}),
						);
					},
				},
				AuthService,
				SessionGuard,
				BotTokenGuard,
				InstanceOwnerGuard,
			],
			exports: [
				AuthService,
				AuthEngine,
				AuthRepository,
				SessionGuard,
				BotTokenGuard,
				InstanceOwnerGuard,
			],
		};
	}
}
