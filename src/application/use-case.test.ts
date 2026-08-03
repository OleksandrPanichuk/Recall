import { expect, test } from "bun:test";
import type { Command, UseCase } from "./use-case";

type AddNumbersCommand = Command<{
	left: number;
	right: number;
}>;

class AddNumbers implements UseCase<AddNumbersCommand, number> {
	public async execute(command: AddNumbersCommand): Promise<number> {
		return command.left + command.right;
	}
}

function assertCommandIsReadonly(command: AddNumbersCommand): void {
	// @ts-expect-error Commands are immutable application input.
	command.left = 0;
}

void assertCommandIsReadonly;

test("a use case executes a readonly command and returns its result", async () => {
	const useCase = new AddNumbers();
	const command: AddNumbersCommand = { left: 2, right: 3 };

	expect(await useCase.execute(command)).toBe(5);
});
