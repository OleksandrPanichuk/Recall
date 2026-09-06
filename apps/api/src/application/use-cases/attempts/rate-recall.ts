import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import { rateResponse } from "@/domain/quiz-attempt/quiz-attempt";
import type { QuestionId } from "@/domain/quiz-set/question";
import type { RecallGrade } from "@/domain/repetition/grade";
import { NoActiveAttemptError } from "./resume-quiz-attempt";

export interface RateRecallCommand {
	readonly questionId: QuestionId;
	readonly recall: RecallGrade;
}

export type RateRecallDependencies = ApplicationDependencies;

export class RateRecallUseCase
	implements UseCase<Command<RateRecallCommand>, void>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: RateRecallDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<RateRecallCommand>): Promise<void> {
		await this.unitOfWork.run(async ({ attempts }) => {
			const attempt = await attempts.findActive();

			if (attempt === undefined) {
				throw new NoActiveAttemptError();
			}

			await attempts.save(
				rateResponse(
					attempt,
					request.questionId,
					request.recall,
					this.clock.now(),
				),
			);
		});
	}
}
