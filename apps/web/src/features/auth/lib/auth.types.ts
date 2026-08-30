export interface Credentials {
	readonly email: string;
	readonly password: string;
	readonly name?: string;
}

export const credentialsOf = (value: unknown): Credentials => {
	const input = value as Partial<Credentials>;

	return {
		email: String(input.email ?? "").trim(),
		password: String(input.password ?? ""),
		name: input.name?.trim(),
	};
};
