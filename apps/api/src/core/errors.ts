export abstract class ModuleError extends Error {
	abstract readonly status: number;
	abstract readonly code: string;

	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}

	details(): Readonly<Record<string, string>> | undefined {
		return undefined;
	}
}

export class InvalidIdentifierError extends Error {
	constructor(label: string) {
		super(`${label} must be a non-empty identifier`);
		this.name = "InvalidIdentifierError";
	}
}
