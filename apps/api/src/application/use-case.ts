export type Command<TPayload> = Readonly<TPayload>;

export interface UseCase<TRequest, TResult> {
	execute(request: TRequest): Promise<TResult>;
}
