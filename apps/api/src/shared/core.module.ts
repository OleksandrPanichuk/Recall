import { Global, Module } from "@nestjs/common";
import { OwnerContext } from "@/core/owner-context";
import { Clock } from "@/core/ports/clock";
import { IdGenerator } from "@/core/ports/id-generator";
import { Transaction } from "@/core/transaction";
import { DatabaseConnection } from "@/db/connection";
import { PostgresTransaction } from "@/db/executor";
import { AlsOwnerContext } from "./request-context";

export class SystemClock extends Clock {
	now(): Date {
		return new Date();
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
		{ provide: OwnerContext, useClass: AlsOwnerContext },
		{
			provide: Transaction,
			inject: [DatabaseConnection],
			useFactory: (connection: DatabaseConnection): Transaction =>
				new PostgresTransaction(() => connection.db),
		},
	],
	exports: [Clock, IdGenerator, OwnerContext, Transaction],
})
export class CoreModule {}
