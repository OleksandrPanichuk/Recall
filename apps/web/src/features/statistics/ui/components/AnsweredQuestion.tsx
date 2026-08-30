import type { AnsweredQuestion as Answered } from "@recall/contracts";
import { expectsTypedAnswer } from "@recall/contracts";
import { Card } from "@/components/ui/Card";
import { cn } from "@/shared/lib/utils";
import { AnsweredMark } from "./AnsweredMark";

interface Props {
	readonly answer: Answered;
}

export function AnsweredQuestion({ answer }: Props) {
	const chosen = new Set(answer.selectedOptionIds);
	const typed = expectsTypedAnswer(answer.question);

	return (
		<Card className="p-4">
			<div className="flex items-start gap-2.5">
				<AnsweredMark answer={answer} />
				<p className="font-medium leading-snug">{answer.question.prompt}</p>
			</div>

			{typed ? (
				<div className="mt-3 space-y-1 pl-6.5 text-sm">
					<p className="text-muted-foreground">
						Ви написали:{" "}
						<span className="text-foreground">{answer.typedAnswer ?? "—"}</span>
					</p>
				</div>
			) : (
				<ul className="mt-3 space-y-1.5 pl-6.5">
					{answer.question.options.map((option) => (
						<li
							key={option.id}
							className={cn(
								"flex items-center justify-between gap-3 rounded-md border px-3 py-1.5 text-sm",
								option.isCorrect
									? "border-success/50 bg-success/10"
									: chosen.has(option.id)
										? "border-destructive/50 bg-destructive/10"
										: "border-border",
							)}
						>
							<span>{option.text}</span>
							<span className="shrink-0 text-xs text-muted-foreground">
								{option.isCorrect
									? "правильна"
									: chosen.has(option.id)
										? "ваш вибір"
										: ""}
							</span>
						</li>
					))}
				</ul>
			)}

			{answer.question.explanation === undefined ? null : (
				<p className="mt-3 pl-6.5 text-sm text-muted-foreground">
					{answer.question.explanation}
				</p>
			)}
		</Card>
	);
}
