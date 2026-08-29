import type { Question } from "@recall/contracts";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface OrderingOptionsProps {
	readonly question: Question;
	readonly disabled: boolean;
	onAnswer(positions: readonly number[]): void;
}

// The api grades an ordering question by the order the positions arrive in, so
// the ui records clicks as a sequence rather than a set.
export function OrderingOptions({
	question,
	disabled,
	onAnswer,
}: OrderingOptionsProps) {
	const [order, setOrder] = useState<readonly number[]>([]);
	const complete = order.length === question.options.length;

	return (
		<div className="space-y-2">
			{question.options.map((option) => {
				const rank = order.indexOf(option.position);

				return (
					<button
						key={option.id}
						type="button"
						disabled={disabled || rank >= 0}
						onClick={() => setOrder((current) => [...current, option.position])}
						className={cn(
							"flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors",
							"hover:border-primary/60 disabled:pointer-events-none",
							rank >= 0 && "border-primary bg-primary/5 opacity-70",
						)}
					>
						<span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-input text-xs font-medium">
							{rank >= 0 ? rank + 1 : ""}
						</span>
						<span>{option.text}</span>
					</button>
				);
			})}

			<div className="flex gap-2">
				<Button
					className="flex-1"
					disabled={disabled || !complete}
					onClick={() => onAnswer(order)}
				>
					Відповісти
				</Button>
				<Button
					variant="ghost"
					disabled={disabled || order.length === 0}
					onClick={() => setOrder([])}
				>
					Скинути
				</Button>
			</div>
		</div>
	);
}
