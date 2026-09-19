import type { RetiredView } from "@recall/contracts";
import { Undo2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useRetireQuestion } from "@/features/review/hooks/use-retire-question";
import { QuestionRow } from "@/features/review/ui/components/QuestionRow";
import { retiredLabel } from "./RetiredList.lib";

interface Props {
	readonly retired: readonly RetiredView[];
	readonly today: Date;
}

export function RetiredList({ retired, today }: Props) {
	const { retire, pending, failure } = useRetireQuestion();

	if (retired.length === 0) {
		return (
			<Card className="p-8 text-center text-sm text-muted-foreground">
				Nothing is retired. Stuck questions you retire land here.
			</Card>
		);
	}

	return (
		<div className="space-y-3">
			{failure === null ? null : <Alert variant="destructive">{failure}</Alert>}
			<Card className="divide-y divide-border overflow-hidden">
				{retired.map((question) => (
					<QuestionRow
						key={question.questionId}
						prompt={question.prompt}
						quizSetId={question.quizSetId}
						quizSetTitle={question.quizSetTitle}
						meta={retiredLabel(question.retiredAt, today)}
						action={
							<Button
								variant="outline"
								size="sm"
								disabled={pending !== null}
								onClick={() => {
									void retire(question.questionId, false);
								}}
							>
								<Undo2 />
								{pending === question.questionId
									? "Bringing back…"
									: "Bring back"}
							</Button>
						}
					/>
				))}
			</Card>
		</div>
	);
}
