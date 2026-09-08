import { Transaction } from "@/core/transaction";
import type { RepositoryScope } from "./ports/repositories/page.repository";
import type { UnitOfWork } from "./ports/unit-of-work";

export class UnitOfWorkTransaction extends Transaction {
	constructor(private readonly unitOfWork: UnitOfWork<RepositoryScope>) {
		super();
	}

	run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
		return this.unitOfWork.run(() => operation());
	}
}
