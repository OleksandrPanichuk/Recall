import { Global, Module } from "@nestjs/common";
import { OwnerContext } from "@/core/owner-context";
import { Clock } from "@/core/ports/clock";
import { IdGenerator } from "@/core/ports/id-generator";
import { Timezone } from "@/core/ports/timezone";
import { Transaction } from "@/core/transaction";
import { DatabaseConnection } from "@/db/connection";
import { PostgresTransaction } from "@/db/executor";
import { AlsOwnerContext } from "./request-context";

export class SystemClock extends Clock {
	now(): Date {
		return new Date();
	}
}

export class AppTimezone extends Timezone {
	name(): string {
		return process.env.APP_TIMEZONE ?? "UTC";
	}
}

export class UuidGenerator extends IdGenerator {
	generate(): string {
		return crypto.randomUUID();
	}
}

@Global()
@Module({
	providers: [
		{ provide: Clock, useClass: SystemClock },
		{ provide: IdGenerator, useClass: UuidGenerator },
		{ provide: Timezone, useClass: AppTimezone },
		{ provide: OwnerContext, useClass: AlsOwnerContext },
		{
			provide: Transaction,
			inject: [DatabaseConnection],
			useFactory: (connection: DatabaseConnection): Transaction =>
				new PostgresTransaction(() => connection.db),
		},
	],
	exports: [Clock, IdGenerator, OwnerContext, Timezone, Transaction],
})
export class CoreModule {}
