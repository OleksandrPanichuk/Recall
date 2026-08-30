import type { AnswerQuestionResult } from "@recall/contracts";
import { CircleCheck, CircleX } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";

export function VerdictPanel({
	verdict,
}: {
	readonly verdict: AnswerQuestionResult;
}) {
	const correct = verdict.isCorrect;
	const answers = verdict.acceptedAnswers.join(" / ");

	return (
		<Alert variant={correct ? "success" : "destructive"}>
			{correct ? (
				<CircleCheck className="size-4 text-success" />
			) : (
				<CircleX className="size-4 text-destructive" />
			)}
			<AlertTitle>{correct ? "Правильно" : "Неправильно"}</AlertTitle>
			<AlertDescription className="space-y-1">
				{!correct && answers.length > 0 ? (
					<p>
						Правильна відповідь:{" "}
						<strong className="text-foreground">{answers}</strong>
					</p>
				) : null}
				{verdict.nearMiss === undefined ? null : (
					<p>Майже: {verdict.nearMiss}</p>
				)}
				{verdict.explanation === undefined ? null : (
					<p>{verdict.explanation}</p>
				)}
			</AlertDescription>
		</Alert>
	);
}
