export interface UnitOfWork<TScope> {
	run<TResult>(
		operation: (scope: TScope) => Promise<TResult>,
	): Promise<TResult>;
}
