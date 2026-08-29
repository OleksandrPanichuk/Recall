import type { Question, QuestionOption } from "@recall/contracts";
import { matchingSides } from "@recall/contracts";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface MatchingOptionsProps {
	readonly question: Question;
	readonly disabled: boolean;
	onAnswer(positions: readonly number[]): void;
}

// Pairs travel as a flat list — left, right, left, right — which is how the api
// reads them back into pairs.
export function MatchingOptions({
	question,
	disabled,
	onAnswer,
}: MatchingOptionsProps) {
	const { left, right } = matchingSides(question);
	const [pairs, setPairs] = useState<readonly (readonly number[])[]>([]);
	const [pendingLeft, setPendingLeft] = useState<number | null>(null);

	const used = new Set(pairs.flat());
	const complete = pairs.length === left.length;

	const pick = (side: "left" | "right", option: QuestionOption): void => {
		if (used.has(option.position)) {
			return;
		}

		if (side === "left") {
			setPendingLeft(option.position);

			return;
		}

		if (pendingLeft === null) {
			return;
		}

		setPairs((current) => [...current, [pendingLeft, option.position]]);
		setPendingLeft(null);
	};

	const column = (
		side: "left" | "right",
		options: readonly QuestionOption[],
	) => (
		<div className="flex-1 space-y-2">
			{options.map((option) => (
				<button
					key={option.id}
					type="button"
					disabled={disabled || used.has(option.position)}
					onClick={() => pick(side, option)}
					className={cn(
						"w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors",
						"hover:border-primary/60 disabled:pointer-events-none disabled:opacity-50",
						pendingLeft === option.position && "border-primary bg-primary/5",
					)}
				>
					{option.text}
				</button>
			))}
		</div>
	);

	return (
		<div className="space-y-3">
			<div className="flex gap-3">
				{column("left", left)}
				{column("right", right)}
			</div>

			{pairs.length > 0 ? (
				<p className="text-xs text-muted-foreground">
					Складено пар: {pairs.length} з {left.length}
				</p>
			) : null}

			<div className="flex gap-2">
				<Button
					className="flex-1"
					disabled={disabled || !complete}
					onClick={() => onAnswer(pairs.flat())}
				>
					Відповісти
				</Button>
				<Button
					variant="ghost"
					disabled={disabled || pairs.length === 0}
					onClick={() => {
						setPairs([]);
						setPendingLeft(null);
					}}
				>
					Скинути
				</Button>
			</div>
		</div>
	);
}
