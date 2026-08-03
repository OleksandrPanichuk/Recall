type Synchronous<TResult> =
	TResult extends PromiseLike<unknown> ? never : TResult;

export interface Transaction {
	run<TResult>(operation: () => Synchronous<TResult>): Synchronous<TResult>;
}
