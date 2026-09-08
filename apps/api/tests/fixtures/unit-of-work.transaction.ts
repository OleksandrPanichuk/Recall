import { Transaction } from "@/core/transaction";
import type { RepositoryScope } from "./repository-scope";
import type { UnitOfWork } from "./unit-of-work";

export class UnitOfWorkTransaction extends Transaction {
	constructor(private readonly unitOfWork: UnitOfWork<RepositoryScope>) {
		super();
	}

	run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
		return this.unitOfWork.run(() => operation());
	}
}
