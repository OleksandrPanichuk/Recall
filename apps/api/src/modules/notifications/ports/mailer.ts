export interface Letter {
	readonly to: string;
	readonly subject: string;
	readonly text: string;
}

export abstract class Mailer {
	abstract send(letter: Letter): Promise<void>;
}
