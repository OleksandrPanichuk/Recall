import "reflect-metadata";
import { describe, expect, test } from "bun:test";
import { Injectable, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Greeter } from "./fixtures/greeter";
import { Welcomer } from "./fixtures/welcomer";

@Injectable()
class LoudGreeter extends Greeter {
	greet(): string {
		return "HELLO";
	}
}

@Module({
	providers: [{ provide: Greeter, useClass: LoudGreeter }, Welcomer],
})
class ProbeModule {}

describe("constructor injection by type", () => {
	test("resolves a dependency this file only names as a parameter type", async () => {
		const context = await NestFactory.createApplicationContext(ProbeModule, {
			logger: false,
			abortOnError: false,
		});

		expect(context.get(Welcomer).welcome()).toBe("HELLO there");

		await context.close();
	});

	test("the parameter type survives into emitted metadata", () => {
		expect(
			Reflect.getMetadata("design:paramtypes", Welcomer) as unknown[],
		).toEqual([Greeter]);
	});
});
