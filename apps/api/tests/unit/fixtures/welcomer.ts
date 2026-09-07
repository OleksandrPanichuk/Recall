import { Injectable } from "@nestjs/common";
import { Greeter } from "./greeter";

@Injectable()
export class Welcomer {
	constructor(private readonly greeter: Greeter) {}

	welcome(): string {
		return `${this.greeter.greet()} there`;
	}
}
