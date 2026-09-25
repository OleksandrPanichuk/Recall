import type { CurrentQuestionView, Question } from "@recall/contracts";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { Answering } from "./Answering";
import { QUESTION_HINT } from "./QuestionCard.constants";
import type { QuestionAnswer } from "./QuestionCard.types";

interface Props {
	readonly view: CurrentQuestionView;
	readonly question: Question;
	readonly disabled: boolean;
	onAnswer(answer: QuestionAnswer): void;
}

export function QuestionCard({ view, question, disabled, onAnswer }: Props) {
	return (
		<div className="space-y-5">
			<div className="space-y-3">
				<div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
					<span className="truncate">{view.quizSetTitle}</span>
					<span className="shrink-0 tabular-nums">
						{view.index + 1} / {view.total}
					</span>
				</div>
				<Progress value={((view.index + 1) / Math.max(view.total, 1)) * 100} />
			</div>

			<div className="space-y-2">
				<h1 className="text-xl font-semibold leading-snug tracking-tight">
					{question.prompt}
				</h1>
				<div className="flex flex-wrap items-center gap-2">
					{question.topic === undefined ? null : (
						<Badge variant="outline">{question.topic}</Badge>
					)}
					{QUESTION_HINT[question.type] === undefined ? null : (
						<span className="text-xs text-muted-foreground">
							{QUESTION_HINT[question.type]}
						</span>
					)}
				</div>
			</div>

			<Answering
				key={question.id}
				question={question}
				disabled={disabled}
				shuffleSeed={
					view.shuffleOptions ? `${view.attemptId}:${question.id}` : undefined
				}
				onAnswer={onAnswer}
			/>
		</div>
	);
}
