export type Command<TPayload> = Readonly<TPayload>;

export abstract class UseCase<TOptions, TResult> {
	abstract execute(options: TOptions): Promise<TResult>;
}
