export abstract class Transaction {
	abstract run<TResult>(operation: () => Promise<TResult>): Promise<TResult>;
}
