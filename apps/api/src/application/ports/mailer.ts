export interface Letter {
	readonly to: string;
	readonly subject: string;
	readonly text: string;
}

export interface Mailer {
	send(letter: Letter): Promise<void>;
}
