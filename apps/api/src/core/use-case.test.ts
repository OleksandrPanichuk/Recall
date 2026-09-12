import { expect, test } from "bun:test";
import { type Command, UseCase } from "./use-case";

type AddNumbersCommand = Command<{
	left: number;
	right: number;
}>;

class AddNumbers extends UseCase<AddNumbersCommand, number> {
	async execute(command: AddNumbersCommand): Promise<number> {
		return command.left + command.right;
	}
}

class SubtractNumbers implements UseCase<AddNumbersCommand, number> {
	async execute(command: AddNumbersCommand): Promise<number> {
		return command.left - command.right;
	}
}

function assertCommandIsReadonly(command: AddNumbersCommand): void {
	// @ts-expect-error Commands are immutable application input.
	command.left = 0;
}

void assertCommandIsReadonly;

test("a use case executes a readonly command and returns its result", async () => {
	const command: AddNumbersCommand = { left: 2, right: 3 };

	expect(await new AddNumbers().execute(command)).toBe(5);
});

test("a use case may implement the contract instead of extending it", async () => {
	const useCase: UseCase<AddNumbersCommand, number> = new SubtractNumbers();

	expect(await useCase.execute({ left: 5, right: 3 })).toBe(2);
});
