import type { AnsweredQuestion } from "@recall/contracts";
import { Check, Minus, X } from "lucide-react";

interface Props {
	readonly answer: AnsweredQuestion;
}

export function AnsweredMark({ answer }: Props) {
	if (answer.skipped) {
		return <Minus className="size-4 shrink-0 text-muted-foreground" />;
	}

	return answer.isCorrect ? (
		<Check className="size-4 shrink-0 text-success" />
	) : (
		<X className="size-4 shrink-0 text-destructive" />
	);
}
